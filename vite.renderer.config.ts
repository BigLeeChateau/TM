import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'out/renderer',
    emptyOutDir: true,
  },
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
  },
})
