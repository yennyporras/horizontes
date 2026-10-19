// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import tablero from '../../../mocks/GET_api_tablero.json'
import yoBase from '../../../mocks/GET_api_yo.json'
import { cifra } from '../Comun'
import { MIN_VOTOS, ResultadoAlcance } from '../pantallas/Resultado'
import type { Resultados, Yo } from '../api'

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const yo = yoBase as unknown as Yo

afterEach(cleanup)

describe('resultado del alcance', () => {
  it('cifras con 2 decimales y coma, como el tablero (triage #11)', () => {
    expect(cifra(6.6)).toBe('6,60')
    expect(cifra(5)).toBe('5,00')
    expect(cifra(6.689)).toBe('6,69')
    expect(cifra(null)).toBe('sin dato')
  })

  /** Mock con el campo `total` que calcula el servidor (R4_CONTRATO C1). Valores a propósito distintos de eje X + eje Y. */
  const conTotal = () => {
    const r = clonar(tablero) as unknown as Resultados
    for (const p of r.proyectos_vivos) for (const x of p.rondas) x.total = 10 + x.ronda / 8
    return r
  }

  it('tabla con los 6 criterios y la fila Total del servidor, sin ejes, T2M ni votos (acta A3, A4)', () => {
    const { container } = render(<ResultadoAlcance resultados={conTotal()} criterios={yo.criterios} alcance="mesa" />)
    const tabla = screen.getAllByRole('table')[0]
    const filas = within(tabla).getAllByRole('rowheader').map((th) => th.textContent)
    expect(filas).toEqual([...yo.criterios.map((c) => c.nombre), 'Total'])
    // Total = el campo del servidor con 2 decimales, nunca recalculado en el celular.
    const total = within(tabla).getByRole('rowheader', { name: 'Total' }).closest('tr')!
    expect([...total.querySelectorAll('td')].map((td) => td.textContent)).toEqual(['10,13', '10,25'])
    for (const td of screen.getAllByRole('cell')) expect(td.textContent).toMatch(/^\d+,\d{2}$/)
    // La matriz sigue con sus ejes; la tabla y el pie de cada proyecto ya no los nombran.
    for (const a of container.querySelectorAll('.hzp-resultado__proyecto'))
      expect(a.textContent).not.toMatch(/Eje X|Eje Y|Time 2 Market|Value Generation|T2M|calificaciones en la ronda|votos en la ronda/i)
  })

  it('R1 y R2 con su texto y su forma: hueco verde y sólido rojo (acta A7, P3)', () => {
    render(<ResultadoAlcance resultados={conTotal()} criterios={yo.criterios} alcance="mesa" />)
    const tabla = screen.getAllByRole('table')[0]
    expect(within(tabla).getByRole('columnheader', { name: 'R1' }).querySelector('.hz-insignia--r1')).toBeTruthy()
    expect(within(tabla).getByRole('columnheader', { name: 'R2' }).querySelector('.hz-insignia--r2')).toBeTruthy()
  })

  it(`con menos de ${MIN_VOTOS} calificaciones no muestra respuestas individuales (triage #1)`, () => {
    const r = clonar(tablero) as unknown as Resultados
    for (const p of r.proyectos_vivos) for (const x of p.rondas) x.n_votos = 2
    const { container } = render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="mesa" />)
    expect(screen.getByText(/^Hace falta al menos 3 votos para mostrar estos resultados\./)).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('.hzp-matriz')).toBeNull()
  })

  it('oculta solo el proyecto o la ronda con menos de MIN_VOTOS calificaciones', () => {
    const r = clonar(tablero) as unknown as Resultados
    const [a, b] = r.proyectos_vivos
    for (const x of a.rondas) x.n_votos = 2
    for (const x of b.rondas) if (x.ronda === 2) x.n_votos = 2
    render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="mesa" />)
    expect(screen.getByText('Hace falta al menos 3 votos para mostrar este proyecto.')).toBeTruthy()
    expect(screen.getByText('Ronda 2: hace falta al menos 3 votos para mostrarla.')).toBeTruthy()
    // Solo queda la tabla de b con su ronda 1: una sola columna de datos, R1.
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(screen.getByRole('columnheader', { name: 'R1' })).toBeTruthy()
    expect(screen.queryByRole('columnheader', { name: 'R2' })).toBeNull()
  })

  it('respeta bajo_minimo y minimo_votos del servidor', () => {
    const r = conTotal()
    r.minimo_votos = 5
    for (const p of r.proyectos_vivos) for (const x of p.rondas) x.n_votos = 4
    const { container } = render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="sala" />)
    expect(screen.getByText(/^Hace falta al menos 5 votos para mostrar estos resultados\./)).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
    cleanup()
    const s = conTotal()
    for (const x of s.proyectos_vivos[0].rondas) x.bajo_minimo = true
    render(<ResultadoAlcance resultados={s} criterios={yo.criterios} alcance="sala" />)
    expect(screen.getAllByRole('table')).toHaveLength(1)
  })
})
