import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Ændres når installerede apps skal hente alt forfra (fx nye ikoner). */
const CACHE_VERSION = 'v1';

/** Ruter som Workeren svarer på. Må aldrig få app-skallen fra service workeren. */
const WORKER_ROUTES = ['/api', '/mcp', '/authorize', '/token', '/register', '/.well-known'];

const theme = '#F6F1E7';

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify((process.env.WORKERS_CI_COMMIT_SHA ?? 'lokal').slice(0, 7)),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  server: {
    proxy: Object.fromEntries(WORKER_ROUTES.map((route) => [route, 'http://localhost:8787'])),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Globben nedenfor tager allerede ikonerne med.
      includeManifestIcons: false,
      manifest: {
        id: '/',
        name: 'Venlig – trivselsdagbog',
        short_name: 'Venlig',
        description: 'En venlig dagbog til vaner, refleksioner og bøger om selvmedfølelse.',
        lang: 'da',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: theme,
        theme_color: theme,
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: `venlig-${CACHE_VERSION}`,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: WORKER_ROUTES.map((route) => new RegExp(`^${route}(/|$)`)),
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Push-beskeder (daglig påmindelse) håndteres i en lille separat fil.
        importScripts: ['/push-sw.js'],
      },
    }),
  ],
});
