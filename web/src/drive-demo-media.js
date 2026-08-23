const DRIVE_CONTENT_HOST = 'drive.usercontent.google.com';
const DRIVE_FILE_ID = /^[A-Za-z0-9_-]{10,128}$/;

function normalizeDriveFileId(value) {
    const id = String(value || '').trim();
    return DRIVE_FILE_ID.test(id) ? id : '';
}

export function drivePreviewUrlFromMediaUrl(value) {
    let url;
    try {
        url = new URL(String(value || '').trim());
    } catch (_) {
        return '';
    }
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== DRIVE_CONTENT_HOST) return '';
    const fileId = normalizeDriveFileId(url.searchParams.get('id'));
    if (!fileId) return '';
    return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

function configureLoopingVideo(video) {
    if (!video) return;
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.play?.().catch(() => { /* controls remain available if autoplay is blocked */ });
}

function replaceDriveVideoWithPreview(video, previewUrl) {
    const panel = video?.closest?.('.picker-demo-panel');
    if (!panel || !previewUrl) return false;

    const label = video.getAttribute('aria-label') || '動作示範';
    panel.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.title = label;
    iframe.loading = 'lazy';
    iframe.allow = 'autoplay; fullscreen';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.setAttribute('allowfullscreen', '');
    iframe.src = previewUrl;
    panel.appendChild(iframe);
    return true;
}

export function installDriveDemoMediaAdapter(app) {
    if (app?.__driveDemoMediaAdapterInstalled) return;
    if (app) app.__driveDemoMediaAdapterInstalled = true;

    // Picker creates the media synchronously inside its delegated click handler.
    // Configure it in a microtask after that render without observing the subtree.
    document.addEventListener('click', event => {
        const toggle = event.target?.closest?.('[data-picker-demo-motion]');
        if (!toggle) return;
        queueMicrotask(() => {
            document.querySelectorAll('.picker-demo-panel video').forEach(configureLoopingVideo);
        });
    }, true);

    // Media error does not bubble, but it is observable during capture. For Drive
    // direct-stream failures, replace the video before Picker's target error handler
    // turns the panel into a generic error message.
    document.addEventListener('error', event => {
        const video = event.target;
        if (!(video instanceof HTMLVideoElement)) return;
        if (!video.closest('.picker-demo-panel')) return;

        const previewUrl = drivePreviewUrlFromMediaUrl(video.currentSrc || video.src);
        if (!previewUrl) return;

        event.preventDefault();
        event.stopImmediatePropagation();
        replaceDriveVideoWithPreview(video, previewUrl);
    }, true);
}
