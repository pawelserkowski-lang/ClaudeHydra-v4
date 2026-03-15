/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import type { Plugin } from 'vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import topLevelAwait from 'vite-plugin-top-level-await';
import wasm from 'vite-plugin-wasm';

/**
 * Stub plugin for virtual:pwa-register when vite-plugin-pwa is disabled.
 * Returns a no-op registerSW function so the app builds and runs without PWA.
 */
function pwaRegisterStub(): Plugin {
  return {
    name: 'pwa-register-stub',
    resolveId(id) {
      if (id === 'virtual:pwa-register') return '\0virtual:pwa-register';
      return null;
    },
    load(id) {
      if (id === '\0virtual:pwa-register') {
        return 'export function registerSW() { return () => {}; }';
      }
      return null;
    },
  };
}

export default defineConfig(({ mode }) => {
  // Load ALL env vars (empty prefix = no VITE_ filter)
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_BACKEND_URL || 'http://localhost:8082';
  const partnerBackendUrl = env.VITE_PARTNER_BACKEND_URL || 'http://localhost:8081';

  // vite-plugin-pwa 0.21 is incompatible with Vite 6+ Environment API in monorepo
  // with mixed Vite versions (6.4 + 7.3). The secondary Rollup build picks up
  // vite@7.3's node:module chunks and fails with "createRequire" not exported.
  // PWA plugin is only loaded in dev mode; production builds use a stub.
  // Re-enable for production when vite-plugin-pwa releases Vite 6/7 compatible version.
  const isProd = mode === 'production';

  return {
    plugins: [
      wasm(),
      topLevelAwait(),
      react({
        babel: {
          plugins: [['babel-plugin-react-compiler', { target: '19' }]],
        },
      }),
      tailwindcss(),
      // PWA: use real plugin in dev, stub in production build
      ...(isProd
        ? [pwaRegisterStub()]
        : [
            VitePWA({
              registerType: 'autoUpdate',
              workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
                runtimeCaching: [
                  {
                    urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                    handler: 'CacheFirst',
                    options: {
                      cacheName: 'google-fonts-cache',
                      expiration: {
                        maxEntries: 10,
                        maxAgeSeconds: 60 * 60 * 24 * 365, // <== 365 days
                      },
                      cacheableResponse: {
                        statuses: [0, 200],
                      },
                    },
                  },
                ],
              },
            }),
          ]),
      // Bundle size tracking: always generate stats.html on build, auto-open in analyze mode
      ...(isProd
        ? [(visualizer as any)({ open: false, filename: 'dist/stats.html', gzipSize: true, brotliSize: true })]
        : mode === 'analyze'
          ? [(visualizer as any)({ open: true, filename: 'dist/stats.html', gzipSize: true, brotliSize: true })]
          : []),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['@tailwindcss/oxide', 'fsevents', 'lightningcss', 'tailwindcss'],
    },
    server: {
      port: 5199,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: backendUrl.startsWith('https'),
        },
        '/ws': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,
        },
        '/partner-api': {
          target: partnerBackendUrl,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/partner-api/, '/api'),
        },
      },
    },
    preview: {
      port: 4199,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: backendUrl.startsWith('https'),
        },
        '/ws': {
          target: backendUrl,
          changeOrigin: true,
          ws: true,
        },
        '/partner-api': {
          target: partnerBackendUrl,
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/partner-api/, '/api'),
        },
      },
    },
    // Worker environment config — externalize WASM runtime imports for Web Workers
    worker: {
      rollupOptions: {
        external: (id: string) => id.endsWith('.node') || id.startsWith('/wasm/') || id.includes('../pkg'),
      },
    },
    build: {
      target: 'esnext',
      sourcemap: true,
      rollupOptions: {
        // Externalize:
        // 1. Native .node binaries (e.g. @tailwindcss/oxide platform packages)
        // 2. WASM runtime imports (resolved at runtime from /public, not at build time)
        // 3. WASM pkg references (from vite-plugin-wasm commonjs transform)
        external: (id: string) => id.endsWith('.node') || id.startsWith('/wasm/') || id.includes('../pkg'),
        output: {
          manualChunks(id: string) {
            // ── React core ──────────────────────────────────────────
            if (
              id.includes('/node_modules/react-dom/') ||
              id.includes('/node_modules/react/') ||
              id.includes('/node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }
            // ── Zustand state management ────────────────────────────
            if (id.includes('/node_modules/zustand/')) {
              return 'vendor-zustand';
            }
            // ── TanStack React Query ────────────────────────────────
            if (id.includes('/node_modules/@tanstack/react-query/') && !id.includes('devtools')) {
              return 'vendor-query';
            }
            // ── TanStack DevTools (dev-only, eagerly loaded) ────────
            if (id.includes('/node_modules/@tanstack/react-query-devtools/')) {
              return 'vendor-devtools';
            }
            // ── TanStack Virtual ────────────────────────────────────
            if (
              id.includes('/node_modules/@tanstack/react-virtual/') ||
              id.includes('/node_modules/@tanstack/virtual-core/')
            ) {
              return 'vendor-virtual';
            }
            // ── Motion / Framer Motion ──────────────────────────────
            if (id.includes('/node_modules/motion/')) {
              return 'vendor-motion';
            }
            // ── i18n ────────────────────────────────────────────────
            if (id.includes('/node_modules/i18next') || id.includes('/node_modules/react-i18next/')) {
              return 'vendor-i18n';
            }
            // ── Markdown rendering (heavy: highlight.js ~250kB) ─────
            if (
              id.includes('/node_modules/react-markdown/') ||
              id.includes('/node_modules/remark-') ||
              id.includes('/node_modules/rehype-') ||
              id.includes('/node_modules/highlight.js/') ||
              id.includes('/node_modules/lowlight/') ||
              id.includes('/node_modules/hast-') ||
              id.includes('/node_modules/mdast-') ||
              id.includes('/node_modules/micromark') ||
              id.includes('/node_modules/unified/') ||
              id.includes('/node_modules/unist-')
            ) {
              return 'vendor-markdown';
            }
            // ── Zod schema validation ───────────────────────────────
            if (id.includes('/node_modules/zod/')) {
              return 'vendor-zod';
            }
            // ── Lucide icons (tree-shaken but still ~80kB) ──────────
            if (id.includes('/node_modules/lucide-react/')) {
              return 'vendor-lucide';
            }
            // ── OpenTelemetry + Zone.js (telemetry stack ~300kB) ────
            if (id.includes('/node_modules/@opentelemetry/') || id.includes('/node_modules/zone.js/')) {
              return 'vendor-otel';
            }
            // ── UI utilities (sonner, dompurify, etc.) ─────────────
            if (id.includes('/node_modules/sonner/') || id.includes('/node_modules/dompurify/')) {
              return 'vendor-ui';
            }
            // ── @jaskier/* workspace packages (shared app code) ─────
            // These resolve through symlinks to ../packages/*
            if (id.includes('/packages/core/') || id.includes('/packages/state/') || id.includes('/packages/i18n/')) {
              return 'shared-core';
            }
            if (
              id.includes('/packages/hydra-app/') ||
              id.includes('/packages/chat-module/') ||
              id.includes('/packages/ui/')
            ) {
              return 'shared-ui';
            }
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
    },
  };
});
