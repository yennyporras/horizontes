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

  it('tabla con solo los 6 criterios: sin fila Total (preentrega 19-oct), ejes, T2M ni votos (acta A3, A4)', () => {
    // Aunque el servidor envíe `total`, el celular ya no lo muestra.
    const { container } = render(<ResultadoAlcance resultados={conTotal()} criterios={yo.criterios} alcance="mesa" />)
    const tabla = screen.getAllByRole('table')[0]
    const filas = within(tabla).getAllByRole('rowheader').map((th) => th.textContent)
    expect(filas).toEqual(yo.criterios.map((c) => c.nombre))
    expect(within(tabla).queryByRole('rowheader', { name: 'Total' })).toBeNull()
    expect(container.textContent).not.toMatch(/Total|10,13|10,25/)
    expect(screen.getAllByRole('cell')).toHaveLength(screen.getAllByRole('table').length * yo.criterios.length * 2)
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

  it('«Tu calificación» por criterio y ronda junto al promedio, solo con tus votos (C19-3, P3)', () => {
    const r = conTotal()
    const misVotos = [
      { proyecto_id: 'insumex', ronda: 1, respuestas: Object.fromEntries(yo.criterios.map((c, i) => [c.id, [1, 3, 5, 7, 9, 9][i]])) },
      { proyecto_id: 'insumex', ronda: 2, respuestas: Object.fromEntries(yo.criterios.map((c) => [c.id, 5])) },
    ]
    render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="mesa" misVotos={misVotos} />)
    const [insumex, nutriwhat] = screen.getAllByRole('table')
    const fila = within(insumex).getByRole('rowheader', { name: yo.criterios[2].nombre }).closest('tr')!
    const celdas = [...fila.querySelectorAll('td')]
    // R1: el promedio del servidor con 2 decimales y debajo tu 5; R2: tu 5 también.
    expect(celdas.map((td) => td.querySelector('.hzp-tabla__promedio')!.textContent)).toEqual(
      r.proyectos_vivos[0].rondas.map((x) => cifra(x.promedios![yo.criterios[2].id])),
    )
    expect(celdas.map((td) => td.querySelector('.hzp-tabla__mia')?.textContent)).toEqual(['Tu calificación: Tú 5', 'Tu calificación: Tú 5'])
    expect(within(insumex).getAllByText('Tu calificación:', { exact: false })).toHaveLength(12)
    expect(screen.getByText('Debajo de cada promedio va tu calificación (Tú). Solo la ves en tu celular.')).toBeTruthy()
    // En NUTRIWHAT no votaste: nada tuyo.
    expect(within(nutriwhat).queryByText(/Tu calificación/)).toBeNull()
  })

  it('sin votos propios la tabla queda igual: solo promedios', () => {
    render(<ResultadoAlcance resultados={conTotal()} criterios={yo.criterios} alcance="mesa" misVotos={[]} />)
    expect(screen.queryByText(/Tu calificación/)).toBeNull()
    for (const td of screen.getAllByRole('cell')) expect(td.textContent).toMatch(/^\d+,\d{2}$/)
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
