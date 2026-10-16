// Motor de scoring de Horizontes. Vive solo en el servidor: el frontend nunca recalcula.
// Fórmulas (no se reinterpretan):
//   t2m   = alistamiento_tecnico·0,30 + conocimiento_cliente·0,35 + regulacion·0,35
//   eje_x = t2m·0,6 + capacidades_organizacionales·0,4
//   eje_y = alineacion_core·0,7 + inversion_requerida·0,3
// Los pesos llegan de data/seed_foodsume.json (motor.pesos). Los valores no se invierten.

export const CRITERIOS = [
  'alistamiento_tecnico',
  'conocimiento_cliente',
  'regulacion',
  'capacidades_organizacionales',
  'alineacion_core',
  'inversion_requerida',
] as const

export type CriterioId = (typeof CRITERIOS)[number]
export type Entradas = Record<CriterioId, number>
export const ESCALA = [1, 3, 5, 7, 9] as const

export interface Pesos {
  t2m: { alistamiento_tecnico: number; conocimiento_cliente: number; regulacion: number }
  eje_x: { t2m: number; capacidades_organizacionales: number }
  eje_y: { alineacion_core: number; inversion_requerida: number }
}

export const PESOS_CANONICOS: Pesos = {
  t2m: { alistamiento_tecnico: 0.3, conocimiento_cliente: 0.35, regulacion: 0.35 },
  eje_x: { t2m: 0.6, capacidades_organizacionales: 0.4 },
  eje_y: { alineacion_core: 0.7, inversion_requerida: 0.3 },
}

export interface Punto {
  t2m: number
  eje_x: number
  eje_y: number
}

export function calcularT2m(e: Pick<Entradas, 'alistamiento_tecnico' | 'conocimiento_cliente' | 'regulacion'>, p: Pesos = PESOS_CANONICOS): number {
  return e.alistamiento_tecnico * p.t2m.alistamiento_tecnico + e.conocimiento_cliente * p.t2m.conocimiento_cliente + e.regulacion * p.t2m.regulacion
}

export function calcularPunto(e: Entradas, p: Pesos = PESOS_CANONICOS): Punto {
  const t2m = calcularT2m(e, p)
  return {
    t2m,
    eje_x: t2m * p.eje_x.t2m + e.capacidades_organizacionales * p.eje_x.capacidades_organizacionales,
    eje_y: e.alineacion_core * p.eje_y.alineacion_core + e.inversion_requerida * p.eje_y.inversion_requerida,
  }
}

export type Distribucion = Record<CriterioId, Record<'1' | '3' | '5' | '7' | '9', number>>

export interface Agregado extends Punto {
  n_votos: number
  promedios: Entradas
  distribucion: Distribucion
}

/** Promedio simple por criterio, distribución 1-3-5-7-9 y punto. `null` si no hay votos. */
export function agregar(votos: Entradas[], p: Pesos = PESOS_CANONICOS): Agregado | null {
  if (votos.length === 0) return null
  const promedios = {} as Entradas
  const distribucion = {} as Distribucion
  for (const c of CRITERIOS) {
    let suma = 0
    const d = { '1': 0, '3': 0, '5': 0, '7': 0, '9': 0 }
    for (const v of votos) {
      suma += v[c]
      const k = String(v[c]) as keyof typeof d
      if (k in d) d[k]++
    }
    promedios[c] = suma / votos.length
    distribucion[c] = d
  }
  return { n_votos: votos.length, promedios, distribucion, ...calcularPunto(promedios, p) }
}
