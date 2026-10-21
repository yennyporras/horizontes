/**
 * Zoom de la matriz (pedido de Paola, 21-oct): de 1× a 4×, centrado en el puntero, con arrastre cuando hay zoom. Es
 * vectorial: cambia el `viewBox` del SVG, así la letra se ve nítida. El encuadre va en fracciones del lienzo (0 a 1),
 * así sobrevive a un cambio de tamaño (entrar o salir de la pantalla completa) y al redibujo con cada foto de votos.
 */
export interface Encuadre {
  /** Aumento: 1 es la matriz entera. */
  k: number
  /** Esquina superior izquierda de lo visible, en fracción del ancho y del alto del lienzo. */
  x: number
  y: number
}

export const ZOOM_MIN = 1
export const ZOOM_MAX = 4
export const ENTERA: Encuadre = { k: 1, x: 0, y: 0 }

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

/** Mantiene lo visible dentro del lienzo. */
export function ajustar(e: Encuadre): Encuadre {
  const k = limitar(Number.isFinite(e.k) ? e.k : 1, ZOOM_MIN, ZOOM_MAX)
  if (k <= ZOOM_MIN + 1e-6) return ENTERA
  const lado = 1 - 1 / k
  return { k, x: limitar(e.x, 0, lado), y: limitar(e.y, 0, lado) }
}

/**
 * Acerca (factor > 1) o aleja (factor < 1) dejando quieto el punto (px, py), en fracción del lienzo entero: lo que
 * está bajo el puntero sigue bajo el puntero.
 */
export function acercarEn(e: Encuadre, factor: number, px: number, py: number): Encuadre {
  const k = limitar(e.k * factor, ZOOM_MIN, ZOOM_MAX)
  const r = e.k / k
  return ajustar({ k, x: px - (px - e.x) * r, y: py - (py - e.y) * r })
}

/** Mueve lo visible: (dx, dy) es el arrastre en fracción de la caja en pantalla (arrastrar a la derecha muestra lo de la izquierda). */
export function desplazar(e: Encuadre, dx: number, dy: number): Encuadre {
  if (e.k <= ZOOM_MIN) return ENTERA
  return ajustar({ k: e.k, x: e.x - dx / e.k, y: e.y - dy / e.k })
}

/** Punto del lienzo entero (fracción) bajo una posición de la caja en pantalla (fracción de esa caja). */
export function puntoEn(e: Encuadre, fx: number, fy: number): { x: number; y: number } {
  return { x: e.x + fx / e.k, y: e.y + fy / e.k }
}

/** Factor de la rueda del mouse: una muesca (100) acerca o aleja un 16 %, aprox. */
export function factorRueda(deltaY: number, modo = 0): number {
  const px = modo === 1 ? deltaY * 33 : modo === 2 ? deltaY * 400 : deltaY
  return Math.exp(-limitar(px, -300, 300) * 0.0015)
}

/** `viewBox` del SVG de ancho W y alto H con ese encuadre. */
export function viewBoxDe(e: Encuadre, W: number, H: number): string {
  const r = (v: number) => Math.round(v * 100) / 100
  const a = ajustar(e)
  return `${r(a.x * W)} ${r(a.y * H)} ${r(W / a.k)} ${r(H / a.k)}`
}

export const esEntera = (e: Encuadre) => e.k <= ZOOM_MIN + 1e-6
