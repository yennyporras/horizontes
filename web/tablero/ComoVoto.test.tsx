// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import mockJson from '../../mocks/GET_api_tablero.json'
import { ComoVoto } from './ComoVoto'
import type { DatosTablero } from './tipos'

const mock = mockJson as unknown as DatosTablero
afterEach(cleanup)

const barras = (c: HTMLElement) => [...c.querySelectorAll('[role="img"]')]

test('conteo 1-3-5-7-9 de la distribución del servidor por criterio, R1 y R2, en texto y con etiqueta accesible', () => {
  const { container } = render(<ComoVoto datos={mock} rondas={[1, 2]} />)
  expect(screen.getByRole('heading', { name: 'Cómo votó la mesa' })).toBeTruthy()
  const n = mock.proyectos_vivos.length * mock.criterios.length * 2
  expect(barras(container)).toHaveLength(n)
  const r1 = mock.proyectos_vivos[0].rondas.find((r) => r.ronda === 1)!
  const d = r1.distribucion!.regulacion
  const img = screen.getByRole('img', { name: new RegExp(`^${mock.proyectos_vivos[0].nombre}, Regulación, ronda 1:`) })
  expect(img.getAttribute('aria-label')).toBe(
    `${mock.proyectos_vivos[0].nombre}, Regulación, ronda 1: ${d['1']} votos en 1, ${d['3'] === 1 ? '1 voto' : `${d['3']} votos`} en 3, ${d['5']} votos en 5, ${d['7']} votos en 7, ${d['9']} votos en 9`,
  )
  // El conteo también se ve escrito sobre cada barra (no solo el alto o el color).
  expect([...img.querySelectorAll('.hz-cv-cuenta')].map((s) => s.textContent)).toEqual(['1', '3', '5', '7', '9'].map((k) => String(d[k as '1'])))
  // R1 hueco y R2 sólido, siempre con su texto y los votos de la ronda.
  const proy = screen.getByRole('region', { name: mock.proyectos_vivos[0].nombre })
  expect(within(proy).getByText(/R1/).textContent).toBe(`R1 · ${r1.n_votos} votos`)
  expect(proy.querySelectorAll('.hz-cv-barras-r1')).toHaveLength(mock.criterios.length)
  expect(proy.querySelectorAll('.hz-cv-barras-r2')).toHaveLength(mock.criterios.length)
  // Sin T2M, ejes ni promedios: solo conteos.
  expect(container.textContent).not.toMatch(/T2M|Eje X|Eje Y|Total/)
})

test('alcance sala: «Cómo votó la sala»; solo la ronda pedida', () => {
  const datos: DatosTablero = { ...structuredClone(mock), alcance: { tipo: 'sala', mesa_id: null, mesa_nombre: null } }
  const { container } = render(<ComoVoto datos={datos} rondas={[2]} />)
  expect(screen.getByRole('heading', { name: 'Cómo votó la sala' })).toBeTruthy()
  expect(container.querySelectorAll('.hz-cv-barras-r1')).toHaveLength(0)
  expect(container.querySelectorAll('.hz-cv-barras-r2')).toHaveLength(datos.proyectos_vivos.length * datos.criterios.length)
})

test('bajo el mínimo (distribución null) muestra el aviso y no dibuja esa ronda', () => {
  const datos: DatosTablero = structuredClone(mock)
  datos.minimo_votos = 3
  datos.proyectos_vivos.forEach((p) => {
    const r2 = p.rondas.find((r) => r.ronda === 2)!
    Object.assign(r2, { n_votos: 2, promedios: null, distribucion: null, bajo_minimo: true })
  })
  const { container } = render(<ComoVoto datos={datos} rondas={[1, 2]} />)
  expect(screen.getByRole('status').textContent).toBe('Hace falta al menos 3 votos para mostrar esta mesa en la ronda 2.')
  expect(container.querySelectorAll('.hz-cv-barras-r2')).toHaveLength(0)
  expect(container.querySelectorAll('.hz-cv-barras-r1')).toHaveLength(datos.proyectos_vivos.length * datos.criterios.length)
})

test('sin votos en la ronda: aviso y ninguna barra', () => {
  const datos: DatosTablero = structuredClone(mock)
  datos.proyectos_vivos.forEach((p) => (p.rondas = p.rondas.filter((r) => r.ronda === 1).map((r) => ({ ...r, n_votos: 0, distribucion: null }))))
  const { container } = render(<ComoVoto datos={datos} rondas={[1]} />)
  expect(screen.getByRole('status').textContent).toBe('Aún no hay votos en la ronda 1.')
  expect(barras(container)).toHaveLength(0)
})

test('un proyecto bajo el mínimo y el otro con datos: «Faltan votos» en sus celdas', () => {
  const datos: DatosTablero = structuredClone(mock)
  Object.assign(datos.proyectos_vivos[1].rondas.find((r) => r.ronda === 1)!, { n_votos: 1, distribucion: null, bajo_minimo: true })
  render(<ComoVoto datos={datos} rondas={[1]} />)
  const segundo = screen.getByRole('region', { name: datos.proyectos_vivos[1].nombre })
  expect(within(segundo).getAllByText('Faltan votos')).toHaveLength(datos.criterios.length)
  expect(within(segundo).getByText(/R1/).textContent).toBe('R1 · 1 voto')
})
