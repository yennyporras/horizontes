// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, within } from '@testing-library/react'
import mockJson from '../../mocks/GET_api_tablero.json'
import { TablaComparada } from './TablaComparada'
import type { DatosTablero } from './tipos'

const mock = mockJson as unknown as DatosTablero
afterEach(cleanup)

const encabezados = (c: HTMLElement) => within(c).getAllByRole('columnheader').map((th) => th.textContent)

test('con ronda 2 muestra R1, R2 y votos por proyecto', () => {
  const { container } = render(<TablaComparada datos={mock} vista="comparacion" />)
  expect(encabezados(container).filter((t) => t === 'R2')).toHaveLength(mock.proyectos_vivos.length)
})

test('antes de la ronda 2 no muestra la columna R2 (solo diría "Sin votos")', () => {
  const datos: DatosTablero = structuredClone(mock)
  datos.sala.ronda_actual = 1
  datos.proyectos_vivos.forEach((p) => (p.rondas = p.rondas.filter((r) => r.ronda === 1)))
  const { container } = render(<TablaComparada datos={datos} vista={1} />)
  expect(encabezados(container)).not.toContain('R2')
  expect(container.textContent).not.toContain('Sin votos')
  expect(encabezados(container).filter((t) => t === 'R1')).toHaveLength(datos.proyectos_vivos.length)
})
