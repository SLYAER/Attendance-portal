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
        includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon.png', 'icons/masked-icon.svg', 'screenshots/screenshot-wide.png', 'screenshots/screenshot-mobile.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-icon-512.png'],
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
          display_override: ['tabbed', 'window-controls-overlay', 'standalone', 'minimal-ui'],
          orientation: 'portrait',
          start_url: '/',
          dir: 'ltr',
          lang: 'en-US',
          categories: ['productivity', 'business', 'utilities'],
          prefer_related_applications: false,
          related_applications: [
            {
              platform: 'webapp',
              url: 'https://attendance-portal-mocha.vercel.app/manifest.webmanifest'
            }
          ],
          iarc_rating_id: 'e84b072d-71b3-4d3e-86ae-31a8ce4e53b7',
          scope_extensions: [{ origin: '*.vercel.app' }],
          note_taking: {
            new_note_url: '/?new_note=true'
          },
          share_target: {
            action: '/share-target',
            method: 'GET',
            enctype: 'application/x-www-form-urlencoded',
            params: {
              title: 'title',
              text: 'text',
              url: 'url'
            }
          },
          widgets: [{
            name: 'Attendance Widget',
            description: 'Check attendance status',
            tag: 'attendance',
            template_url: '/',
            type: 'application/json'
          }],
          edge_side_panel: {
            preferred_width: 400
          },
          launch_handler: {
            client_mode: ['navigate-existing', 'auto']
          },
          protocol_handlers: [{
            protocol: 'web+attendance',
            url: '/?resource=%s'
          }],
          shortcuts: [{
            name: 'Clock In',
            short_name: 'Clock In',
            description: 'Quick clock in',
            url: '/?action=clock_in',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }]
          }],
          file_handlers: [{
            action: '/',
            accept: {
              'text/plain': ['.txt']
            }
          }],
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
          ],
          icons: [
            {
              src: '/icons/icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: '/icons/maskable-icon-512.png',
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
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
