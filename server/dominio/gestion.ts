// Vistas y operaciones del panel admin sobre salas, mesas y participantes (SPEC §9).
import { type Db, ejecutar, todos, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { CRITERIOS, agregar } from '../../shared/motor/motor.js'
import { votosDelAlcance } from './fotos.js'
import type { ParticipanteFila } from './participantes.js'
import { registrarCambiosPrecierre } from './participantes.js'
import { minimoVotos, configPublica, contenido, preguntaGuiada, progreso, rondaCerrada, rondaReferencia, vivos } from './resultados.js'
import { type MesaFila, type SalaFila, cargarSala, mesasDeSala, registrarEvento, tocar } from './salas.js'
import { nombrePerfil, perfiles } from './semilla.js'
import { isoEnZona, sha256 } from './util.js'

export function urls(baseUrl: string, sala: SalaFila, mesa?: MesaFila) {
  const base = baseUrl.replace(/\/+$/, '')
  return {
    url_participante: mesa ? `${base}/m/${mesa.codigo}` : undefined,
    url_tablero: `${base}/tablero/${sala.id}?${mesa ? `mesa=${mesa.id}&` : ''}t=${sala.token_tablero}`,
  }
}

export function listarSalas(db: Db) {
  return todos<SalaFila & { mesas: number; inscritos: number }>(
    db,
    `SELECT s.*, (SELECT COUNT(*) FROM mesas m WHERE m.sala_id = s.id) AS mesas,
            (SELECT COUNT(*) FROM participantes p WHERE p.sala_id = s.id AND p.activo = 1) AS inscritos
       FROM salas s ORDER BY s.creada_at DESC`,
  ).map((s) => ({
    id: s.id,
    codigo: s.codigo,
    nombre: s.nombre,
    estado: s.estado,
    ronda_actual: s.ronda_actual,
    creada_at: isoEnZona(s.creada_at, s.zona_horaria),
    mesas: Number(s.mesas),
    inscritos: Number(s.inscritos),
    tipo: s.tipo,
    empresa: s.empresa,
    sector: s.sector,
  }))
}

export function salaResumen(sala: SalaFila, baseUrl: string) {
  return {
    id: sala.id,
    codigo: sala.codigo,
    nombre: sala.nombre,
    plantilla: sala.plantilla,
    estado: sala.estado,
    ronda_actual: sala.ronda_actual,
    creada_at: isoEnZona(sala.creada_at, sala.zona_horaria),
    config: configPublica(sala),
    token_tablero: sala.token_tablero,
    url_tablero: urls(baseUrl, sala).url_tablero,
    pregunta_guiada: preguntaGuiada(sala),
    tipo: sala.tipo,
    empresa: sala.empresa,
    sector: sala.sector,
  }
}

export function mesasAdmin(db: Db, sala: SalaFila, baseUrl: string) {
  const mesas = mesasDeSala(db, sala.id)
  const prog = progreso(db, sala, mesas)
  const conteo = todos<{ mesa_id: string; perfil_id: string; n: number }>(
    db,
    'SELECT mesa_id, perfil_id, COUNT(*) AS n FROM participantes WHERE sala_id = ? AND activo = 1 GROUP BY mesa_id, perfil_id',
    sala.id,
  )
  return mesas.map((m) => {
    const pm = prog.por_mesa.find((x) => x.mesa_id === m.id)!
    const perfilesMesa = Object.fromEntries(perfiles().map((p) => [p.id, Number(conteo.find((c) => c.mesa_id === m.id && c.perfil_id === p.id)?.n ?? 0)]))
    return { id: m.id, numero: m.numero, nombre: m.nombre, codigo: m.codigo, ...urls(baseUrl, sala, m), inscritos: pm.inscritos, completos: pm.completos, precierre: pm.precierre, perfiles: perfilesMesa }
  })
}

export function detalleSala(db: Db, idOCodigo: string, baseUrl: string) {
  const sala = cargarSala(db, idOCodigo)
  const ronda = rondaReferencia(sala)
  const nVivos = vivos(db, sala.id).length
  // IP y país del primer aviso aceptado: los inscritos antes del 19-oct no tienen participantes.ip, su consentimiento sí.
  const participantes = todos<ParticipanteFila & { votos: number; consentimiento_at: string | null; ip_aviso: string | null; pais: string }>(
    db,
    `SELECT p.*,
            (SELECT COUNT(*) FROM votos v WHERE v.participante_id = p.id AND v.ronda = ?) AS votos,
            (SELECT MAX(c.aceptado_at) FROM consentimientos c WHERE c.participante_id = p.id) AS consentimiento_at,
            c1.ip AS ip_aviso, c1.pais
       FROM participantes p
       LEFT JOIN consentimientos c1 ON c1.id = (SELECT MIN(id) FROM consentimientos WHERE participante_id = p.id)
      WHERE p.sala_id = ? ORDER BY p.creado_at`,
    ronda,
    sala.id,
  )
  const eventos = todos<{ at: string; tipo: string; por: string; detalle_json: string | null }>(
    db,
    'SELECT at, tipo, por, detalle_json FROM eventos WHERE sala_id = ? ORDER BY id DESC LIMIT 100',
    sala.id,
  )
  const prog = progreso(db, sala)
  return {
    version: `v-${sala.version}`,
    sala: salaResumen(sala, baseUrl),
    progreso: { ronda: prog.ronda, inscritos: prog.inscritos, completos: prog.completos, precierre: prog.precierre },
    mesas: mesasAdmin(db, sala, baseUrl),
    participantes: participantes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      correo: p.correo,
      mesa_id: p.mesa_id,
      perfil_id: p.perfil_id,
      activo: Boolean(p.activo),
      completo_ronda: Number(p.votos) >= nVivos,
      consentimiento_at: isoEnZona(p.consentimiento_at, sala.zona_horaria),
      ip: p.ip ?? p.ip_aviso,
      pais: p.pais,
    })),
    perfiles: perfiles(),
    eventos: eventos.map((e) => ({ at: isoEnZona(e.at, sala.zona_horaria), tipo: e.tipo, detalle: e.detalle_json ? JSON.parse(e.detalle_json) : null, por: e.por })),
    resumen: resumenTaller(db, sala),
  }
}

