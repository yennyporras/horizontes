// Respaldo de la BD (antes y después de cada sala), reinicio limpio de una sala y límite de peticiones.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Db, ejecutar, transaccion } from '../db/index.js'
import { CONFIG_POR_DEFECTO, cargarSala, registrarEvento, tocar } from './salas.js'
import { type ZonaHoraria, isoEnZona } from './util.js'

export const RESPALDOS_A_CONSERVAR = 30

/**
 * Copia consistente de la BD (VACUUM INTO) en `<dir de la BD>/respaldos/`. No hace nada con `:memory:`.
 * El nombre lleva la hora en la zona de la sala. Conserva los RESPALDOS_A_CONSERVAR más recientes. Devuelve la ruta o null.
 */
export function respaldarBd(db: Db, dbPath: string, etiqueta: string, ahora: number, zona?: ZonaHoraria): string | null {
  if (dbPath === ':memory:') return null
  const dir = join(dirname(dbPath), 'respaldos')
  mkdirSync(dir, { recursive: true })
  const sello = (isoEnZona(ahora, zona) ?? '').replace(/:/g, '-')
  const base = join(dir, `horizontes_${sello}_${etiqueta.replace(/[^a-zA-Z0-9_-]/g, '')}`)
  // VACUUM INTO falla si el archivo existe (dos respaldos con la misma etiqueta en el mismo milisegundo).
  let destino = `${base}.sqlite`
  for (let i = 2; existsSync(destino); i++) destino = `${base}_${i}.sqlite`
  db.prepare('VACUUM INTO ?').run(destino)
  // Por fecha del archivo y no por nombre: salas de países distintos llevan horas con desfases distintos.
  const archivos = readdirSync(dir)
    .filter((f) => f.startsWith('horizontes_') && f.endsWith('.sqlite'))
    .map((f) => ({ f, ms: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => a.ms - b.ms)
    .map((x) => x.f)
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

/**
 * Reinicio limpio de una sala (después del ensayo y antes del taller real): borra participantes, consentimientos,
 * votos y eventos, y la deja en `preparada` con la configuración por defecto. Conserva el id, el código, las mesas
 * (los QR impresos siguen sirviendo), el contenido y el token del tablero. Quien lo llame debe respaldar antes.
 */
export function reiniciarSalaLimpia(db: Db, salaId: string, ahora: number) {
  return transaccion(db, () => {
    const sala = cargarSala(db, salaId)
    const ids = 'SELECT id FROM participantes WHERE sala_id = ?'
    const borrados = {
      votos: Number(ejecutar(db, 'DELETE FROM votos WHERE sala_id = ?', sala.id).changes),
      fotos: Number(ejecutar(db, 'DELETE FROM fotos_agregado WHERE sala_id = ?', sala.id).changes),
      consentimientos: Number(ejecutar(db, `DELETE FROM consentimientos WHERE participante_id IN (${ids})`, sala.id).changes),
      accesos: Number(ejecutar(db, 'DELETE FROM accesos_participante WHERE sala_id = ?', sala.id).changes),
      participantes: Number(ejecutar(db, 'DELETE FROM participantes WHERE sala_id = ?', sala.id).changes),
      eventos: Number(ejecutar(db, 'DELETE FROM eventos WHERE sala_id = ?', sala.id).changes),
    }
    ejecutar(
      db,
      `UPDATE salas SET estado = 'preparada', ronda_actual = 0, alcance_resultados = ?, vista_participante = ?,
         revelar_hojas = 0, cierre_programado_ronda_at = NULL, cierre_programado_sala_at = NULL, apertura_programada_sala_at = NULL,
         apertura_programada_r1_at = NULL, cierre_programado_r1_at = NULL, apertura_programada_r2_at = NULL, cierre_programado_r2_at = NULL,
         modo_preguntas = 'automatico', pregunta_guiada_proyecto_id = NULL, pregunta_guiada_criterio_id = NULL WHERE id = ?`,
      CONFIG_POR_DEFECTO.alcance_resultados,
      CONFIG_POR_DEFECTO.vista_participante,
      sala.id,
    )
    registrarEvento(db, sala.id, ahora, 'sala_reiniciada', 'sistema', borrados)
    tocar(db, sala.id)
    return { sala: cargarSala(db, sala.id), borrados }
  })
}
