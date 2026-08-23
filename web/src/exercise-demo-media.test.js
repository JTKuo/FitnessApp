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

    it('rejects empty, malformed, non-HTTPS and script URLs', () => {
        expect(normalizeDemoMedia('')).toBeNull();
        expect(normalizeDemoMedia('not-a-url')).toBeNull();
        expect(normalizeDemoMedia('http://example.com/demo.gif')).toBeNull();
        expect(normalizeDemoMedia('javascript:alert(1)')).toBeNull();
    });
});
