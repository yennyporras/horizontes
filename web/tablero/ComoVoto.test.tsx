// @vitest-environment jsdom
import { afterEach, expect, test } from 'vitest'
import { DESCRIPCION_CRITERIO } from '../shared/criterios'
import { cleanup, render, screen, within } from '@testing-library/react'
import mockJson from '../../mocks/GET_api_tablero.json'
import { ComoVoto, marcaDistribucion } from './ComoVoto'
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
  // QA por roles (Sebastián): los conteos son personas.
  expect(proy.querySelector('.hz-cv-r1')!.textContent).toBe(`R1 · ${r1.n_votos} personas`)
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
  expect(screen.getByRole('status').textContent).toBe('Hacen falta al menos 3 votos para mostrar esta mesa en la ronda 2.')
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
  expect(segundo.querySelector('.hz-cv-r1')!.textContent).toBe('R1 · 1 persona')
})

test('QA-T-03: una sola escala; el mismo conteo tiene la misma altura en R1 y en R2', () => {
  const datos: DatosTablero = structuredClone(mock)
  const [r1, r2] = [1, 2].map((n) => datos.proyectos_vivos[0].rondas.find((r) => r.ronda === n)!)
  r1.n_votos = 6
  r2.n_votos = 4
  r1.distribucion!.regulacion = { '1': 0, '3': 4, '5': 2, '7': 0, '9': 0 }
  r2.distribucion!.regulacion = { '1': 0, '3': 4, '5': 0, '7': 0, '9': 0 }
  const { container } = render(<ComoVoto datos={datos} rondas={[1, 2]} />)
  const alto = (n: number) =>
    (screen.getByRole('img', { name: new RegExp(`^${datos.proyectos_vivos[0].nombre}, Regulación, ronda ${n}:`) }).querySelectorAll('.hz-cv-barra')[0] as HTMLElement).style.height
  expect(alto(1)).toBe(alto(2))
  // Ninguna barra pasa del alto de la pista.
  for (const b of container.querySelectorAll<HTMLElement>('.hz-cv-barra')) expect(parseFloat(b.style.height)).toBeLessThanOrEqual(100)
})

test('D2: con la ronda abierta y sin conteos, dice que se actualizan cada 3 votos; la descripción del criterio va en su título', () => {
  const datos = { ...structuredClone(mock), sala: { ...mock.sala, estado: 'r1_abierta' as const } }
  datos.proyectos_vivos.forEach((p) => (p.rondas = p.rondas.filter((r) => r.ronda === 1).map((r) => ({ ...r, n_votos: 0, distribucion: null }))))
  render(<ComoVoto datos={datos} rondas={[1]} />)
  expect(screen.getByRole('status').textContent).toBe('Aún no hay resultados en la ronda 1. Se actualizan cada 3 votos nuevos.')
  cleanup()
  const { container } = render(<ComoVoto datos={mock} rondas={[1]} />)
  const reg = [...container.querySelectorAll('.hz-cv-crit')].find((p) => p.firstChild?.textContent === 'Regulación')!
  expect(reg.getAttribute('title')).toBe(DESCRIPCION_CRITERIO.regulacion)
})

// ── QA por roles (20-oct) ──

test('marcas «Dividido» (votos en 1 y 9, o 25 % en cada extremo) y «Se juntó» (un valor con 60 % en R2)', () => {
  const d = (a: number, b: number, c: number, e: number, f: number) => ({ '1': a, '3': b, '5': c, '7': e, '9': f })
  expect(marcaDistribucion(d(1, 0, 8, 0, 1), 1)).toBe('dividido')
  expect(marcaDistribucion(d(0, 3, 4, 3, 0), 1)).toBe('dividido')
  expect(marcaDistribucion(d(0, 2, 6, 2, 0), 1)).toBeNull()
  expect(marcaDistribucion(d(0, 1, 6, 3, 0), 2)).toBe('junto')
  // En R1 el consenso no se marca: «Se juntó» habla de lo que hizo la discusión.
  expect(marcaDistribucion(d(0, 1, 6, 3, 0), 1)).toBeNull()
  expect(marcaDistribucion(d(0, 0, 0, 0, 0), 2)).toBeNull()
  expect(marcaDistribucion(null, 1)).toBeNull()

  const datos: DatosTablero = structuredClone(mock)
  const [r1, r2] = [1, 2].map((n) => datos.proyectos_vivos[0].rondas.find((r) => r.ronda === n)!)
  r1.distribucion!.regulacion = d(3, 1, 0, 1, 3)
  r2.distribucion!.regulacion = d(0, 1, 6, 1, 0)
  const { container } = render(<ComoVoto datos={datos} rondas={[1, 2]} />)
  const proy = screen.getByRole('region', { name: datos.proyectos_vivos[0].nombre })
  const reg = [...proy.querySelectorAll('.hz-cv-crit')].find((p) => p.firstChild?.textContent === 'Regulación')!
  expect([...reg.querySelectorAll('.hz-cv-etq')].map((e) => e.textContent)).toEqual(['Dividido en R1', 'Se juntó en R2'])
  // Rótulos de la escala: «Valor» y «personas».
  expect(container.querySelector('.hz-cv-rotulos')!.textContent).toBe('Valor de 1 a 9; sobre cada barra, cuántas personas')
  cleanup()
  // Con una sola ronda, la marca sin la ronda.
  render(<ComoVoto datos={datos} rondas={[1]} />)
  const reg1 = [...screen.getByRole('region', { name: datos.proyectos_vivos[0].nombre }).querySelectorAll('.hz-cv-crit')].find((p) => p.firstChild?.textContent === 'Regulación')!
  expect([...reg1.querySelectorAll('.hz-cv-etq')].map((e) => e.textContent)).toEqual(['Dividido'])
})

test('ronda 1 oculta (tablero público con la ronda 1 abierta): sin barras y el aviso de cuándo se ve', () => {
  const datos: DatosTablero = { ...structuredClone(mock), sala: { ...mock.sala, estado: 'r1_abierta', ronda_actual: 1 } }
  datos.proyectos_vivos.forEach((p) => {
    p.rondas = [{ ronda: 1, n_votos: 9, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null, oculta: true }]
  })
  const { container } = render(<ComoVoto datos={datos} rondas={[1]} />)
  expect(screen.getByRole('status').textContent).toBe('Los resultados de la ronda 1 se muestran cuando todos voten o al cerrar la ronda.')
  expect(barras(container)).toHaveLength(0)
})
