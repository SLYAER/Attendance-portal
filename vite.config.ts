import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

// PWA Builder valid manifest configuration is enforced via public/manifest.json
export default defineConfig(() => {
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon.png', 'icons/masked-icon.svg', 'screenshots/screenshot-wide.png', 'screenshots/screenshot-mobile.png', '1000147622.jpg'],
        injectRegister: 'auto',
        devOptions: {
          enabled: true
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        },
        manifest: {
          id: '/',
          name: 'Attendance Portal',
          short_name: 'Attendance',
          description: 'Attendance portal with offline support',
          theme_color: '#FFFCF0',
          background_color: '#FFFCF0',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/1000147622.jpg',
              sizes: '192x192',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: '/1000147622.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'any'
            },
            {
              src: '/1000147622.jpg',
              sizes: '512x512',
              type: 'image/jpeg',
              purpose: 'maskable'
            }
          ],
          shortcuts: [
            {
              name: 'Open Attendance',
              short_name: 'Attendance',
              description: 'Open attendance page',
              url: '/?action=clock_in',
              icons: [
                {
                  src: '/1000147622.jpg',
                  sizes: '192x192',
                  type: 'image/jpeg'
                }
              ]
            }
          ],
          screenshots: [
            {
              src: '/screenshots/screenshot-wide.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide'
            },
            {
              src: '/screenshots/screenshot-mobile.png',
              sizes: '720x1280',
              type: 'image/png',
              form_factor: 'narrow'
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
