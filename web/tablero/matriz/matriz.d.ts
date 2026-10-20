// Tipos del módulo SVG puro matriz.js (el módulo se mantiene en JS sin dependencias).
import type { DatosTablero, Vista } from '../tipos'

export interface OpcionesMatriz {
  ancho?: number
  alto?: number
  vista?: Vista
  idPrefijo?: string
  /** Multiplica el tamaño de letra (1 = base). En proyector se usa ~1,3. */
  escalaTexto?: number
  /**
   * Proyector: px del texto más chico de la matriz (marcas, subtítulos y nombres). Los títulos y los nombres
   * de los vivos van un poco más grandes. Con un lienzo chico se limita a un 26avo de su lado.
   */
  letraMin?: number
  /** Anima R2 saliendo desde R1 (al pasar a Comparación). Respeta prefers-reduced-motion. */
  animar?: boolean
  /** Milisegundos ya transcurridos de esa animación: un redibujo a mitad de camino la continúa sin reiniciarla. */
  animarDesdeMs?: number
  colores?: Record<string, unknown>
  /** Cada mesa por separado: fijos como puntos sin nombre y ejes sin subtítulo. */
  compacta?: boolean
  /** Rectángulo de fondo del lienzo (para la descarga: fuera de la página no hay fondo detrás). */
  fondo?: boolean
  /**
   * Modo Gráfica del tablero: posiciones anteriores de los vivos (clave `${id}-${ronda}`, en unidades de los ejes). Las
   * burbujas que cambiaron se deslizan desde ahí; desdeMs continúa una transición ya empezada.
   */
  transicion?: { valores: Record<string, { x: number; y: number }>; desdeMs?: number }
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
  /** Coincidía con otro vivo de la misma ronda: se corrió unos píxeles para que se vean los dos aros. */
  separada?: boolean
}

export interface Etiqueta {
  texto: string
  /** Etiquetas de vivos: nombre y ronda por separado (la ronda va en su color). */
  nombre?: string
  ronda?: 1 | 2
  /** Dos o más vivos en el mismo punto y ronda: un rótulo de una línea por vivo. */
  lineas?: { nombre: string; ronda: 1 | 2 }[]
  anclas?: Burbuja[]
  fs: number
  /** Clase de color: texto principal (vivos) o suave (fijos). */
  color: 'texto' | 'suave'
  peso: number
  tipo: 'vivo' | 'r1' | 'fijo'
  caja: Caja
  prioridad: boolean
  ancla: Burbuja
  /** px entre la caja del nombre y el borde de su burbuja. */
  distancia: number
  /** Línea fina del borde de la burbuja al nombre, si el nombre quedó apartado. */
  guia: { x1: number; y1: number; x2: number; y2: number } | null
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
  /** Tamaños de letra en px: marcas de los ejes, subtítulos, títulos, nombres de vivos, de fijos y de R1. */
  letras: { marca: number; subtitulo: number; titulo: number; vivo: number; fijo: number; r1: number }
  /** Marca de agua H1, H2 y H3: tamaño de letra y cajas que los nombres esquivan. */
  fsHorizonte: number
  marcasAgua: Caja[]
  marcasHorizonte: { id: string; x: number; y: number; caja: Caja }[]
  /** Cada mesa por separado: sin nombres de fijos ni subtítulos de ejes. */
  compacta: boolean
  /** Largo de la punta de la flecha R1 → R2, en px. */
  punta: number
  posEjes: Record<'marcaX' | 'marcaY' | 'extremoX' | 'extremoY' | 'tituloX' | 'subtituloX' | 'subtituloY' | 'tituloY', number>
  fijos: (Burbuja & { id: string; nombre: string; tam: number; etiqueta?: Etiqueta })[]
  vivos: VivoLayout[]
  etiquetas: Etiqueta[]
  colores: Record<string, unknown>
}

type DatosParciales = Partial<DatosTablero> | null | undefined

export const COLORES: { r1: string; r2: string; [k: string]: unknown }
export const ANIMACION: { pausa: number; mover: number; aparecer: number; total: number }
export function formaTitulo(texto: string | null | undefined): string
export function radioPorTam(tam: number | null | undefined, rmin: number, rmax: number): number
export function calcularLayout(datos: DatosParciales, opciones?: OpcionesMatriz): Layout
export function matrizSVG(datos: DatosParciales, opciones?: OpcionesMatriz): string
