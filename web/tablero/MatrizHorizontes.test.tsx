// @vitest-environment jsdom
// Contrato de MatrizHorizontes para otras áreas (celular): solo props, sin fetch, sin parpadeo.
import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, render } from '@testing-library/react'
import mockJson from '../../mocks/GET_api_tablero.json'
import { MatrizHorizontes, insigniaResultado, mensajeVacio } from './index'
import type { DatosTablero } from './index'

const mock = mockJson as unknown as DatosTablero

afterEach(cleanup)

describe('MatrizHorizontes', () => {
  test('no pide datos: dibuja lo que recibe', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    const { container } = render(<MatrizHorizontes datos={mock} />)
    expect(f).not.toHaveBeenCalled()
    expect(container.querySelectorAll('svg.hz-matriz circle.hz-fijo')).toHaveLength(mock.proyectos_fijos.length)
    vi.unstubAllGlobals()
  })

  test('sin datos dibuja ejes y horizontes vacíos', () => {
    const { container } = render(<MatrizHorizontes datos={null} />)
    expect(container.querySelector('svg.hz-matriz')).not.toBeNull()
    expect(container.querySelectorAll('circle.hz-r1, circle.hz-r2')).toHaveLength(0)
  })

  test('vista 1 solo R1, vista 2 solo R2, comparación las dos con flecha', () => {
    const conAmbas = mock.proyectos_vivos.filter((v) => v.rondas.filter((r) => r.n_votos > 0 && r.eje_x != null).length === 2).length
    const r = render(<MatrizHorizontes datos={mock} vista={1} />)
    expect(r.container.querySelectorAll('circle.hz-r2')).toHaveLength(0)
    expect(r.container.querySelectorAll('circle.hz-r1').length).toBeGreaterThan(0)
    r.rerender(<MatrizHorizontes datos={mock} vista={2} />)
    expect(r.container.querySelectorAll('circle.hz-r1')).toHaveLength(0)
    r.rerender(<MatrizHorizontes datos={mock} vista="comparacion" animarComparacion={false} />)
    expect(r.container.querySelectorAll('circle.hz-r1').length).toBeGreaterThan(0)
    expect(r.container.querySelectorAll('circle.hz-r2').length).toBeGreaterThan(0)
    expect(r.container.querySelectorAll('.hz-flecha').length).toBeLessThanOrEqual(conAmbas)
  })

  test('mismos datos en un objeto nuevo (polling sin 304): el <svg> no se reemplaza', () => {
    const r = render(<MatrizHorizontes datos={mock} vista={2} />)
    const antes = r.container.querySelector('svg')
    r.rerender(<MatrizHorizontes datos={structuredClone(mock)} vista={2} />)
    expect(r.container.querySelector('svg')).toBe(antes)
  })

  test('al pasar a Comparación anima desde el primer render y un redibujo a mitad de camino continúa sin reiniciar', () => {
    vi.useFakeTimers()
    const reloj = vi.spyOn(performance, 'now').mockReturnValue(1000)
    const r = render(<MatrizHorizontes datos={mock} vista={2} alto={600} />)
    expect(r.container.querySelector('.hz-anim-mov')).toBeNull()
    r.rerender(<MatrizHorizontes datos={mock} vista="comparacion" alto={600} />)
    expect(r.container.querySelector('.hz-anim-mov')).not.toBeNull()
    expect(r.container.querySelector('style')!.textContent).toContain('hzMover 1.2s cubic-bezier(.22,.8,.3,1) 0ms both')
    // 400 ms después el encabezado cambia de alto: el SVG nuevo sigue la animación en 400 ms.
    reloj.mockReturnValue(1400)
    r.rerender(<MatrizHorizontes datos={mock} vista="comparacion" alto={604} />)
    expect(r.container.querySelector('svg')!.getAttribute('height')).toBe('604')
    expect(r.container.querySelector('style')!.textContent).toContain('cubic-bezier(.22,.8,.3,1) -400ms both')
    expect(r.container.querySelector('style')!.textContent).toContain('ease-out 500ms both')
    // Al terminar se redibuja quieta.
    act(() => vi.advanceTimersByTime(1600))
    expect(r.container.querySelector('.hz-anim-mov')).toBeNull()
    reloj.mockRestore()
    vi.useRealTimers()
  })

  test('zoom: el encuadre cambia solo el viewBox (mismo nodo, texto vectorial) y se conserva con datos nuevos', () => {
    const r = render(<MatrizHorizontes datos={mock} vista={2} alto={600} />)
    const svg = r.container.querySelector('svg')!
    const W = svg.getAttribute('width')
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${W} 600`)
    r.rerender(<MatrizHorizontes datos={mock} vista={2} alto={600} encuadre={{ k: 2, cx: 0.5, cy: 0.5 }} />)
    expect(r.container.querySelector('svg')).toBe(svg)
    expect(svg.getAttribute('viewBox')).toBe(`${Number(W) / 4} 150 ${Number(W) / 2} 300`)
    expect(svg.getAttribute('width')).toBe(W)
    // El polling trae un voto nuevo: SVG nuevo, mismo encuadre.
    const otro = structuredClone(mock)
    otro.version = 'v-nueva'
    otro.proyectos_vivos[0].rondas[1].eje_x = 4.2
    r.rerender(<MatrizHorizontes datos={otro} vista={2} alto={600} encuadre={{ k: 2, cx: 0.5, cy: 0.5 }} />)
    expect(r.container.querySelector('svg')).not.toBe(svg)
    expect(r.container.querySelector('svg')!.getAttribute('viewBox')).toBe(`${Number(W) / 4} 150 ${Number(W) / 2} 300`)
  })

  test('alto fijo y clase extra', () => {
    const { container } = render(<MatrizHorizontes datos={mock} alto={400} className="mi-matriz" />)
    expect(container.querySelector('.hz-matriz-contenedor.mi-matriz')).not.toBeNull()
    expect(container.querySelector('svg')!.getAttribute('height')).toBe('400')
  })

  test('ayudas exportadas para la pantalla del participante', () => {
    expect(mensajeVacio(null, 1)).toBe('Aún no hay votos en la ronda 1')
    expect(['preliminar', 'en_vivo', null]).toContain(insigniaResultado(mock))
  })
})
