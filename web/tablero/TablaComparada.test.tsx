// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { DESCRIPCION_CRITERIO } from '../shared/criterios'
import { cleanup, render, within } from '@testing-library/react'
import mockJson from '../../mocks/GET_api_tablero.json'
import { TablaComparada } from './TablaComparada'
import { PanelProyecto } from './PanelProyecto'
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
  const regulacion = within(container).getByRole('rowheader', { name: /^Regulación/ }).parentElement!
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

test('«Sin votos» en texto secundario y la celda bajo el mínimo vacía, con un solo mensaje bajo la tabla; la cifra de la ronda que se ve, resaltada', () => {
  const datos: DatosTablero = structuredClone(mock)
  const [a, b] = datos.proyectos_vivos
  Object.assign(a.rondas.find((r) => r.ronda === 2)!, { n_votos: 0, promedios: null, eje_x: null, eje_y: null })
  Object.assign(b.rondas.find((r) => r.ronda === 2)!, { bajo_minimo: true, promedios: null, eje_x: null, eje_y: null })
  const { container } = render(<TablaComparada datos={datos} vista={2} />)
  const fila = within(container).getByRole('rowheader', { name: /^Regulación/ }).parentElement!
  const celdas = [...fila.querySelectorAll('td')]
  expect(celdas.map((c) => c.textContent)).toEqual([expect.stringMatching(/^\d,\d\d$/), 'Sin votos', expect.stringMatching(/^\d,\d\d$/), ''])
  expect(celdas.map((c) => c.className)).toEqual(['hz-ini', 'hz-sin-dato', 'hz-ini', 'hz-sin-dato'])
  expect(container.textContent).not.toContain('Faltan votos')
  expect([...container.querySelectorAll('.hz-tabla-aviso')].map((p) => p.textContent)).toEqual([
    `Ronda 2: Hay ${b.rondas.find((r) => r.ronda === 2)!.n_votos} votos de los 3 que hacen falta para mostrar el resultado. Así nadie puede deducir cómo votó otra persona.`,
  ])
  cleanup()
  const { container: c2 } = render(<TablaComparada datos={mock} vista={2} />)
  const f2 = within(c2).getByRole('rowheader', { name: /^Regulación/ }).parentElement!
  expect([...f2.querySelectorAll('td')].map((c) => c.className)).toEqual(['hz-ini', 'hz-foco', 'hz-ini', 'hz-foco'])
})

test('cada criterio lleva su descripción corta bajo el nombre (máximo 100 caracteres)', () => {
  const { container } = render(<TablaComparada datos={mock} vista="comparacion" />)
  const fila = within(container).getByRole('rowheader', { name: /^Alineación con el core/ })
  expect(fila.querySelector('.hz-crit-nombre')!.textContent).toBe('Alineación con el core')
  expect(fila.querySelector('.hz-crit-desc')!.textContent).toBe(DESCRIPCION_CRITERIO.alineacion_core)
  for (const d of container.querySelectorAll('.hz-crit-desc')) expect(d.textContent!.length).toBeLessThanOrEqual(100)
  expect(container.querySelectorAll('.hz-crit-desc')).toHaveLength(6)
})

test('bajo el mínimo en todas las columnas: el mensaje con el conteo en lugar de la tabla (21-oct)', () => {
  const datos: DatosTablero = structuredClone(mock)
  datos.sala.ronda_actual = 1
  for (const p of datos.proyectos_vivos) {
    p.rondas = p.rondas.filter((r) => r.ronda === 1)
    Object.assign(p.rondas[0], { n_votos: 1, bajo_minimo: true, promedios: null, eje_x: null, eje_y: null })
  }
  const { container } = render(<TablaComparada datos={datos} vista={1} />)
  expect(container.querySelector('table')).toBeNull()
  expect(container.querySelector('.hz-tabla-aviso')!.textContent).toBe(
    'Hay 1 voto de los 3 que hacen falta para mostrar el resultado. Así nadie puede deducir cómo votó otra persona.',
  )
  cleanup()
  const { container: c2 } = render(<PanelProyecto proyecto={datos.proyectos_vivos[0]} datos={datos} vista={1} />)
  expect(c2.querySelector('table')).toBeNull()
  expect(c2.querySelector('.hz-tabla-aviso')!.textContent).toMatch(/^Hay 1 voto de los 3 que hacen falta/)
})
