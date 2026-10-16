import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CRITERIOS, type Entradas, PESOS_CANONICOS, agregar, calcularPunto, calcularT2m } from '../../shared/motor/motor'

const golden = JSON.parse(readFileSync(resolve(__dirname, '../golden/motor_golden.json'), 'utf8'))
const semilla = JSON.parse(readFileSync(resolve(__dirname, '../../data/seed_foodsume.json'), 'utf8'))
const EXACTA = 1e-9

describe('motor · golden', () => {
  it('los pesos de la semilla son los canónicos', () => {
    expect(semilla.motor.pesos).toEqual(PESOS_CANONICOS)
  })

  type CasoFijo = { nombre: string; inputs: Entradas; esperado: { t2m: number; eje_x: number; eje_y: number } }
  it.each(golden.casos_proyecto as CasoFijo[])('fijo $nombre (tolerancia 1e-9)', (caso) => {
    const p = calcularPunto(caso.inputs, semilla.motor.pesos)
    expect(Math.abs(p.t2m - caso.esperado.t2m)).toBeLessThan(EXACTA)
    expect(Math.abs(p.eje_x - caso.esperado.eje_x)).toBeLessThan(EXACTA)
    expect(Math.abs(p.eje_y - caso.esperado.eje_y)).toBeLessThan(EXACTA)
  })

  it('caso Nicolai: solo T2M (tolerancia 1e-9)', () => {
    const c = golden.caso_nicolai
    expect(Math.abs(calcularT2m(c.inputs, semilla.motor.pesos) - c.esperado_t2m)).toBeLessThan(EXACTA)
  })

  it('prueba sintética: 80 votos promediados por criterio (tolerancia 0,001)', () => {
    const ps = golden.prueba_sintetica
    for (const [nombre, porRonda] of Object.entries(ps.esperado as Record<string, Record<string, Record<string, unknown>>>)) {
      for (const [ronda, esp] of Object.entries(porRonda)) {
        const votos = (ps.votos as Record<string, unknown>[])
          .filter((v) => String(v.proyecto).toLowerCase() === nombre.toLowerCase() && String(v.ronda) === ronda)
          .map((v) => Object.fromEntries(CRITERIOS.map((k) => [k, v[k] as number])) as Entradas)
        const a = agregar(votos, semilla.motor.pesos)!
        expect(a.n_votos).toBe(esp.n)
        for (const k of CRITERIOS) expect(Math.abs(a.promedios[k] - (esp.promedio_por_criterio as Entradas)[k])).toBeLessThan(golden.tolerancia)
        expect(Math.abs(a.t2m - (esp.t2m as number))).toBeLessThan(golden.tolerancia)
        expect(Math.abs(a.eje_x - (esp.eje_x as number))).toBeLessThan(golden.tolerancia)
        expect(Math.abs(a.eje_y - (esp.eje_y as number))).toBeLessThan(golden.tolerancia)
      }
    }
  })

  it('sin votos el agregado es null (el punto no se dibuja)', () => {
    expect(agregar([])).toBeNull()
  })

  it('distribución cuenta 1-3-5-7-9 por criterio', () => {
    const v = Object.fromEntries(CRITERIOS.map((k) => [k, 3])) as Entradas
    const a = agregar([v, { ...v, regulacion: 9 }])!
    expect(a.distribucion.regulacion).toEqual({ '1': 0, '3': 1, '5': 0, '7': 0, '9': 1 })
    expect(a.promedios.regulacion).toBe(6)
  })
})
