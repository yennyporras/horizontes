// Fuente única de los textos cortos de los criterios y de la lectura de la escala, para el tablero, el celular, el
// panel y la landing. Los nombres largos, las preguntas y las rúbricas siguen en la semilla (aprobados por Sebastián).
import type { CriterioId } from './api/contrato'

export const LARGO_MAXIMO_DESCRIPCION = 100

/**
 * Nombre corto de cada criterio, el mismo en todas las tablas (QA por roles del 20-oct: el celular y el tablero los
 * escribían distinto). «Inversión para probar» conserva lo que mide el criterio: lo que cuesta probar, no escalar.
 */
export const NOMBRE_CORTO: Record<CriterioId, string> = {
  alistamiento_tecnico: 'Alistamiento técnico',
  conocimiento_cliente: 'Conocimiento del cliente',
  regulacion: 'Regulación',
  capacidades_organizacionales: 'Capacidades organizacionales',
  alineacion_core: 'Alineación con el core',
  inversion_requerida: 'Inversión para probar',
}

/** Nombre corto del criterio; si el id no es uno de los 6 (contenido de otra sala), el nombre que traiga la sala. */
export function nombreCortoCriterio(id: string, nombre = id): string {
  return (NOMBRE_CORTO as Record<string, string>)[id] ?? nombre
}

/**
 * Descripción corta con los dos polos de la escala (pedido de Paola del 20-oct; corregida en el QA por roles: la
 * versión anterior se leía al revés). En los 6 criterios, 1 es lo más cercano o listo y 9 lo más lejano o incierto,
 * como dicen las rúbricas de la semilla. Máximo 100 caracteres (lo exige criterios.test.ts).
 */
export const DESCRIPCION_CRITERIO: Record<CriterioId, string> = {
  alistamiento_tecnico: 'Madurez técnica de la solución. 1: lista para vender; 9: apenas una idea.',
  conocimiento_cliente: 'Cuánto se ha validado el cliente. 1: validado con los segmentos; 9: solo hipótesis.',
  regulacion: 'Barreras legales para entrar al mercado. 1: mercado no regulado; 9: más de 5 años.',
  capacidades_organizacionales: 'Capacidades propias que la apalancan. 1: todas disponibles; 9: ninguna.',
  alineacion_core: 'Distancia al core actual. 1: mejora del negocio de hoy; 9: negocio ajeno.',
  inversion_requerida: 'Inversión para probarla, no para escalar. 1: hasta USD 50k; 9: más de USD 1 millón.',
}

/** Descripción del criterio, o null si el id no es uno de los 6 (contenido de otra sala). */
export function descripcionCriterio(id: string): string | null {
  return (DESCRIPCION_CRITERIO as Record<string, string>)[id] ?? null
}

/** Cómo se lee la escala, en una línea. Va junto a cada pregunta y bajo cada matriz. */
export const LECTURA_ESCALA = '1 es lo más cercano y listo; 9, lo más lejano e incierto.'

/** Cómo se leen los ejes de la matriz, en una línea que cabe en un proyector de 1280 px. */
export const LECTURA_EJES = 'Eje X: qué tan lejos está del mercado. Eje Y: qué tan lejos está del core. 1 es cerca; 9, lejos.'

/** Tamaño de la burbuja, sin jerga: el TAM de la semilla es una escala de 1 a 10. */
export const LECTURA_BURBUJA = 'Tamaño de la burbuja: mercado potencial (TAM, de 1 a 10)'

/**
 * Los tres horizontes, para la leyenda del tablero y la landing. Pendiente de la revisión de Sebastián
 * (docs/PROPUESTA_SEMILLA.md): la app no clasifica proyectos por horizonte, solo los nombra.
 */
export const HORIZONTES = [
  { id: 'H1', nombre: 'Core', texto: 'mejorar el negocio de hoy' },
  { id: 'H2', nombre: 'Adyacente', texto: 'extender el negocio' },
  { id: 'H3', nombre: 'Transformación', texto: 'crear un negocio nuevo' },
] as const
