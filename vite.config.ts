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
        includeAssets: ['icons/favicon.ico', 'icons/apple-touch-icon.png', 'icons/masked-icon.svg', 'screenshots/screenshot-wide.png', 'screenshots/screenshot-mobile.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-icon-512.png'],
        injectRegister: 'auto',
        devOptions: {
          enabled: true
        },
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        },
        manifest: false
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
