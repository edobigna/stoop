import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import appMetadata from './metadata.json'; // Importa i metadati
import postcssConfig from './postcss.config.js'; // Importa la configurazione PostCSS

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    postcss: postcssConfig // Aggiunta configurazione PostCSS esplicita
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Aggiorna automaticamente il service worker quando ce n'è uno nuovo
      injectRegister: 'auto', // Lascia che il plugin gestisca la registrazione
      devOptions: {
        enabled: true, // Abilita PWA in modalità sviluppo per testare
        type: 'module', // Usa il service worker come modulo ES in dev
      },
      manifest: {
        name: appMetadata.name || 'Stoop',
        short_name: appMetadata.name || 'Stoop',
        description: appMetadata.description || 'App per trovare e condividere oggetti gratuiti.',
        theme_color: appMetadata.theme_color || '#50C878', // Colore principale UI app
        background_color: appMetadata.background_color || '#F0FFF0', // Colore sfondo splash screen
        display: 'standalone', // Come l'app dovrebbe essere visualizzata (standalone, fullscreen, minimal-ui)
        scope: '/',
        start_url: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: '/icons/icon-192x192.png', // Percorso relativo alla cartella 'public'
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512x512-maskable.png', // Icona "maskable" opzionale
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // Importante per icone adattabili
          },
        ],
      },
      workbox: {
        // Configurazione di Workbox (libreria per service worker)
        // GlobPatterns include i file da pre-cachare (rendere disponibili offline)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        // runtimeCaching permette di definire strategie di caching per risorse caricate dinamicamente
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stoop-images-cache',
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 giorni
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/esm\.sh\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'stoop-esm-sh-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 giorni
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache per le API di Firebase Firestore (adatta l'urlPattern se necessario)
            urlPattern: ({url}) => url.hostname === 'firestore.googleapis.com',
            handler: 'NetworkFirst', // Prova prima la rete, poi la cache. Buono per dati che cambiano.
            options: {
              cacheName: 'stoop-firestore-cache',
              networkTimeoutSeconds: 5, // Timeout per la richiesta di rete
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60, // 1 giorno
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
})