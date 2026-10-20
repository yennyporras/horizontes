import { expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { svgMatriz } from './index'
import type { DatosTablero } from './tipos'

const mock: DatosTablero = JSON.parse(readFileSync(new URL('../../mocks/GET_api_tablero.json', import.meta.url), 'utf8'))

test('«Descargar matriz»: SVG independiente, con fondo, sin animación y los colores de los tokens resueltos', () => {
  const tokens: Record<string, string> = { '--hz-fondo': '#FFFFFF', '--hz-r1': '#1B7F3A', '--hz-r2': '#C62828', '--hz-tinta': '#141414' }
  const svg = svgMatriz(mock, { tokens: (n) => tokens[n] ?? '' })
  expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(svg).toContain('width="1600" height="1600"')
  expect(svg).toContain('<rect class="hz-mz-fondo"')
  expect(svg).toContain('.hz-mz-fondo{fill:#FFFFFF}')
  expect(svg).toContain('fill:#C62828')
  expect(svg).not.toContain('var(--hz-r2)')
  // Un token sin valor queda como var() (no se inventa un color).
  expect(svg).toContain('var(--hz-superficie-1)')
  expect(svg).not.toContain('hz-anim')
  // Comparación por defecto: R1, R2 y flechas; con vista 1, solo R1.
  expect((svg.match(/class="hz-flecha"/g) || []).length).toBe(2)
  const r1 = svgMatriz(mock, { vista: 1, ancho: 800, alto: 600, tokens: () => '' })
  expect(r1).toContain('width="800" height="600"')
  expect(r1).not.toContain('class="hz-r2"')
})

test('sin tokens a mano, lee los de la página (en Node no hay documento: quedan los var())', () => {
  const svg = svgMatriz(mock)
  expect(svg).toContain('var(--hz-r1)')
})
