// Zoom de la matriz (C19-6, T1). Vectorial: cambia el viewBox del SVG, así el texto no se pixela y la
// geometría (cx, cy, animación R1 → R2) sigue igual. Todo en fracciones del lienzo para que un cambio
// de tamaño o un redibujo del polling conserven el encuadre.
import { useCallback, useEffect, useRef, useState } from 'react'

/** k = aumento (1 = vista completa); cx, cy = centro visible en fracción del ancho y del alto (0 a 1). */
export interface Encuadre {
  k: number
  cx: number
  cy: number
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 5
export const PASO_ZOOM = 1.5
export const VISTA_COMPLETA: Encuadre = { k: 1, cx: 0.5, cy: 0.5 }

const acotar = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/** Aumento entre 1 y 5 y ventana siempre dentro del lienzo. */
export function ajustar(e: Encuadre): Encuadre {
  const k = acotar(e.k, ZOOM_MIN, ZOOM_MAX)
  const m = 1 / (2 * k)
  return { k, cx: acotar(e.cx, m, 1 - m), cy: acotar(e.cy, m, 1 - m) }
}

/**
 * Multiplica el aumento dejando quieto el punto (px, py) de la pantalla, en fracción del área visible
 * (0,5 y 0,5 = el centro). Es lo que hacen la rueda y el pellizco.
 */
export function acercarEn(e: Encuadre, factor: number, px = 0.5, py = 0.5): Encuadre {
  const k = acotar(e.k * factor, ZOOM_MIN, ZOOM_MAX)
  // Punto del lienzo bajo el cursor, antes y después: el mismo.
  const fx = e.cx + (px - 0.5) / e.k
  const fy = e.cy + (py - 0.5) / e.k
  return ajustar({ k, cx: fx - (px - 0.5) / k, cy: fy - (py - 0.5) / k })
}

/** Desplaza la vista; dx y dy en fracción del área visible (arrastrar a la derecha muestra lo de la izquierda). */
export function mover(e: Encuadre, dx: number, dy: number): Encuadre {
  return ajustar({ k: e.k, cx: e.cx - dx / e.k, cy: e.cy - dy / e.k })
}

/** viewBox del SVG de ancho W y alto H para el encuadre. */
export function viewBoxDe(e: Encuadre, W: number, H: number): string {
  const w = W / e.k
  const h = H / e.k
  const r = (n: number) => Math.round(n * 100) / 100
  return `${r(e.cx * W - w / 2)} ${r(e.cy * H - h / 2)} ${r(w)} ${r(h)}`
}

export type AccionZoom = 'acercar' | 'alejar' | 'ver_todo' | 'izquierda' | 'derecha' | 'arriba' | 'abajo'

/** Acción de teclado o botón sobre el encuadre. Las flechas mueven un cuarto de la vista. */
export function aplicarAccion(e: Encuadre, a: AccionZoom): Encuadre {
  switch (a) {
    case 'acercar':
      return acercarEn(e, PASO_ZOOM)
    case 'alejar':
      return acercarEn(e, 1 / PASO_ZOOM)
    case 'ver_todo':
      return VISTA_COMPLETA
    case 'izquierda':
      return mover(e, 0.25, 0)
    case 'derecha':
      return mover(e, -0.25, 0)
    case 'arriba':
      return mover(e, 0, 0.25)
    case 'abajo':
      return mover(e, 0, -0.25)
  }
}

/**
 * Rueda, pellizco, arrastre y doble clic sobre `el` (el lienzo de la matriz; null mientras no está montado).
 * Los botones que estén dentro no inician arrastre.
 */
export function useZoomMatriz(el: HTMLElement | null) {
  const [encuadre, setEncuadre] = useState<Encuadre>(VISTA_COMPLETA)
  const actual = useRef(encuadre)
  actual.current = encuadre

  const accion = useCallback((a: AccionZoom) => {
    const nuevo = aplicarAccion(actual.current, a)
    const cambia = nuevo.k !== actual.current.k || nuevo.cx !== actual.current.cx || nuevo.cy !== actual.current.cy
    if (cambia) setEncuadre(nuevo)
    return cambia
  }, [])

  useEffect(() => {
    if (!el) return
    const area = () => (el.querySelector('svg') ?? el).getBoundingClientRect()
    const relativo = (x: number, y: number) => {
      const b = area()
      return { px: b.width ? (x - b.left) / b.width : 0.5, py: b.height ? (y - b.top) / b.height : 0.5 }
    }

    const rueda = (ev: WheelEvent) => {
      const delta = ev.deltaY * (ev.deltaMode === 1 ? 16 : ev.deltaMode === 2 ? 400 : 1)
      // En la vista completa, rodar hacia abajo sigue desplazando la página.
      if (delta > 0 && actual.current.k <= ZOOM_MIN) return
      ev.preventDefault()
      const { px, py } = relativo(ev.clientX, ev.clientY)
      setEncuadre((e) => acercarEn(e, Math.exp(-delta * 0.0025), px, py))
    }

    const punteros = new Map<number, { x: number; y: number }>()
    const bajar = (ev: PointerEvent) => {
      if ((ev.target as Element).closest('button, a, input, select, summary')) return
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      el.setPointerCapture?.(ev.pointerId)
      if (actual.current.k > ZOOM_MIN || punteros.size > 1) el.classList.add('hz-arrastrando')
    }
    const moverPuntero = (ev: PointerEvent) => {
      const antes = punteros.get(ev.pointerId)
      if (!antes) return
      const b = area()
      if (!b.width || !b.height) return
      if (punteros.size === 1) {
        punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
        if (actual.current.k > ZOOM_MIN) setEncuadre((e) => mover(e, (ev.clientX - antes.x) / b.width, (ev.clientY - antes.y) / b.height))
        return
      }
      // Pellizco: el aumento sigue la distancia entre los dos dedos y el punto medio queda quieto.
      const otro = [...punteros].find(([id]) => id !== ev.pointerId)?.[1]
      punteros.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
      if (!otro) return
      const d0 = Math.hypot(antes.x - otro.x, antes.y - otro.y)
      const d1 = Math.hypot(ev.clientX - otro.x, ev.clientY - otro.y)
      if (d0 > 0) {
        const { px, py } = relativo((ev.clientX + otro.x) / 2, (ev.clientY + otro.y) / 2)
        setEncuadre((e) => acercarEn(e, d1 / d0, px, py))
      }
    }
    const soltar = (ev: PointerEvent) => {
      punteros.delete(ev.pointerId)
      if (!punteros.size) el.classList.remove('hz-arrastrando')
    }
    const dobleClic = (ev: MouseEvent) => {
      if ((ev.target as Element).closest('button, a, input, select, summary')) return
      const { px, py } = relativo(ev.clientX, ev.clientY)
      setEncuadre((e) => acercarEn(e, 2, px, py))
    }

    el.addEventListener('wheel', rueda, { passive: false })
    el.addEventListener('pointerdown', bajar)
    el.addEventListener('pointermove', moverPuntero)
    el.addEventListener('pointerup', soltar)
    el.addEventListener('pointercancel', soltar)
    el.addEventListener('dblclick', dobleClic)
    return () => {
      el.removeEventListener('wheel', rueda)
      el.removeEventListener('pointerdown', bajar)
      el.removeEventListener('pointermove', moverPuntero)
      el.removeEventListener('pointerup', soltar)
      el.removeEventListener('pointercancel', soltar)
      el.removeEventListener('dblclick', dobleClic)
    }
  }, [el])

  return { encuadre, accion }
}
