import { describe, expect, test } from 'vitest'
import { ENTERA, ZOOM_MAX, acercarEn, ajustar, desplazar, esEntera, factorRueda, puntoEn, viewBoxDe } from './zoom'

describe('zoom de la matriz', () => {
  test('acerca dejando quieto el punto bajo el puntero', () => {
    const e = acercarEn(ENTERA, 2, 0.5, 0.5)
    expect(e).toEqual({ k: 2, x: 0.25, y: 0.25 })
    // En una esquina: lo de la esquina sigue en la esquina.
    const esquina = acercarEn(ENTERA, 2, 1, 0)
    expect(esquina).toEqual({ k: 2, x: 0.5, y: 0 })
    // El punto bajo el puntero (fracción 0,3 de la caja) es el mismo antes y después.
    const a = { k: 1.5, x: 0.1, y: 0.2 }
    const antes = puntoEn(a, 0.3, 0.7)
    const despues = acercarEn(a, 1.6, antes.x, antes.y)
    const p = puntoEn(despues, 0.3, 0.7)
    expect(p.x).toBeCloseTo(antes.x, 9)
    expect(p.y).toBeCloseTo(antes.y, 9)
  })

  test('de 1× a 4×: no aleja más allá de la matriz entera ni acerca más de 4×', () => {
    expect(acercarEn(ENTERA, 0.5, 0.5, 0.5)).toEqual(ENTERA)
    expect(acercarEn({ k: 3, x: 0.2, y: 0.2 }, 10, 0.5, 0.5).k).toBe(ZOOM_MAX)
    expect(ajustar({ k: Number.NaN, x: 0.3, y: 0.3 })).toEqual(ENTERA)
    expect(esEntera(ENTERA)).toBe(true)
    expect(esEntera({ k: 1.2, x: 0, y: 0 })).toBe(false)
  })

  test('arrastrar mueve solo con zoom y sin salirse del lienzo', () => {
    expect(desplazar(ENTERA, 0.3, 0.3)).toEqual(ENTERA)
    const e = { k: 2, x: 0.25, y: 0.25 }
    // Arrastrar media caja a la derecha muestra un cuarto del lienzo más a la izquierda.
    expect(desplazar(e, 0.5, 0)).toEqual({ k: 2, x: 0, y: 0.25 })
    expect(desplazar(e, -5, -5)).toEqual({ k: 2, x: 0.5, y: 0.5 })
  })

  test('rueda: hacia arriba acerca, hacia abajo aleja; líneas y páginas cuentan como píxeles', () => {
    expect(factorRueda(-100)).toBeGreaterThan(1)
    expect(factorRueda(100)).toBeLessThan(1)
    expect(factorRueda(-3, 1)).toBeCloseTo(factorRueda(-99), 9)
    // Un salto enorme del panel táctil se limita.
    expect(factorRueda(-100000)).toBe(factorRueda(-300))
  })

  test('viewBox: misma proporción del lienzo, dentro de él', () => {
    expect(viewBoxDe(ENTERA, 1600, 900)).toBe('0 0 1600 900')
    expect(viewBoxDe({ k: 2, x: 0.25, y: 0.5 }, 1600, 900)).toBe('400 450 800 450')
    expect(viewBoxDe({ k: 4, x: 2, y: -1 }, 1000, 1000)).toBe('750 0 250 250')
  })
})
