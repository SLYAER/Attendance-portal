import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import {defineConfig} from 'vite';

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
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'screenshot-wide.png', 'screenshot-mobile.png'],
        injectRegister: 'script-defer',
        devOptions: {
          enabled: true
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        },
        manifest: {
          id: '/',
          name: 'Attendance Portal',
          short_name: 'Attendance',
          description: 'Attendance portal with offline support',
          theme_color: '#FFFCF0',
          background_color: '#FFFCF0',
          display: 'standalone',
          display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
          orientation: 'portrait',
          start_url: '/',
          dir: 'ltr',
          lang: 'en-US',
          categories: ['productivity', 'business', 'utilities'],
          prefer_related_applications: false,
          related_applications: [],
          iarc_rating_id: 'e84b072d-71b3-4d3e-86ae-31a8ce4e53b7',
          scope_extensions: [{ origin: '*.attendance.local' }],
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
            icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }]
          }],
          file_handlers: [{
            action: '/',
            accept: {
              'text/plain': ['.txt']
            }
          }],
          screenshots: [
            {
              src: 'screenshot-wide.png',
              sizes: '1280x720',
              type: 'image/png',
              form_factor: 'wide'
            },
            {
              src: 'screenshot-mobile.png',
              sizes: '720x1280',
              type: 'image/png',
              form_factor: 'narrow'
            }
          ],
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
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
