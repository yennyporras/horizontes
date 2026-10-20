// Descripción corta de cada criterio (pedido de Paola, 20-oct): una línea bajo el nombre del criterio en las
// tablas de resultados. Máximo 100 caracteres (lo exige criterios.test.ts). Fuente única para el tablero, el
// celular y el panel.
import type { CriterioId } from './api/contrato'

export const LARGO_MAXIMO_DESCRIPCION = 100

export const DESCRIPCION_CRITERIO: Record<CriterioId, string> = {
  alistamiento_tecnico: 'Qué tan lista está la solución desde lo técnico: de idea a producto probado.',
  conocimiento_cliente: 'Cuánto sabemos del cliente y si ya hay adoptantes tempranos que la usen.',
  regulacion: 'Qué tantas barreras legales o normativas hay para entrar al mercado.',
  capacidades_organizacionales: 'Con qué capacidades y recursos cuenta hoy la empresa para sacarla adelante.',
  alineacion_core: 'Qué tan cerca está el nuevo negocio del core actual de la organización.',
  inversion_requerida: 'Cuánto y qué tipo de inversión se necesita para probar la solución.',
}

/** Descripción del criterio, o null si el id no es uno de los 6 (contenido de otra sala). */
export function descripcionCriterio(id: string): string | null {
  return (DESCRIPCION_CRITERIO as Record<string, string>)[id] ?? null
}
