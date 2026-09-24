import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// The client studio. Reuses the library's components and root dependencies, so
// there is no second install. Built to dist-studio, separate from the library
// build (dist) and the showcase site (dist-site).
const root = fileURLToPath(new URL('.', import.meta.url))
const repo = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': `${repo}src` },
    dedupe: ['react', 'react-dom'],
  },
  server: { port: 4190, strictPort: true, fs: { allow: [repo] } },
  build: { outDir: `${repo}dist-studio`, emptyOutDir: true },
})
