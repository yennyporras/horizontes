// Tipos del módulo SVG puro matriz.js (el módulo se mantiene en JS sin dependencias).
import type { DatosTablero, Vista } from '../tipos'

export interface OpcionesMatriz {
  ancho?: number
  alto?: number
  vista?: Vista
  idPrefijo?: string
  /** Multiplica el tamaño de letra (1 = base). En proyector se usa ~1,3. */
  escalaTexto?: number
  /** Anima R2 saliendo desde R1 (al pasar a Comparación). Respeta prefers-reduced-motion. */
  animar?: boolean
  /** Milisegundos ya transcurridos de esa animación: un redibujo a mitad de camino la continúa sin reiniciarla. */
  animarDesdeMs?: number
  colores?: Record<string, unknown>
}

export interface Caja {
  x: number
  y: number
  w: number
  h: number
}

export interface Burbuja {
  cx: number
  cy: number
  r: number
  valor: { x: number; y: number }
  n_votos?: number
}

export interface Etiqueta {
  texto: string
  /** Etiquetas de vivos: nombre y ronda por separado (la ronda va en su color). */
  nombre?: string
  ronda?: 1 | 2
  fs: number
  color: string
  peso: number
  tipo: 'vivo' | 'r1' | 'fijo'
  caja: Caja
  prioridad: boolean
  ancla: Burbuja
}

export interface VivoLayout {
  id: string
  nombre: string
  tam: number
  r1: Burbuja | null
  r2: Burbuja | null
  flecha: { x1: number; y1: number; x2: number; y2: number; encima: boolean } | null
  etiqueta?: Etiqueta
  etiquetaR1?: Etiqueta
}

export interface Layout {
  W: number
  H: number
  fs: number
  P: number
  x0: number
  y0: number
  sx: (v: number) => number
  sy: (v: number) => number
  escala: number
  xmin: number
  xmax: number
  ymin: number
  ymax: number
  fijos: (Burbuja & { id: string; nombre: string; tam: number; etiqueta?: Etiqueta })[]
  vivos: VivoLayout[]
  etiquetas: Etiqueta[]
  colores: Record<string, unknown>
}

type DatosParciales = Partial<DatosTablero> | null | undefined

export const COLORES: { r1: string; r2: string; [k: string]: unknown }
export function radioPorTam(tam: number | null | undefined, rmin: number, rmax: number): number
export function calcularLayout(datos: DatosParciales, opciones?: OpcionesMatriz): Layout
export function matrizSVG(datos: DatosParciales, opciones?: OpcionesMatriz): string
export function montarMatriz(
  contenedor: HTMLElement,
  datos: DatosParciales,
  opciones?: OpcionesMatriz,
): { actualizar: (datos: DatosParciales) => void; destruir: () => void }
