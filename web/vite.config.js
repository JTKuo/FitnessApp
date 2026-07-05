import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/FitnessApp/',
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '個人化健身暨健康追蹤',
        short_name: 'FitnessApp',
        lang: 'zh-Hant',
        display: 'standalone',
        start_url: '/FitnessApp/',
        background_color: '#000000',
        theme_color: '#ffc300',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\//,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/unpkg\.com\/ionicons/,
            handler: 'CacheFirst',
            options: { cacheName: 'ionicons-cdn', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            urlPattern: /^https:\/\/script\.google(?:usercontent)?\.com\//,
            handler: 'NetworkOnly', // 本輪不快取任何 API 資料
          },
        ],
      },
    }),
  ],
});
