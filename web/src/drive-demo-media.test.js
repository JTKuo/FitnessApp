import { describe, expect, it } from 'vitest';
import { drivePreviewUrlFromMediaUrl } from './drive-demo-media.js';

describe('Drive demo media adapter', () => {
    it('builds a Drive preview URL from generated direct media URLs', () => {
        expect(drivePreviewUrlFromMediaUrl(
            'https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOpQrStUvWxYz12345&export=download&confirm=t'
        )).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz12345/preview');
    });

    it('ignores non-Drive media and malformed ids', () => {
        expect(drivePreviewUrlFromMediaUrl('https://cdn.example.com/demo.mp4')).toBe('');
        expect(drivePreviewUrlFromMediaUrl('https://drive.usercontent.google.com/download?id=bad id')).toBe('');
        expect(drivePreviewUrlFromMediaUrl('not-a-url')).toBe('');
    });
});
