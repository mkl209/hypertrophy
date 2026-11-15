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
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] }
    })
  ]
});
