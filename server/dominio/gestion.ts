// Vistas y operaciones del panel admin sobre salas, mesas y participantes (SPEC §9).
import { type Db, ejecutar, todos, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { CRITERIOS } from '../../shared/motor/motor.js'
import type { ParticipanteFila } from './participantes.js'
import { registrarCambiosPrecierre } from './participantes.js'
import { configPublica, progreso, rondaReferencia, vivos } from './resultados.js'
import { type MesaFila, type SalaFila, cargarSala, mesasDeSala, registrarEvento, tocar } from './salas.js'
import { nombrePerfil, perfiles } from './semilla.js'
import { isoBogota, sha256 } from './util.js'

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
    creada_at: isoBogota(s.creada_at),
    mesas: Number(s.mesas),
    inscritos: Number(s.inscritos),
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
    creada_at: isoBogota(sala.creada_at),
    config: configPublica(sala),
    token_tablero: sala.token_tablero,
    url_tablero: urls(baseUrl, sala).url_tablero,
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
  const participantes = todos<ParticipanteFila & { votos: number; consentimiento_at: string | null }>(
    db,
    `SELECT p.*,
            (SELECT COUNT(*) FROM votos v WHERE v.participante_id = p.id AND v.ronda = ?) AS votos,
            (SELECT MAX(c.aceptado_at) FROM consentimientos c WHERE c.participante_id = p.id) AS consentimiento_at
       FROM participantes p WHERE p.sala_id = ? ORDER BY p.creado_at`,
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
      consentimiento_at: isoBogota(p.consentimiento_at),
    })),
    perfiles: perfiles(),
    eventos: eventos.map((e) => ({ at: isoBogota(e.at), tipo: e.tipo, detalle: e.detalle_json ? JSON.parse(e.detalle_json) : null, por: e.por })),
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
      if (!perfiles().some((x) => x.id === d.perfil_id)) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Ese perfil no existe.')
      ejecutar(db, 'UPDATE participantes SET perfil_id = ? WHERE id = ?', d.perfil_id, id)
      detalle.perfil_id = d.perfil_id
    }
    if (d.mesa_id !== undefined) {
      const m = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ? AND sala_id = ?', d.mesa_id, p.sala_id)
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
  const filas = todos<ParticipanteFila & { mesa: string; version_aviso: string | null; aceptado_at: string | null; politica_url: string | null }>(
    db,
    `SELECT p.*, m.nombre AS mesa, c.version_aviso, c.aceptado_at, c.politica_url
       FROM participantes p JOIN mesas m ON m.id = p.mesa_id
       LEFT JOIN consentimientos c ON c.id = (SELECT MIN(id) FROM consentimientos WHERE participante_id = p.id)
      WHERE p.sala_id = ? ORDER BY m.numero, p.creado_at`,
    sala.id,
  )
  return csv([
    ['nombre', 'correo', 'mesa', 'perfil', 'activo', 'consentimiento_version', 'consentimiento_at', 'politica_url'],
    ...filas.map((p) => [p.nombre, p.correo, p.mesa, nombrePerfil(p.perfil_id), p.activo ? 'si' : 'no', p.version_aviso, isoBogota(p.aceptado_at), p.politica_url]),
  ])
}

export function exportVotos(db: Db, salaId: string) {
  const sala = cargarSala(db, salaId)
  const filas = todos<Record<string, string | number>>(
    db,
    `SELECT v.participante_id, m.nombre AS mesa, p.perfil_id, v.ronda, v.proyecto_id, ${CRITERIOS.map((c) => `v.${c}`).join(', ')}
       FROM votos v JOIN participantes p ON p.id = v.participante_id JOIN mesas m ON m.id = p.mesa_id
      WHERE v.sala_id = ? ORDER BY m.numero, v.participante_id, v.ronda, v.proyecto_id`,
    sala.id,
  )
  return csv([
    ['id_hash', 'mesa', 'perfil', 'ronda', 'proyecto', ...CRITERIOS],
    ...filas.map((f) => [sha256(`${sala.id}:${f.participante_id}`).slice(0, 12), f.mesa, nombrePerfil(String(f.perfil_id)), f.ronda, f.proyecto_id, ...CRITERIOS.map((c) => f[c])]),
  ])
}

/** Eventos de la sala, del más reciente al más antiguo. `antes` = id del último evento recibido. */
export function eventosPaginados(db: Db, salaId: string, antes: number | undefined, limite: number) {
  const n = Math.min(Math.max(1, Math.floor(limite)), 200)
  const filas = todos<{ id: number; at: string; tipo: string; por: string; detalle_json: string | null }>(
    db,
    `SELECT id, at, tipo, por, detalle_json FROM eventos WHERE sala_id = ? ${antes ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    ...(antes ? [salaId, antes, n + 1] : [salaId, n + 1]),
  )
  const pagina = filas.slice(0, n)
  return {
    eventos: pagina.map((e) => ({ id: e.id, at: isoBogota(e.at), tipo: e.tipo, detalle: e.detalle_json ? JSON.parse(e.detalle_json) : null, por: e.por })),
    siguiente: filas.length > n ? pagina[pagina.length - 1].id : null,
  }
}
