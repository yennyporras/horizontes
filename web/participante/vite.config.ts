/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const aqui = (p: string) => fileURLToPath(new URL(p, import.meta.url))

// Arnés provisional de T2 hasta que llegue el esqueleto de T1: sirve /m/* y la muestra /m/_ui.
// web/shared/ui no tiene node_modules propio: react se resuelve desde aquí.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@ui': aqui('../shared/ui'),
      react: aqui('./node_modules/react'),
      'react-dom': aqui('./node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: { fs: { allow: [aqui('../..')] } },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', '../shared/ui/__tests__/**/*.test.{ts,tsx}'],
    css: false,
  },
})
