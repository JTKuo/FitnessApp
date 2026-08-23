const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg)(?:$|[?#])/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,128}$/;

function youtubeIdFromUrl(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'youtu.be') {
        const id = url.pathname.split('/').filter(Boolean)[0] || '';
        return YOUTUBE_ID.test(id) ? id : '';
    }
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return '';

    if (url.pathname === '/watch') {
        const id = url.searchParams.get('v') || '';
        return YOUTUBE_ID.test(id) ? id : '';
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (['shorts', 'embed'].includes(parts[0])) {
        const id = parts[1] || '';
        return YOUTUBE_ID.test(id) ? id : '';
    }
    return '';
}

function normalizeDriveFileId(value) {
    const id = String(value || '').trim();
    return DRIVE_FILE_ID.test(id) ? id : '';
}

function driveIdFromUrl(url) {
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'drive.google.com') return '';

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts[0] === 'file' && parts[1] === 'd') {
        return normalizeDriveFileId(parts[2]);
    }

    if (parts[0] === 'open' || parts[0] === 'uc') {
        return normalizeDriveFileId(url.searchParams.get('id'));
    }

    // Deliberately do not accept Drive folder URLs. DemoMedia must point to one file.
    return '';
}

function driveDescriptor(fileId, originalUrl) {
    const encodedId = encodeURIComponent(fileId);
    return {
        // Reuse the Picker's normal <video> path. drive-demo-media.js adds looping
        // behavior and replaces the video with Drive preview if direct streaming fails.
        type: 'video',
        source: 'drive',
        src: `https://drive.usercontent.google.com/download?id=${encodedId}&export=download&confirm=t`,
        fallbackSrc: `https://drive.google.com/file/d/${encodedId}/preview`,
        originalUrl,
        driveFileId: fileId,
    };
}

/**
 * Normalize ExerciseMaster.DemoMedia into a safe, renderable media descriptor.
 * Nothing is fetched here; callers only assign a src after the user explicitly
 * opens the demo panel.
 *
 * Supported Google Drive forms:
 *   drive:<FILE_ID>
 *   https://drive.google.com/file/d/<FILE_ID>/view?...
 *   https://drive.google.com/open?id=<FILE_ID>
 */
export function normalizeDemoMedia(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    if (/^drive:/i.test(raw)) {
        const fileId = normalizeDriveFileId(raw.slice(raw.indexOf(':') + 1));
        return fileId ? driveDescriptor(fileId, raw) : null;
    }

    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        return null;
    }
    if (url.protocol !== 'https:') return null;

    const driveFileId = driveIdFromUrl(url);
    if (driveFileId) return driveDescriptor(driveFileId, url.href);

    const youtubeId = youtubeIdFromUrl(url);
    if (youtubeId) {
        return {
            type: 'youtube',
            src: `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0`,
            originalUrl: url.href,
        };
    }

    if (VIDEO_EXTENSIONS.test(url.pathname)) {
        return { type: 'video', src: url.href, originalUrl: url.href };
    }

    // GIF/image CDNs often omit a file extension. Treat any other HTTPS URL as
    // an image candidate; load errors are handled by the picker UI.
    return { type: 'image', src: url.href, originalUrl: url.href };
}
