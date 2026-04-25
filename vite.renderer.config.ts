import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

/**
 * Remove crossorigin attributes from script/link tags.
 * Required for Electron apps loaded via file:// protocol.
 */
function stripCrossOrigin(): import('vite').Plugin {
  return {
    name: 'strip-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/\scrossorigin\b/g, '')
    },
  }
}

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'out/renderer',
    emptyOutDir: true,
  },
  plugins: [react(), stripCrossOrigin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 5173,
  },
})
