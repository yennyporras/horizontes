// Respaldo de la BD al cerrar una sala y límite de peticiones por IP.
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Db } from '../db/index.js'

export const RESPALDOS_A_CONSERVAR = 30

/**
 * Copia consistente de la BD (VACUUM INTO) en `<dir de la BD>/respaldos/`. No hace nada con `:memory:`.
 * Conserva los últimos RESPALDOS_A_CONSERVAR archivos. Devuelve la ruta del respaldo o null.
 */
export function respaldarBd(db: Db, dbPath: string, etiqueta: string, ahora: number): string | null {
  if (dbPath === ':memory:') return null
  const dir = join(dirname(dbPath), 'respaldos')
  mkdirSync(dir, { recursive: true })
  const sello = new Date(ahora).toISOString().replace(/[:.]/g, '-')
  const destino = join(dir, `horizontes_${sello}_${etiqueta.replace(/[^a-zA-Z0-9_-]/g, '')}.sqlite`)
  db.prepare('VACUUM INTO ?').run(destino)
  const archivos = readdirSync(dir)
    .filter((f) => f.startsWith('horizontes_') && f.endsWith('.sqlite'))
    .sort()
  for (const f of archivos.slice(0, Math.max(0, archivos.length - RESPALDOS_A_CONSERVAR))) rmSync(join(dir, f), { force: true })
  return destino
}

/**
 * Límite simple de ventana fija por clave (IP + ruta). Los 40 celulares de un taller suelen salir
 * por la misma IP del Wi-Fi del lugar, así que los topes son holgados: frenan abuso, no al taller.
 */
export class LimitadorPeticiones {
  private ventanas = new Map<string, { inicio: number; n: number }>()

  constructor(
    private maximo: number,
    private ventanaMs: number,
  ) {}

  /** true si la petición se permite. */
  permitir(clave: string, ahora: number): boolean {
    const v = this.ventanas.get(clave)
    if (!v || ahora - v.inicio >= this.ventanaMs) {
      this.ventanas.set(clave, { inicio: ahora, n: 1 })
      if (this.ventanas.size > 10_000) this.limpiar(ahora)
      return true
    }
    v.n++
    return v.n <= this.maximo
  }

  private limpiar(ahora: number) {
    for (const [k, v] of this.ventanas) if (ahora - v.inicio >= this.ventanaMs) this.ventanas.delete(k)
  }
}