/** Participantes activos de la sala que votaron todos los proyectos vivos en la ronda. */
function completaron(db: Db, salaId: string, ronda: number): number {
  return Number(
    uno<{ n: number }>(
      db,
      `SELECT COUNT(*) AS n FROM participantes p
        WHERE p.sala_id = ? AND p.activo = 1
          AND (SELECT COUNT(*) FROM votos v JOIN proyectos pr ON pr.sala_id = v.sala_id AND pr.id = v.proyecto_id AND pr.modo = 'vivo'
                WHERE v.participante_id = p.id AND v.ronda = ?) >= (SELECT COUNT(*) FROM proyectos pr WHERE pr.sala_id = p.sala_id AND pr.modo = 'vivo')`,
      salaId,
      ronda,
    )?.n ?? 0,
  )
}

/**
 * Resumen del taller (QA por roles, 20-oct) para el panel: minutos de cada ronda (de su primera apertura a su último
 * cierre, según la bitácora; null si la ronda no se ha cerrado), inscritos activos, quiénes completaron cada ronda y
 * cuántas veces se dio acceso de nuevo. Cerrar la sala con la ronda abierta cuenta como cierre de esa ronda.
 */
export function resumenTaller(db: Db, sala: SalaFila) {
  const ev = todos<{ at: string; tipo: string; detalle_json: string | null }>(
    db,
    "SELECT at, tipo, detalle_json FROM eventos WHERE sala_id = ? AND tipo IN ('ronda_abierta', 'ronda_cerrada', 'sala_cerrada') ORDER BY id",
    sala.id,
  ).map((e) => ({ ms: Date.parse(e.at), tipo: e.tipo, d: (e.detalle_json ? JSON.parse(e.detalle_json) : {}) as { ronda?: number; desde?: string } }))
  const minutos = (r: number): number | null => {
    if (!rondaCerrada(sala, r)) return null
    const inicio = ev.find((e) => e.tipo === 'ronda_abierta' && e.d.ronda === r)
    const fin = ev.filter((e) => (e.tipo === 'ronda_cerrada' && e.d.ronda === r) || (e.tipo === 'sala_cerrada' && e.d.desde === `r${r}_abierta`)).at(-1)
    if (!inicio || !fin || fin.ms < inicio.ms) return null
    return Math.round((fin.ms - inicio.ms) / 6000) / 10
  }
  const accesos = uno<{ n: number }>(db, "SELECT COUNT(*) AS n FROM eventos WHERE sala_id = ? AND tipo = 'acceso_reemitido'", sala.id)?.n ?? 0
  return {
    minutos_r1: minutos(1),
    minutos_r2: minutos(2),
    inscritos: progreso(db, sala).inscritos,
    completaron_r1: completaron(db, sala.id, 1),
    completaron_r2: completaron(db, sala.id, 2),
    accesos_nuevos: Number(accesos),
  }
}

