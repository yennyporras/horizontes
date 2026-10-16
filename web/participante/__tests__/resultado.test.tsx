// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import tablero from '../../../mocks/GET_api_tablero.json'
import yoBase from '../../../mocks/GET_api_yo.json'
import { cifra } from '../Comun'
import { MIN_VOTOS, nombreEje, ResultadoAlcance } from '../pantallas/Resultado'
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

  it('ejes con el mismo nombre que el tablero (triage #11)', () => {
    expect(nombreEje('X', 'TIME 2 MARKET')).toBe('Eje X (Time 2 Market)')
    expect(nombreEje('Y', 'VALUE GENERATION CAPACITY')).toBe('Eje Y (Value Generation Capacity)')
  })

  it('muestra posición y criterios con 2 decimales', () => {
    const r = clonar(tablero) as unknown as Resultados
    render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="mesa" />)
    expect(screen.getAllByRole('rowheader', { name: /^Eje X \(/ }).length).toBeGreaterThan(0)
    for (const td of screen.getAllByRole('cell')) expect(td.textContent).toMatch(/^\d+,\d{2}$/)
  })

  it(`con menos de ${MIN_VOTOS} calificaciones no muestra respuestas individuales (triage #1)`, () => {
    const r = clonar(tablero) as unknown as Resultados
    for (const p of r.proyectos_vivos) for (const x of p.rondas) x.n_votos = 1
    const { container } = render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="mesa" />)
    expect(screen.getByText(/Hacen falta al menos 2 calificaciones en tu mesa/)).toBeTruthy()
    expect(container.querySelector('table')).toBeNull()
    expect(container.querySelector('.hzp-matriz')).toBeNull()
  })

  it('oculta solo el proyecto o la ronda con 1 calificación', () => {
    const r = clonar(tablero) as unknown as Resultados
    const [a, b] = r.proyectos_vivos
    for (const x of a.rondas) x.n_votos = 1
    for (const x of b.rondas) if (x.ronda === 2) x.n_votos = 1
    render(<ResultadoAlcance resultados={r} criterios={yo.criterios} alcance="mesa" />)
    expect(screen.getByText('Hacen falta al menos 2 calificaciones para mostrar este proyecto.')).toBeTruthy()
    expect(screen.getByText(/Ronda 2: hacen falta al menos 2 calificaciones para mostrarla/)).toBeTruthy()
    // Solo queda la tabla de b con su ronda 1: una columna de datos, encabezada "Promedio".
    expect(screen.getAllByRole('table')).toHaveLength(1)
    expect(screen.getByRole('columnheader', { name: 'Promedio' })).toBeTruthy()
  })
})
