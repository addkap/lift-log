import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Makes the site installable and lets it work with no internet:
    // the service worker saves every app file on first visit and serves them from the phone afterwards.
    VitePWA({
      registerType: 'autoUpdate', // new versions install themselves; the next open uses them
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Lift Log',
        short_name: 'Lift Log',
        description: 'Simple gym workout log',
        display: 'standalone', // opens full-screen, no browser bars
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        background_color: '#ffffff',
        theme_color: '#00338d',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: 'index.html', // any page address opens the app, even offline
      },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
