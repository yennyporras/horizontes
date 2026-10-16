/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// El panel se sirve bajo /admin. Con VITE_API_REAL=1 las llamadas /api van al servidor de T1.
export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  server: {
    port: 5174,
    fs: { allow: ['../..'] },
    proxy: { '/api': process.env.API_URL ?? 'http://localhost:3000' },
  },
  test: { environment: 'jsdom', globals: false },
})
