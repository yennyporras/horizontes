// Respaldo de la BD (antes y después de cada sala), reinicio limpio y eliminación de una sala, y límite de peticiones.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { type Db, ejecutar, transaccion } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { CONFIG_POR_DEFECTO, type SalaFila, cargarSala, regenerarTokenTablero, registrarEvento, tocar } from './salas.js'
import { type ZonaHoraria, isoEnZona } from './util.js'

/** Respaldos que se conservan por sala (inicio, antes de cada reinicio y cierre). La rotación es por sala desde el 20-oct. */
export const RESPALDOS_POR_SALA = 10

/**
 * Copia consistente de la BD (VACUUM INTO) en `<dir de la BD>/respaldos/`. No hace nada con `:memory:`.
 * Nombre: `horizontes_<hora en la zona de la sala>_<salaId>_<momento>.sqlite`. Conserva los RESPALDOS_POR_SALA más
 * recientes de esa sala: una sala con muchos reinicios ya no borra los respaldos de las otras. Devuelve la ruta o null.
 */
export function respaldarBd(db: Db, dbPath: string, salaId: string, momento: string, ahora: number, zona?: ZonaHoraria): string | null {
  if (dbPath === ':memory:') return null
  const dir = join(dirname(dbPath), 'respaldos')
  mkdirSync(dir, { recursive: true })
  const limpio = (t: string) => t.replace(/[^a-zA-Z0-9_-]/g, '')
  const sello = (isoEnZona(ahora, zona) ?? '').replace(/:/g, '-')
  const base = join(dir, `horizontes_${sello}_${limpio(salaId)}_${limpio(momento)}`)
  // VACUUM INTO falla si el archivo existe (dos respaldos con la misma etiqueta en el mismo milisegundo).
  let destino = `${base}.sqlite`
  for (let i = 2; existsSync(destino); i++) destino = `${base}_${i}.sqlite`
  db.prepare('VACUUM INTO ?').run(destino)
  // Por fecha del archivo y no por nombre: salas de países distintos llevan horas con desfases distintos.
  const deLaSala = readdirSync(dir)
    .filter((f) => f.startsWith('horizontes_') && f.endsWith('.sqlite') && f.includes(`_${limpio(salaId)}_`))
    .map((f) => ({ f, ms: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => a.ms - b.ms)
    .map((x) => x.f)
  for (const f of deLaSala.slice(0, Math.max(0, deLaSala.length - RESPALDOS_POR_SALA))) rmSync(join(dir, f), { force: true })
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

  /** true si la clave ya gastó su cupo en la ventana vigente. Solo consulta: no cuenta la petición. */
  agotado(clave: string, ahora: number): boolean {
    const v = this.ventanas.get(clave)
    return Boolean(v && ahora - v.inicio < this.ventanaMs && v.n >= this.maximo)
  }

  private limpiar(ahora: number) {
    for (const [k, v] of this.ventanas) if (ahora - v.inicio >= this.ventanaMs) this.ventanas.delete(k)
  }
}

/**
 * Reinicio limpio de una sala (después del ensayo y antes del taller real): borra participantes, consentimientos,
 * votos y eventos, y la deja en `preparada` con la configuración por defecto. Conserva el id, el código, las mesas
 * (los QR impresos siguen sirviendo) y el contenido. El token del tablero cambia (B-2): quien vio el enlace en el
 * ensayo no ve el taller real; el enlace nuevo está en el panel. Quien lo llame debe respaldar antes.
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
    regenerarTokenTablero(db, sala.id, ahora, 'sistema')
    registrarEvento(db, sala.id, ahora, 'sala_reiniciada', 'sistema', borrados)
    tocar(db, sala.id)
    return { sala: cargarSala(db, sala.id), borrados }
  })
}

/**
 * 422 CONFIRMACION_INVALIDA si `confirmar` no es el nombre exacto de la sala (se ignoran los espacios de los extremos).
 * La ruta lo revisa antes del respaldo, así un nombre mal escrito no gasta la rotación de respaldos.
 */
export function exigirConfirmacionSala(sala: Pick<SalaFila, 'nombre'>, confirmar: unknown) {
  if (typeof confirmar !== 'string' || confirmar.trim() !== sala.nombre) {
    throw new ErrorApi(422, 'CONFIRMACION_INVALIDA', `Para eliminar la sala escribe su nombre exacto: «${sala.nombre}».`)
  }
}

/**
 * Elimina la sala y todo lo suyo en una transacción (pedido de Paola, 21-oct): votos, fotos del consolidado, accesos,
 * consentimientos, participantes, mesas, hojas, proyectos, contenido (con sus rúbricas), bitácora y la sala. Las
 * rúbricas guardadas para las salas nuevas (`rubricas_plantilla`) no son de la sala y se quedan. Quien la llame debe
 * respaldar antes. Devuelve lo que borró.
 */
export function eliminarSala(db: Db, salaId: string, confirmar: unknown) {
  return transaccion(db, () => {
    const sala = cargarSala(db, salaId)
    exigirConfirmacionSala(sala, confirmar)
    const ids = 'SELECT id FROM participantes WHERE sala_id = ?'
    const borrar = (sql: string, ...p: unknown[]) => Number(ejecutar(db, sql, ...p).changes)
    const borrados = {
      votos: borrar(`DELETE FROM votos WHERE sala_id = ? OR participante_id IN (${ids})`, sala.id, sala.id),
      fotos: borrar('DELETE FROM fotos_agregado WHERE sala_id = ?', sala.id),
      accesos: borrar(`DELETE FROM accesos_participante WHERE sala_id = ? OR participante_id IN (${ids})`, sala.id, sala.id),
      consentimientos: borrar(`DELETE FROM consentimientos WHERE participante_id IN (${ids})`, sala.id),
      participantes: borrar('DELETE FROM participantes WHERE sala_id = ?', sala.id),
      mesas: borrar('DELETE FROM mesas WHERE sala_id = ?', sala.id),
      hojas: borrar('DELETE FROM hojas WHERE sala_id = ?', sala.id),
      proyectos: borrar('DELETE FROM proyectos WHERE sala_id = ?', sala.id),
      contenido: borrar('DELETE FROM contenido_sala WHERE sala_id = ?', sala.id),
      eventos: borrar('DELETE FROM eventos WHERE sala_id = ?', sala.id),
    }
    borrar('DELETE FROM salas WHERE id = ?', sala.id)
    return { sala: { id: sala.id, codigo: sala.codigo, nombre: sala.nombre }, borrados }
  })
}
