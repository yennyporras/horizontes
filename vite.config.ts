import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Frontend único (participante, tablero y admin) con raíz en web/.
// En desarrollo, /api se envía al servidor Fastify (API real o mocks).
const API = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 8787}`

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: Number(process.env.WEB_PORT ?? 5173),
    proxy: { '/api': { target: API, changeOrigin: true } },
  },
  build: { outDir: '../dist/web', emptyOutDir: true },
})
