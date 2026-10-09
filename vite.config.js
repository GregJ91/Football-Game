import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// `--mode single` builds one self-contained HTML file (no service worker)
// for sharing a playable link; see scripts/inline.mjs.
export default defineConfig(({ mode }) => ({
    build: mode === 'single' ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {},
    plugins: [
        react(),
        mode !== 'single' &&
            VitePWA({
                registerType: 'autoUpdate',
                includeAssets: ['icon.svg'],
                manifest: {
                    name: 'Pyramid FC',
                    short_name: 'Pyramid FC',
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
