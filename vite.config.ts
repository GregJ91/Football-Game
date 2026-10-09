import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'node:child_process';

/** The update number (commit count): the home screen shows it as v1.01, v1.02… (see src/version.ts). */
const git = (cmd: string) => {
  try {
    return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return '';
  }
};
const BUILD = git('rev-list --count HEAD') || '0';

// `--mode single` builds one self-contained HTML file (no service worker)
// for sharing a playable link; see scripts/inline.mjs.
export default defineConfig(({ mode }) => ({
  // Served from a sub-path (e.g. GitHub Pages /Football-Game/) when BASE_PATH is set.
  base: process.env.BASE_PATH ?? '/',
  define: {
    __APP_BUILD__: JSON.stringify(BUILD),
    __APP_BUILT_AT__: JSON.stringify(new Date().toISOString()),
  },
  build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {},
  plugins: [
    react(),
    mode !== 'single' &&
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      workbox: {
        // Keep the fonts so the game looks right offline.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
      manifest: {
        name: 'The Journey of a Football Manager',
        short_name: 'FM Journey',
        description: 'Build a club from the bottom of the pyramid to the top of Europe.',
        theme_color: '#0E1A14',
        background_color: '#0E1A14',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
  },
}));
