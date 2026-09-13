import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Essen ist fertig',
        short_name: 'Essen',
        description: 'Wochenplan, Rezepte und gemeinsame Einkaufsliste',
        lang: 'de',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#faf7f2',
        theme_color: '#c2410c',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Die App-Shell wird vorgeladen, damit die Liste im Supermarkt auch
        // ohne Empfang startet. Die Daten selbst liegen in IndexedDB.
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Supabase-Antworten nie cachen - dafür ist der lokale Store da,
            // ein veralteter HTTP-Cache würde nur Konflikte erzeugen.
            urlPattern: ({ url }) => url.pathname.startsWith('/rest/v1'),
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})
