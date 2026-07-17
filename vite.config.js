import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  server: {
    host: '0.0.0.0',
    strictPort: true,
    port: 5173,
    hmr: { overlay: false }
  },
  build: {
    target: process.env.TAURI_ENV_PLATFORM == 'android' ? 'chrome61'
          : process.env.TAURI_ENV_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  }
})