/**
 * Métricas del negocio (QA por roles, 20-oct): solo salas `taller` (los ensayos y la demostración no cuentan) con al
 * menos una persona activa. `completaron_r2` = personas activas con los proyectos vivos votados en la ronda 2.
 */
export function metricas(db: Db) {
  const salas = todos<{ id: string; pais: string; personas: number }>(
    db,
    `SELECT s.id, s.pais, (SELECT COUNT(*) FROM participantes p WHERE p.sala_id = s.id AND p.activo = 1) AS personas
       FROM salas s WHERE s.tipo = 'taller'`,
  ).filter((s) => Number(s.personas) > 0)
  return {
    talleres: salas.length,
    personas: salas.reduce((a, s) => a + Number(s.personas), 0),
    completaron_r2: salas.reduce((a, s) => a + completaron(db, s.id, 2), 0),
    paises: [...new Set(salas.map((s) => s.pais))].sort(),
  }
}

/**
 * Respuestas por persona (solo admin, C19-3): una fila por participante, ronda y proyecto votado, con nombre y correo.
 * Incluye a los desactivados (`activo: false`), cuyos votos no cuentan en la matriz. Nunca sale en rutas públicas.
 */
export function respuestasPorPersona(db: Db, idOCodigo: string) {
  const sala = cargarSala(db, idOCodigo)
  // Dentro de cada persona y ronda, en el orden del portafolio (INSUMEX antes que NUTRIWHAT).
  const filas = todos<Record<string, string | number>>(
    db,
    `SELECT v.participante_id, p.nombre, p.correo, p.mesa_id, m.nombre AS mesa, p.perfil_id, p.activo, v.ronda, v.proyecto_id,
            ${CRITERIOS.map((c) => `v.${c}`).join(', ')}, v.actualizado_at
       FROM votos v JOIN participantes p ON p.id = v.participante_id JOIN mesas m ON m.id = p.mesa_id
       JOIN proyectos pr ON pr.sala_id = v.sala_id AND pr.id = v.proyecto_id
      WHERE v.sala_id = ? ORDER BY m.numero, p.creado_at, v.participante_id, v.ronda, pr.orden`,
    sala.id,
  )
  return {
    respuestas: filas.map((f) => ({
      participante_id: f.participante_id,
      nombre: f.nombre,
      correo: f.correo,
      mesa_id: f.mesa_id,
      mesa: f.mesa,
      perfil_id: f.perfil_id,
      activo: Boolean(f.activo),
      ronda: Number(f.ronda),
      proyecto_id: f.proyecto_id,
      respuestas: Object.fromEntries(CRITERIOS.map((c) => [c, Number(f[c])])),
      actualizado_at: isoEnZona(String(f.actualizado_at), sala.zona_horaria),
    })),
  }
}

export interface CambiosParticipante {
  perfil_id?: unknown
  mesa_id?: unknown
  activo?: unknown
}

