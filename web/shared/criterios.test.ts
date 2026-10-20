import { describe, expect, test } from 'vitest'
import { CRITERIOS } from '../../shared/motor/motor'
import { DESCRIPCION_CRITERIO, LARGO_MAXIMO_DESCRIPCION, descripcionCriterio } from './criterios'

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

  test('textos aprobados y búsqueda por id', () => {
    expect(DESCRIPCION_CRITERIO.regulacion).toBe('Qué tantas barreras legales o normativas hay para entrar al mercado.')
    expect(descripcionCriterio('alineacion_core')).toBe('Qué tan cerca está el nuevo negocio del core actual de la organización.')
    expect(descripcionCriterio('otro')).toBeNull()
  })
})
