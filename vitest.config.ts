import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Pruebas de servidor y motor en node. Para pruebas de React usa el comentario
// `// @vitest-environment jsdom` al inicio del archivo.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'web/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
  },
})
