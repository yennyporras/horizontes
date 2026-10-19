import { describe, expect, test } from 'vitest'
import { VISTA_COMPLETA, ZOOM_MAX, acercarEn, ajustar, aplicarAccion, mover, viewBoxDe } from './zoom'
import { accionDeTecla } from './usePantallaCompleta'

/** Punto del lienzo (fracción) que se ve en (px, py) de la pantalla con el encuadre e. */
const puntoBajo = (e: { k: number; cx: number; cy: number }, px: number, py: number) => [e.cx + (px - 0.5) / e.k, e.cy + (py - 0.5) / e.k]

describe('zoom de la matriz', () => {
  test('vista completa = viewBox del SVG tal cual', () => {
    expect(viewBoxDe(VISTA_COMPLETA, 800, 600)).toBe('0 0 800 600')
  })

  test('acercar en un punto deja ese punto quieto bajo el cursor', () => {
    const e = acercarEn(VISTA_COMPLETA, 2, 0.75, 0.25)
    expect(e.k).toBe(2)
    const [x, y] = puntoBajo(e, 0.75, 0.25)
    expect(x).toBeCloseTo(0.75, 10)
    expect(y).toBeCloseTo(0.25, 10)
    expect(viewBoxDe(e, 800, 600)).toBe('300 75 400 300')
  })

  test('aumento entre 1 y 5 y la ventana nunca sale del lienzo', () => {
    expect(acercarEn(VISTA_COMPLETA, 100).k).toBe(ZOOM_MAX)
    expect(acercarEn(VISTA_COMPLETA, 0.1)).toEqual(VISTA_COMPLETA)
    expect(ajustar({ k: 2, cx: 0.99, cy: -1 })).toEqual({ k: 2, cx: 0.75, cy: 0.25 })
    // Sin zoom no hay nada que mover.
    expect(mover(VISTA_COMPLETA, 0.3, 0.3)).toEqual(VISTA_COMPLETA)
    // Alejar desde una esquina vuelve a encuadrar dentro.
    const esquina = { k: 4, cx: 0.875, cy: 0.875 }
    const lejos = acercarEn(esquina, 0.5, 1, 1)
    expect(lejos.k).toBe(2)
    expect(lejos.cx).toBeLessThanOrEqual(0.75)
  })

  test('arrastrar a la derecha muestra lo que está a la izquierda', () => {
    const e = mover({ k: 2, cx: 0.5, cy: 0.5 }, 0.2, -0.2)
    expect(e.cx).toBeCloseTo(0.4, 10)
    expect(e.cy).toBeCloseTo(0.6, 10)
  })

  test('acciones de botones y teclas', () => {
    const cerca = aplicarAccion(VISTA_COMPLETA, 'acercar')
    expect(cerca.k).toBe(1.5)
    expect(aplicarAccion(cerca, 'alejar')).toEqual(VISTA_COMPLETA)
    expect(aplicarAccion({ k: 3, cx: 0.4, cy: 0.6 }, 'ver_todo')).toEqual(VISTA_COMPLETA)
    expect(aplicarAccion({ k: 2, cx: 0.5, cy: 0.5 }, 'derecha').cx).toBeGreaterThan(0.5)
    expect(aplicarAccion({ k: 2, cx: 0.5, cy: 0.5 }, 'arriba').cy).toBeLessThan(0.5)
  })

  test('teclas +, −, 0 y flechas; las demás siguen igual', () => {
    expect(accionDeTecla('+')).toEqual({ tipo: 'zoom', zoom: 'acercar' })
    expect(accionDeTecla('=')).toEqual({ tipo: 'zoom', zoom: 'acercar' })
    expect(accionDeTecla('-')).toEqual({ tipo: 'zoom', zoom: 'alejar' })
    expect(accionDeTecla('0')).toEqual({ tipo: 'zoom', zoom: 'ver_todo' })
    expect(accionDeTecla('ArrowLeft')).toEqual({ tipo: 'zoom', zoom: 'izquierda' })
    expect(accionDeTecla('c')).toEqual({ tipo: 'vista', vista: 'comparacion' })
    expect(accionDeTecla('x')).toBeNull()
  })
})
