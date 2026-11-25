import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'MindCraft — P2P Tutoring',
        short_name: 'MindCraft',
        description: 'Peer-to-peer college tutoring powered by AI matching and vernacular voice search.',
        theme_color: '#DCFD8B',
        background_color: '#0F0F1A',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/ui-avatars\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'avatar-cache', expiration: { maxEntries: 50 } },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/react-router/') ||
              id.includes('/react-router-dom/')
            ) {
              return 'vendor-react';
            }
            if (id.includes('@clerk')) {
              return 'vendor-clerk';
            }
            if (id.includes('@tanstack')) {
              return 'vendor-tanstack';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-lucide';
            }
            if (id.includes('framer-motion')) {
              return 'vendor-motion';
            }
            if (id.includes('react-force-graph-2d') || id.includes('d3-force')) {
              return 'vendor-graph';
            }
            if (id.includes('date-fns') || id.includes('react-datepicker')) {
              return 'vendor-date';
            }
            if (id.includes('socket.io-client')) {
              return 'vendor-socket';
            }
          }
        },
      },
    },
  },
})
