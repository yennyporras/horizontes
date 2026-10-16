import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { RAIZ } from '../config.js'
import type { Entradas, Pesos } from '../../shared/motor/motor.js'

export interface CriterioSemilla {
  id: string
  nombre: string
  pregunta: string
  rubrica: { valor: number; texto: string }[]
  alimenta: string
  perfil_informante: string
}
export interface ProyectoSemilla {
  id: string
  nombre: string
  tipo: string
  sector: string
  descripcion: string
  modo: 'fijo' | 'vivo'
  orden: number
  tam: number
  inputs?: Entradas
}
export interface Semilla {
  motor: {
    escala_permitida: number[]
    criterios: CriterioSemilla[]
    pesos: Pesos
    ejes: Record<'x' | 'y', { titulo: string; subtitulo: string; min: number; max: number }>
    grafico: Record<string, unknown>
  }
  perfiles: { id: string; nombre: string }[]
  plantilla: {
    id: string
    nombre: string
    caso: { titulo: string; descripcion_md: string; situacion_md: string }
    proyectos: ProyectoSemilla[]
    hojas: { proyecto_id: string; perfil_id: string; texto: string }[]
    rondas_votacion: number
  }
}

let cache: Semilla | null = null

/** data/seed_foodsume.json (plantilla foodsume_2026). Se lee una vez. */
export function semilla(): Semilla {
  if (!cache) cache = JSON.parse(readFileSync(resolve(RAIZ, 'data', 'seed_foodsume.json'), 'utf8'), (_k, v) => (typeof v === 'string' ? sinRayas(v) : v)) as Semilla
  return cache
}

/** La app no muestra rayas (—): un inciso entre rayas pasa a ir entre comas. data/ es de solo lectura, se corrige al cargar. */
export function sinRayas(texto: string): string {
  return texto
    .replace(/^([ \t]*)—[ \t]*/gm, '$1- ') // viñeta con raya al inicio de línea → viñeta markdown
    .replace(/[ \t]*—[ \t]*([.,;:]|$)/gm, '$1') // raya que cierra un inciso justo antes de puntuación o fin de línea
    .replace(/[ \t]*—[ \t]*/g, ', ') // inciso entre rayas → entre comas
}

export const PLANTILLAS = ['foodsume_2026'] as const

export function perfiles() {
  return semilla().perfiles
}
export function nombrePerfil(id: string) {
  return perfiles().find((p) => p.id === id)?.nombre ?? id
}
