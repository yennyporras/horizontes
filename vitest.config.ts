import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Pruebas de servidor y motor en node. Para pruebas de React usa el comentario
// `// @vitest-environment jsdom` al inicio del archivo.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'web/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    // Con 4 terminales compilando en la misma máquina, las pruebas de UI en jsdom pasaban de 5 s y la compuerta fallaba al azar.
    testTimeout: 20_000,
  },
})
