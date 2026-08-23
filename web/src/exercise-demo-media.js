const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg)(?:$|[?#])/i;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/;

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

/**
 * Normalize ExerciseMaster.DemoMedia into a safe, renderable media descriptor.
 * Nothing is fetched here; callers only assign a src after the user explicitly
 * opens the demo panel.
 */
export function normalizeDemoMedia(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;

    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        return null;
    }
    if (url.protocol !== 'https:') return null;

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
