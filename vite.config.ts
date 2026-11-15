import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE is set by the GitHub Pages workflow to "/<repo>/".
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Hypertrophy Coach',
        short_name: 'Hypertrophy',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#F6FFF8',
        theme_color: '#3E363F',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }
        ]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'], maximumFileSizeToCacheInBytes: 5 * 1024 * 1024 }
    })
  ]
});
