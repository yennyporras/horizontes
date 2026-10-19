// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, within } from '@testing-library/react'
import mockJson from '../../mocks/GET_api_tablero.json'
import { TablaComparada } from './TablaComparada'
import type { DatosTablero } from './tipos'

const mock = mockJson as unknown as DatosTablero
afterEach(cleanup)

const encabezados = (c: HTMLElement) => within(c).getAllByRole('columnheader').map((th) => th.textContent)

const filas = (c: HTMLElement) => within(c).getAllByRole('rowheader').map((th) => th.textContent)

test('solo los 6 criterios con 2 decimales; sin «Total» (preentrega 19-oct), T2M, ejes ni votos (acta A3 y A4)', () => {
  const datos: DatosTablero = structuredClone(mock)
  datos.proyectos_vivos[0].rondas[0].total = 11.256
  datos.proyectos_vivos[0].rondas[0].promedios!.regulacion = 5.256
  const { container } = render(<TablaComparada datos={datos} vista="comparacion" />)
  expect(filas(container)).toEqual(datos.criterios.map((c) => expect.any(String)))
  expect(filas(container)).toHaveLength(6)
  expect(container.textContent).not.toMatch(/Total|11,26|T2M|Eje X|Eje Y|Votos/)
  const regulacion = within(container).getByRole('rowheader', { name: 'Regulación' }).parentElement!
  expect(regulacion.querySelector('td')!.textContent).toBe('5,26')
  // R1 y R2 se leen sin color: texto y marca de forma distinta.
  expect(encabezados(container).filter((t) => t === 'R2')).toHaveLength(mock.proyectos_vivos.length)
  expect(container.querySelectorAll('.hz-col-r1 .hz-marca-r1')).toHaveLength(mock.proyectos_vivos.length)
  expect(container.querySelectorAll('.hz-col-r2 .hz-marca-r2')).toHaveLength(mock.proyectos_vivos.length)
})

test('antes de la ronda 2 no muestra la columna R2 (solo diría "Sin votos")', () => {
  const datos: DatosTablero = structuredClone(mock)
  datos.sala.ronda_actual = 1
  datos.proyectos_vivos.forEach((p) => (p.rondas = p.rondas.filter((r) => r.ronda === 1).map((r) => ({ ...r, total: 10 }))))
  const { container } = render(<TablaComparada datos={datos} vista={1} />)
  expect(encabezados(container)).not.toContain('R2')
  expect(container.textContent).not.toContain('Sin votos')
  expect(encabezados(container).filter((t) => t === 'R1')).toHaveLength(datos.proyectos_vivos.length)
})