export function editarParticipante(db: Db, id: string, d: CambiosParticipante, ahora: number, por: string) {
  return transaccion(db, () => {
    const p = uno<ParticipanteFila>(db, 'SELECT * FROM participantes WHERE id = ?', id)
    if (!p) throw new ErrorApi(404, 'PARTICIPANTE_NO_EXISTE', 'Ese participante no existe.')
    const sala = cargarSala(db, p.sala_id)
    const antes = progreso(db, sala)
    const detalle: Record<string, unknown> = { participante_id: id }
    if (d.perfil_id !== undefined) {
      if (typeof d.perfil_id !== 'string' || !perfiles().some((x) => x.id === d.perfil_id)) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Ese perfil no existe.')
      ejecutar(db, 'UPDATE participantes SET perfil_id = ? WHERE id = ?', d.perfil_id, id)
      detalle.perfil_id = d.perfil_id
    }
    if (d.mesa_id !== undefined) {
      // Solo texto: un booleano o un objeto llegaban a SQLite y terminaban en 500 (S-9).
      const m = typeof d.mesa_id === 'string' ? uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ? AND sala_id = ?', d.mesa_id, p.sala_id) : undefined
      if (!m) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Esa mesa no pertenece a la sala del participante.')
      ejecutar(db, 'UPDATE participantes SET mesa_id = ? WHERE id = ?', m.id, id)
      detalle.mesa_id = m.id
    }
    if (d.activo !== undefined) {
      if (typeof d.activo !== 'boolean') throw new ErrorApi(422, 'DATOS_INVALIDOS', 'activo debe ser true o false.')
      ejecutar(db, 'UPDATE participantes SET activo = ? WHERE id = ?', d.activo ? 1 : 0, id)
      detalle.activo = d.activo
    }
    if (Object.keys(detalle).length === 1) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'No llegó ningún cambio.')
    registrarEvento(db, sala.id, ahora, 'participante_editado', por, detalle)
    registrarCambiosPrecierre(db, sala, antes, ahora)
    tocar(db, sala.id)
    const n = uno<ParticipanteFila>(db, 'SELECT * FROM participantes WHERE id = ?', id)!
    return { id: n.id, nombre: n.nombre, correo: n.correo, mesa_id: n.mesa_id, perfil_id: n.perfil_id, activo: Boolean(n.activo) }
  })
}

// --- Export CSV (UTF-8 con BOM, separador ";" para Excel en español) -------------------

