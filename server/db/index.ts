import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { MIGRACIONES } from './esquema.js'

export type Db = DatabaseSync

/** Abre (o crea) la BD y aplica las migraciones pendientes. `:memory:` para pruebas. */
export function abrirDb(ruta: string): Db {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true })
  const db = new DatabaseSync(ruta)
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  migrar(db)
  return db
}

export function migrar(db: Db) {
  const actual = Number((db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version)
  for (let i = actual; i < MIGRACIONES.length; i++) {
    transaccion(db, () => {
      db.exec(MIGRACIONES[i])
      db.exec(`PRAGMA user_version = ${i + 1}`)
    })
  }
}

/** Ejecuta `fn` en una transacción (IMMEDIATE para serializar escrituras). */
export function transaccion<T>(db: Db, fn: () => T): T {
  if (db.isTransaction) return fn() // reentrante: ya estamos dentro de una transacción
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/** Atajos tipados sobre prepare(). */
export function uno<T>(db: Db, sql: string, ...params: unknown[]): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined
}
export function todos<T>(db: Db, sql: string, ...params: unknown[]): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[]
}
export function ejecutar(db: Db, sql: string, ...params: unknown[]) {
  return db.prepare(sql).run(...(params as never[]))
}
