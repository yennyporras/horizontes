// Votos "realistas" para el simulador: cada proyecto tiene un valor de referencia por criterio,
// cada mesa un sesgo propio y cada persona ruido. En R2 (con las 6 hojas reveladas) las opiniones
// se acercan a la referencia informada y la dispersión baja. Los sesgos de mesa salen de la semilla; el ruido
// individual depende del orden en que llegan las personas (asíncrono), así que dos corridas no repiten votos exactos.
// La verificación no lo necesita: compara contra los votos que realmente se enviaron.
export const ESCALA = [1, 3, 5, 7, 9] as const
export const CRITERIOS = ['alistamiento_tecnico', 'conocimiento_cliente', 'regulacion', 'capacidades_organizacionales', 'alineacion_core', 'inversion_requerida'] as const
export type Criterio = (typeof CRITERIOS)[number]
export type Respuestas = Record<Criterio, number>

/** PRNG mulberry32: determinista y suficiente para simular. */
export function prng(semilla: number) {
  let a = semilla >>> 0
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  /** Normal estándar (Box-Muller). */
  const normal = () => Math.sqrt(-2 * Math.log(1 - siguiente())) * Math.cos(2 * Math.PI * siguiente())
  return { siguiente, normal }
}

/** Lleva un valor continuo al punto más cercano de la escala 1-3-5-7-9. */
export function aEscala(v: number): number {
  const i = Math.round((Math.min(9, Math.max(1, v)) - 1) / 2)
  return ESCALA[i]
}

// Referencias por proyecto: R1 lo que se intuye leyendo el caso; R2 lo que se sabe tras leer todas las hojas.
const REFERENCIA: Record<string, Record<1 | 2, Respuestas>> = {
  insumex: {
    1: { alistamiento_tecnico: 5, conocimiento_cliente: 6, regulacion: 5.5, capacidades_organizacionales: 4.5, alineacion_core: 5, inversion_requerida: 5 },
    2: { alistamiento_tecnico: 5.5, conocimiento_cliente: 5, regulacion: 4, capacidades_organizacionales: 4, alineacion_core: 4.5, inversion_requerida: 5 },
  },
  nutriwhat: {
    1: { alistamiento_tecnico: 4, conocimiento_cliente: 5.5, regulacion: 5, capacidades_organizacionales: 5.5, alineacion_core: 5, inversion_requerida: 5 },
    2: { alistamiento_tecnico: 4.5, conocimiento_cliente: 6.5, regulacion: 6, capacidades_organizacionales: 5.5, alineacion_core: 6, inversion_requerida: 4.5 },
  },
}

export interface Generador {
  respuestas(persona: number, mesa: number, proyecto: string, ronda: 1 | 2): Respuestas
}

export function generadorRealista(semilla: number, mesas: number): Generador {
  const r = prng(semilla)
  // Sesgo de cada mesa por proyecto y criterio (la conversación de la mesa arrastra la opinión).
  const sesgo = Array.from({ length: mesas }, () =>
    Object.fromEntries(Object.keys(REFERENCIA).map((p) => [p, Object.fromEntries(CRITERIOS.map((c) => [c, r.normal() * 0.9]))])),
  ) as Record<string, Record<Criterio, number>>[]
  return {
    respuestas(_persona, mesa, proyecto, ronda) {
      const ref = REFERENCIA[proyecto]?.[ronda] ?? REFERENCIA.insumex[ronda]
      // R2: menos ruido individual y la mitad del sesgo de mesa (las hojas igualan la información).
      const ruido = ronda === 1 ? 1.8 : 1.1
      const peso = ronda === 1 ? 1 : 0.5
      return Object.fromEntries(CRITERIOS.map((c) => [c, aEscala(ref[c] + sesgo[mesa][proyecto][c] * peso + r.normal() * ruido)])) as Respuestas
    },
  }
}