const celda = (v: unknown) => {
  let s = v === null || v === undefined ? '' : String(v)
  // Evita inyección de fórmulas: Excel ejecuta celdas que empiezan con = + - @ (o tab / CR).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const csv = (filas: unknown[][]) => '﻿' +filas.map((f) => f.map(celda).join(';')).join('\r\n') + '\r\n'

export function exportInscritos(db: Db, salaId: string) {
  const sala = cargarSala(db, salaId)
  const filas = todos<ParticipanteFila & { mesa: string; version_aviso: string | null; aceptado_at: string | null; politica_url: string | null; ip_aviso: string | null; pais: string | null }>(
    db,
    `SELECT p.*, m.nombre AS mesa, c.version_aviso, c.aceptado_at, c.politica_url, c.ip AS ip_aviso, c.pais
       FROM participantes p JOIN mesas m ON m.id = p.mesa_id
       LEFT JOIN consentimientos c ON c.id = (SELECT MIN(id) FROM consentimientos WHERE participante_id = p.id)
      WHERE p.sala_id = ? ORDER BY m.numero, p.creado_at`,
    sala.id,
  )
  return csv([
    // `ip` y `pais` (del aviso aceptado) al final (acta del 16-oct): quien ya lee el archivo por posición no se rompe.
    ['nombre', 'correo', 'mesa', 'perfil', 'activo', 'consentimiento_version', 'consentimiento_at', 'politica_url', 'ip', 'pais'],
    ...filas.map((p) => [
      p.nombre,
      p.correo,
      p.mesa,
      nombrePerfil(p.perfil_id),
      p.activo ? 'si' : 'no',
      p.version_aviso,
      isoEnZona(p.aceptado_at, sala.zona_horaria),
      p.politica_url,
      p.ip ?? p.ip_aviso,
      p.pais,
    ]),
  ])
}

export function exportVotos(db: Db, salaId: string) {
  const sala = cargarSala(db, salaId)
  const filas = todos<Record<string, string | number>>(
    db,
    `SELECT v.participante_id, m.nombre AS mesa, p.perfil_id, p.activo, v.ronda, v.proyecto_id, ${CRITERIOS.map((c) => `v.${c}`).join(', ')}, v.ip,
            (SELECT c.pais FROM consentimientos c WHERE c.participante_id = p.id ORDER BY c.id LIMIT 1) AS pais
       FROM votos v JOIN participantes p ON p.id = v.participante_id JOIN mesas m ON m.id = p.mesa_id
      WHERE v.sala_id = ? ORDER BY m.numero, v.participante_id, v.ronda, v.proyecto_id`,
    sala.id,
  )
  return csv([
    // `activo`: los votos de desactivados no cuentan en la matriz; con esta columna Excel cuadra con el tablero.
    // `ip` (del último guardado del voto) y `pais` (del aviso aceptado) al final (acta del 16-oct).
    ['id_hash', 'mesa', 'perfil', 'ronda', 'proyecto', ...CRITERIOS, 'activo', 'ip', 'pais'],
    ...filas.map((f) => [
      sha256(`${sala.id}:${f.participante_id}`).slice(0, 12),
      f.mesa,
      nombrePerfil(String(f.perfil_id)),
      f.ronda,
      f.proyecto_id,
      ...CRITERIOS.map((c) => f[c]),
      f.activo ? 'si' : 'no',
      f.ip,
      f.pais,
    ]),
  ])
}

/** Número con 2 decimales y coma decimal (Excel en español, como el separador `;`). */
const decimal = (n: number) => (Math.round(n * 100) / 100).toFixed(2).replace('.', ',')

/**
 * `resultados.csv` (QA por roles, 20-oct): lo que se le puede entregar al cliente, sin datos personales. Una fila por
 * alcance (la sala y cada mesa), ronda y proyecto vivo con el resultado exacto: votos, los 6 promedios, t2m y ejes. Solo
 * alcances con el mínimo de votos de la sala o más (con menos, el promedio delata respuestas; en un ensayo, 1). Solo votos de participantes activos.
 */
export function exportResultados(db: Db, salaId: string) {
  const sala = cargarSala(db, salaId)
  const pesos = contenido(db, sala.id).pesos
  const proyectosVivos = vivos(db, sala.id)
  const alcances = [{ nombre: 'sala', mesaId: undefined as string | undefined }, ...mesasDeSala(db, sala.id).map((m) => ({ nombre: m.nombre, mesaId: m.id }))]
  const rondas = [1, 2].filter((r) => r <= sala.ronda_actual)
  const filas: unknown[][] = []
  for (const a of alcances) {
    for (const r of rondas) {
      const porProyecto = votosDelAlcance(db, sala.id, r, a.mesaId)
      for (const p of proyectosVivos) {
        const ag = agregar((porProyecto.get(p.id) ?? []).map((v) => v.entradas), pesos)
        if (!ag || ag.n_votos < minimoVotos(sala)) continue
        filas.push([a.nombre, r, p.nombre, ag.n_votos, ...CRITERIOS.map((c) => decimal(ag.promedios[c])), decimal(ag.t2m), decimal(ag.eje_x), decimal(ag.eje_y)])
      }
    }
  }
  return csv([['alcance', 'ronda', 'proyecto', 'n_votos', ...CRITERIOS, 't2m', 'eje_x', 'eje_y'], ...filas])
}

/** Eventos de la sala, del más reciente al más antiguo. `antes` = id del último evento recibido. */
export function eventosPaginados(db: Db, sala: SalaFila, antes: number | undefined, limite: number) {
  const n = Math.min(Math.max(1, Math.floor(limite)), 200)
  const filas = todos<{ id: number; at: string; tipo: string; por: string; detalle_json: string | null }>(
    db,
    `SELECT id, at, tipo, por, detalle_json FROM eventos WHERE sala_id = ? ${antes ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    ...(antes ? [sala.id, antes, n + 1] : [sala.id, n + 1]),
  )
  const pagina = filas.slice(0, n)
  return {
    eventos: pagina.map((e) => ({ id: e.id, at: isoEnZona(e.at, sala.zona_horaria), tipo: e.tipo, detalle: e.detalle_json ? JSON.parse(e.detalle_json) : null, por: e.por })),
    siguiente: filas.length > n ? pagina[pagina.length - 1].id : null,
  }
}
