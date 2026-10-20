import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Pruebas de servidor y motor en node. Para pruebas de React usa el comentario
// `// @vitest-environment jsdom` al inicio del archivo.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'web/**/*.test.{ts,tsx}', 'shared/**/*.test.ts', 'server/**/*.test.ts'],
    environment: 'node',
    // Con la máquina de desarrollo cargada, las pruebas de UI en jsdom pasaban de 5 s y la suite fallaba al azar.
    testTimeout: 20_000,
    // Sin reintentos: un fallo intermitente se investiga, no se repite hasta que pase. Solo las pruebas en navegador
    // real reintentan, en local y por un motivo medido (REINTENTOS_E2E en tests/navegador.ts, docs/DECISIONES.md 20-oct).
  },
})
