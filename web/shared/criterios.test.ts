import { describe, expect, test } from 'vitest'
import { CRITERIOS } from '../../shared/motor/motor'
import seed from '../../data/seed_foodsume.json'
import { DESCRIPCION_CRITERIO, LARGO_MAXIMO_DESCRIPCION, LECTURA_EJES, LECTURA_ESCALA, NOMBRE_CORTO, descripcionCriterio, nombreCortoCriterio } from './criterios'

describe('descripción corta de cada criterio', () => {
  test('una por cada criterio del motor, de 100 caracteres o menos, sin rayas', () => {
    expect(Object.keys(DESCRIPCION_CRITERIO).sort()).toEqual([...CRITERIOS].sort())
    for (const [id, texto] of Object.entries(DESCRIPCION_CRITERIO)) {
      expect(texto.length, id).toBeLessThanOrEqual(LARGO_MAXIMO_DESCRIPCION)
      expect(texto.trim().length, id).toBeGreaterThan(0)
      expect(texto, id).not.toMatch(/—/)
    }
    expect(LARGO_MAXIMO_DESCRIPCION).toBe(100)
  })

  test('cada descripción nombra los dos polos de la escala, en el sentido de la rúbrica (1 cerca, 9 lejos)', () => {
    // QA por roles del 20-oct: la versión anterior («Qué tan lista…», «Qué tan cerca…») se leía al revés.
    for (const [id, texto] of Object.entries(DESCRIPCION_CRITERIO)) {
      expect(texto, id).toMatch(/ 1: /)
      expect(texto, id).toMatch(/ 9: /)
    }
    const rubrica = (id: string, v: number) => seed.motor.criterios.find((c) => c.id === id)!.rubrica.find((r) => r.valor === v)!.texto
    expect(rubrica('alistamiento_tecnico', 9)).toMatch(/Idea/)
    expect(DESCRIPCION_CRITERIO.alistamiento_tecnico).toMatch(/9: apenas una idea/)
    expect(rubrica('alineacion_core', 9)).toMatch(/lejano|ajeno/)
    expect(DESCRIPCION_CRITERIO.alineacion_core).toMatch(/9: negocio ajeno/)
    expect(rubrica('regulacion', 1)).toMatch(/no regulado/)
    expect(DESCRIPCION_CRITERIO.regulacion).toMatch(/1: mercado no regulado/)
    expect(descripcionCriterio('otro')).toBeNull()
  })

  test('nombres cortos únicos y lecturas de escala y ejes, sin rayas', () => {
    expect(Object.keys(NOMBRE_CORTO).sort()).toEqual([...CRITERIOS].sort())
    expect(NOMBRE_CORTO.inversion_requerida).toBe('Inversión para probar')
    expect(nombreCortoCriterio('otro', 'Otro criterio')).toBe('Otro criterio')
    for (const t of [LECTURA_ESCALA, LECTURA_EJES]) expect(t).not.toMatch(/[—–]/)
  })
})
