import { describe, expect, it } from 'vitest';
import { normalizeDemoMedia } from './exercise-demo-media.js';

describe('Exercise DemoMedia normalization', () => {
    it('accepts HTTPS image and GIF URLs without loading them', () => {
        expect(normalizeDemoMedia('https://cdn.example.com/squat.gif')).toEqual({
            type: 'image',
            src: 'https://cdn.example.com/squat.gif',
            originalUrl: 'https://cdn.example.com/squat.gif',
        });
        expect(normalizeDemoMedia('https://images.example.com/render?id=123')?.type).toBe('image');
    });

    it('recognizes direct video URLs', () => {
        expect(normalizeDemoMedia('https://cdn.example.com/demo.mp4')?.type).toBe('video');
        expect(normalizeDemoMedia('https://cdn.example.com/demo.webm?x=1')?.type).toBe('video');
    });

    it('converts YouTube URLs to privacy-enhanced embeds', () => {
        expect(normalizeDemoMedia('https://youtu.be/dQw4w9WgXcQ')).toMatchObject({
            type: 'youtube',
            src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0',
        });
        expect(normalizeDemoMedia('https://www.youtube.com/watch?v=dQw4w9WgXcQ')?.type).toBe('youtube');
        expect(normalizeDemoMedia('https://youtube.com/shorts/dQw4w9WgXcQ')?.type).toBe('youtube');
    });

    it('accepts drive:<fileId> without storing a long share URL', () => {
        expect(normalizeDemoMedia('drive:1AbCdEfGhIjKlMnOpQrStUvWxYz12345')).toMatchObject({
            type: 'drive',
            driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz12345',
            src: 'https://drive.usercontent.google.com/download?id=1AbCdEfGhIjKlMnOpQrStUvWxYz12345&export=download&confirm=t',
            fallbackSrc: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz12345/preview',
        });
    });

    it('extracts a Drive file id from common share links', () => {
        const fileUrl = normalizeDemoMedia('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz12345/view?usp=sharing');
        expect(fileUrl).toMatchObject({ type: 'drive', driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz12345' });

        const openUrl = normalizeDemoMedia('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOpQrStUvWxYz12345');
        expect(openUrl).toMatchObject({ type: 'drive', driveFileId: '1AbCdEfGhIjKlMnOpQrStUvWxYz12345' });
    });

    it('rejects Drive folders and malformed Drive ids', () => {
        expect(normalizeDemoMedia('drive:not valid')).toBeNull();
        expect(normalizeDemoMedia('https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz12345')).toBeNull();
    });

    it('rejects empty, malformed, non-HTTPS and script URLs', () => {
        expect(normalizeDemoMedia('')).toBeNull();
        expect(normalizeDemoMedia('not-a-url')).toBeNull();
        expect(normalizeDemoMedia('http://example.com/demo.gif')).toBeNull();
        expect(normalizeDemoMedia('javascript:alert(1)')).toBeNull();
    });
});
