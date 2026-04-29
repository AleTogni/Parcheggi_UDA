import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', 
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'], // I tuoi file statici
      manifest: {
        name: 'Brescia Green Park',
        short_name: 'BresciaPark',
        description: 'Gestione intelligente della sosta urbana e premi ecosostenibili',
        theme_color: '#064e3b', // Il verde smeraldo della tua app
        background_color: '#ffffff',
        display: 'standalone', // Fa scomparire l'interfaccia di Chrome/Safari
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})