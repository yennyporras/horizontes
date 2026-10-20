// Flujo del participante (SPEC §2): inscripción con consentimiento, perfil balanceado, votos y resultados.
import { type Db, ejecutar, todos, transaccion, uno } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { CRITERIOS, type Entradas } from '../../shared/motor/motor.js'
import { MENSAJE_CORREO_YA_INSCRITO } from './accesos.js'
import { VERSION_CONSENTIMIENTO, consentimientoVigente, hashTextoConsentimiento } from './consentimiento.js'
import { construirTablero, contenido, preguntaGuiada, progreso, proyectos, rondaAbierta, rondaCerrada, vivos } from './resultados.js'
import { type MesaFila, type SalaFila, cargarSala, registrarEvento, tocar } from './salas.js'
import { nombrePerfil, perfiles } from './semilla.js'
import { type ZonaHoraria, idAleatorio, isoEnZona, isoUtc, sha256, tokenAleatorio } from './util.js'

export interface ParticipanteFila {
  id: string
  sala_id: string
  mesa_id: string
  nombre: string
  correo: string
  perfil_id: string
  token_hash: string
  activo: number
  creado_at: string
  ip: string | null
}

export const ESTADOS_INSCRIPCION = ['inscripcion', 'r1_abierta', 'r1_cerrada', 'r2_abierta']

export function mesaPorCodigo(db: Db, codigo: string): MesaFila {
  const m = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE codigo = ?', String(codigo ?? '').trim().toUpperCase())
  if (!m) throw new ErrorApi(404, 'MESA_NO_EXISTE', 'No encontramos esa mesa. Revisa el código o el QR.')
  return m
}

export function infoMesa(db: Db, codigo: string) {
  const m = mesaPorCodigo(db, codigo)
  const s = cargarSala(db, m.sala_id)
  return {
    sala: { id: s.id, nombre: s.nombre, estado: s.estado, pais: s.pais },
    mesa: { id: m.id, nombre: m.nombre },
    inscripcion_abierta: ESTADOS_INSCRIPCION.includes(s.estado),
    consentimiento: consentimientoVigente(s.pais),
  }
}

/** Perfil con menos personas activas en la mesa; empate → orden del catálogo. */
export function perfilBalanceado(db: Db, mesaId: string): string {
  const conteo = new Map(
    todos<{ perfil_id: string; n: number }>(db, 'SELECT perfil_id, COUNT(*) AS n FROM participantes WHERE mesa_id = ? AND activo = 1 GROUP BY perfil_id', mesaId).map(
      (f) => [f.perfil_id, Number(f.n)],
    ),
  )
  let mejor = perfiles()[0].id
  let min = Infinity
  for (const p of perfiles()) {
    const n = conteo.get(p.id) ?? 0
    if (n < min) {
      min = n
      mejor = p.id
    }
  }
  return mejor
}

const RE_CORREO = /^[^\s@<>"`;,()\\]+@[^\s@<>"`;,()\\]+\.[^\s@<>"`;,()\\]+$/
const RE_NOMBRE_PROHIBIDO = /[\u0000-\u001f\u007f<>{}\\`]/

export interface DatosInscripcion {
  codigoMesa?: unknown
  nombre?: unknown
  correo?: unknown
  consentimiento?: { aceptado?: unknown; version?: unknown }
}

export interface ContextoPeticion {
  ip?: string
  userAgent?: string
}

const ipGuardable = (ctx: ContextoPeticion) => ctx.ip?.slice(0, 45) ?? null

export function participantePublico(p: ParticipanteFila, mesa: MesaFila) {
  return { id: p.id, nombre: p.nombre, mesa: { id: mesa.id, nombre: mesa.nombre }, perfil: { id: p.perfil_id, nombre: nombrePerfil(p.perfil_id) } }
}

/**
 * Inscribe a una persona nueva (201). Un correo ya inscrito en la sala responde 409 CORREO_YA_INSCRITO sin token ni datos
 * (D1, 20-oct): la sesión la devuelve el facilitador con «Dar acceso de nuevo» (`accesos.ts`).
 */
export function inscribir(db: Db, d: DatosInscripcion, ctx: ContextoPeticion, ahora: number) {
  const mesa = mesaPorCodigo(db, String(d.codigoMesa ?? ''))
  if (d.consentimiento?.aceptado !== true) {
    throw new ErrorApi(422, 'CONSENTIMIENTO_REQUERIDO', 'Para continuar debes aceptar la autorización de tratamiento de datos.')
  }
  if (d.consentimiento.version !== VERSION_CONSENTIMIENTO) {
    throw new ErrorApi(422, 'CONSENTIMIENTO_REQUERIDO', 'El aviso de datos cambió. Recarga la página y vuelve a aceptarlo.')
  }
  const nombre = typeof d.nombre === 'string' ? d.nombre.trim().replace(/\s+/g, ' ') : ''
  const correo = typeof d.correo === 'string' ? d.correo.trim().toLowerCase() : ''
  if (nombre.length < 2 || nombre.length > 120) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Escribe tu nombre (entre 2 y 120 caracteres).')
  // Sin caracteres de control ni marcado: el nombre sale en el panel admin y en los CSV.
  if (RE_NOMBRE_PROHIBIDO.test(nombre)) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Tu nombre solo puede tener letras, números y signos comunes.')
  if (!RE_CORREO.test(correo) || correo.length > 160) throw new ErrorApi(422, 'DATOS_INVALIDOS', 'Escribe un correo válido.')

  return transaccion(db, () => {
    const sala = cargarSala(db, mesa.sala_id)
    // La sala se revisa antes que el correo: con la inscripción cerrada no se informa si un correo estaba inscrito.
    if (!ESTADOS_INSCRIPCION.includes(sala.estado)) {
      throw new ErrorApi(409, 'INSCRIPCION_CERRADA', sala.estado === 'cerrada' ? 'Esta sala ya se cerró.' : 'La inscripción aún no está abierta. Espera la indicación del facilitador.')
    }
    if (uno(db, 'SELECT 1 FROM participantes WHERE sala_id = ? AND correo = ?', sala.id, correo)) {
      throw new ErrorApi(409, 'CORREO_YA_INSCRITO', MENSAJE_CORREO_YA_INSCRITO)
    }
    const token = tokenAleatorio()
    const antes = progreso(db, sala)
    const p: ParticipanteFila = {
      id: idAleatorio('p', 8),
      sala_id: sala.id,
      mesa_id: mesa.id,
      nombre,
      correo,
      perfil_id: perfilBalanceado(db, mesa.id),
      token_hash: sha256(token),
      activo: 1,
      creado_at: isoUtc(ahora),
      ip: ipGuardable(ctx),
    }
    ejecutar(
      db,
      'INSERT INTO participantes (id, sala_id, mesa_id, nombre, correo, perfil_id, token_hash, activo, creado_at, ip) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
      p.id,
      p.sala_id,
      p.mesa_id,
      p.nombre,
      p.correo,
      p.perfil_id,
      p.token_hash,
      p.creado_at,
      p.ip,
    )
    registrarEvento(db, sala.id, ahora, 'inscripcion', 'sistema', { participante_id: p.id, mesa_id: mesa.id, perfil_id: p.perfil_id })
    registrarCambiosPrecierre(db, sala, antes, ahora)
    const c = consentimientoVigente(sala.pais)
    ejecutar(
      db,
      'INSERT INTO consentimientos (participante_id, version_aviso, politica_url, texto_hash, aceptado_at, ip, user_agent, pais) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      p.id,
      c.version,
      c.politica_url,
      hashTextoConsentimiento(sala.pais),
      isoUtc(ahora),
      ipGuardable(ctx),
      ctx.userAgent?.slice(0, 255) ?? null,
      sala.pais,
    )
    tocar(db, sala.id)
    const mesaP = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ?', p.mesa_id)!
    return { token, participante: participantePublico(p, mesaP) }
  })
}

export function autenticarParticipante(db: Db, token: string | undefined): ParticipanteFila {
  if (!token) throw new ErrorApi(401, 'TOKEN_REQUERIDO', 'Tu sesión no es válida. Pídele al facilitador que te dé acceso de nuevo.')
  const p = uno<ParticipanteFila>(db, 'SELECT * FROM participantes WHERE token_hash = ?', sha256(token))
  if (!p) throw new ErrorApi(401, 'TOKEN_INVALIDO', 'Tu sesión no es válida. Pídele al facilitador que te dé acceso de nuevo.')
  return p
}

/** Registra en eventos las mesas (y la sala) que entran en precierre tras una escritura. */
export function registrarCambiosPrecierre(db: Db, sala: SalaFila, antes: ReturnType<typeof progreso>, ahora: number) {
  const despues = progreso(db, sala)
  const prev = new Map(antes.por_mesa.map((m) => [m.mesa_id, m.precierre]))
  for (const m of despues.por_mesa) {
    if (m.precierre && !prev.get(m.mesa_id)) {
      registrarEvento(db, sala.id, ahora, 'precierre', 'sistema', { mesa_id: m.mesa_id, ronda: despues.ronda, mensaje: `Todos votaron en ${m.nombre}. Puedes cerrar la ronda.` })
    }
  }
  if (despues.precierre && !antes.precierre) {
    registrarEvento(db, sala.id, ahora, 'precierre', 'sistema', { alcance: 'sala', ronda: despues.ronda, mensaje: 'Todos votaron en la sala. Puedes cerrar la ronda.' })
  }
}

// --- Votos ---------------------------------------------------------------------

interface VotoFila extends Entradas {
  proyecto_id: string
  ronda: number
  actualizado_at: string
}

const votoPublico = (v: VotoFila, zona: ZonaHoraria) => ({
  proyecto_id: v.proyecto_id,
  ronda: v.ronda,
  respuestas: Object.fromEntries(CRITERIOS.map((c) => [c, v[c]])) as Entradas,
  actualizado_at: isoEnZona(v.actualizado_at, zona),
})

function misVotos(db: Db, p: ParticipanteFila, ronda: number) {
  return todos<VotoFila>(db, `SELECT proyecto_id, ronda, ${CRITERIOS.join(', ')}, actualizado_at FROM votos WHERE participante_id = ? AND ronda = ?`, p.id, ronda)
}

function misVotosAntes(db: Db, p: ParticipanteFila, ronda: number) {
  return todos<VotoFila>(db, `SELECT proyecto_id, ronda, ${CRITERIOS.join(', ')}, actualizado_at FROM votos WHERE participante_id = ? AND ronda < ? ORDER BY ronda`, p.id, ronda)
}

export interface DatosVoto {
  proyecto_id?: unknown
  ronda?: unknown
  respuestas?: unknown
}

export function votar(db: Db, p: ParticipanteFila, d: DatosVoto, ctx: ContextoPeticion, ahora: number) {
  if (!p.activo) throw new ErrorApi(403, 'PARTICIPANTE_INACTIVO', 'Tu inscripción está desactivada. Habla con el facilitador.')
  // Validación estricta: tipos exactos del contrato (ronda número, respuestas objeto con los 6 criterios y nada más).
  const ronda = d.ronda
  if (ronda !== 1 && ronda !== 2) throw new ErrorApi(422, 'RESPUESTA_INVALIDA', 'La ronda debe ser 1 o 2.')
  const r = d.respuestas as Record<string, unknown> | undefined
  const claves = r && typeof r === 'object' && !Array.isArray(r) ? Object.keys(r) : []
  if (claves.length !== CRITERIOS.length || !CRITERIOS.every((c) => [1, 3, 5, 7, 9].includes(r![c] as number))) {
    throw new ErrorApi(422, 'RESPUESTA_INVALIDA', 'Responde las 6 preguntas con 1, 3, 5, 7 o 9.')
  }
  const proyectoId = typeof d.proyecto_id === 'string' ? d.proyecto_id : ''
  if (!vivos(db, p.sala_id).some((x) => x.id === proyectoId)) {
    throw new ErrorApi(422, 'PROYECTO_INVALIDO', 'Solo se votan INSUMEX y NUTRIWHAT.')
  }

  return transaccion(db, () => {
    const sala = cargarSala(db, p.sala_id)
    const abierta = rondaAbierta(sala)
    if (abierta !== ronda) {
      if (rondaCerrada(sala, ronda)) throw new ErrorApi(409, 'RONDA_CERRADA', `La ronda ${ronda} ya se cerró.`)
      throw new ErrorApi(409, 'RONDA_NO_ACTIVA', `La ronda ${ronda} no está abierta.`)
    }
    const antes = progreso(db, sala)
    const vals = CRITERIOS.map((c) => r![c] as number)
    ejecutar(
      db,
      `INSERT INTO votos (participante_id, sala_id, proyecto_id, ronda, ${CRITERIOS.join(', ')}, actualizado_at, ip)
       VALUES (?, ?, ?, ?, ${CRITERIOS.map(() => '?').join(', ')}, ?, ?)
       ON CONFLICT (participante_id, proyecto_id, ronda) DO UPDATE SET
       ${CRITERIOS.map((c) => `${c} = excluded.${c}`).join(', ')}, actualizado_at = excluded.actualizado_at, ip = excluded.ip`,
      p.id,
      p.sala_id,
      proyectoId,
      ronda,
      ...vals,
      isoUtc(ahora),
      ipGuardable(ctx),
    )
    registrarCambiosPrecierre(db, sala, antes, ahora)
    tocar(db, sala.id)
    const s2 = cargarSala(db, sala.id)
    const mios = misVotos(db, p, ronda)
    const prog = progreso(db, s2)
    const pm = prog.por_mesa.find((m) => m.mesa_id === p.mesa_id)!
    return {
      voto: votoPublico(mios.find((v) => v.proyecto_id === proyectoId)!, s2.zona_horaria),
      completo_ronda: mios.length >= vivos(db, p.sala_id).length,
      progreso_mesa: { inscritos: pm.inscritos, completos: pm.completos, precierre: pm.precierre },
    }
  })
}

// --- Resultados visibles para el participante (§2.6, §2.7, §4) ---------------------

export type Visibilidad = { visible: false } | { visible: true; preliminar: boolean }

export function visibilidadResultados(db: Db, sala: SalaFila, p: ParticipanteFila, ronda: number): Visibilidad {
  if (!p.activo) return { visible: false }
  if (ronda < 1 || ronda > sala.ronda_actual) return { visible: false }
  if (rondaCerrada(sala, ronda)) return { visible: true, preliminar: false }
  if (rondaAbierta(sala) !== ronda) return { visible: false }
  const prog = progreso(db, sala)
  const precierre = sala.alcance_resultados === 'sala' ? prog.precierre : (prog.por_mesa.find((m) => m.mesa_id === p.mesa_id)?.precierre ?? false)
  if (precierre) return { visible: true, preliminar: true }
  // en_vivo: el tablero en vivo se ve después de votar los 2 proyectos (SPEC §2.6).
  if (sala.vista_participante === 'en_vivo' && p.activo && misVotos(db, p, ronda).length >= vivos(db, sala.id).length) {
    return { visible: true, preliminar: true }
  }
  return { visible: false }
}

export function resultadosParticipante(db: Db, sala: SalaFila, p: ParticipanteFila, ronda: number) {
  const v = visibilidadResultados(db, sala, p, ronda)
  if (!v.visible) return null
  const mesa = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ?', p.mesa_id)!
  const rondas = ronda === 2 ? [1, 2] : [1]
  return construirTablero(db, sala, {
    alcance: sala.alcance_resultados === 'sala' ? { tipo: 'sala' } : { tipo: 'mesa', mesa },
    rondas,
    preliminar: v.preliminar,
    // D2: cuántos hay inscritos en cada mesa no es del participante.
    porMesa: false,
    sufijoVersion: `-r${ronda}-${p.id}`,
  })
}

// --- Hojas de los perfiles --------------------------------------------------------------

/**
 * Hojas de la sala con el nombre del proyecto y del perfil, en el orden del catálogo de perfiles y luego del proyecto.
 * Con `perfilPrimero`, las hojas de ese perfil van adelante (las del participante en /api/yo).
 */
export function hojasDeSala(db: Db, salaId: string, perfilPrimero?: string) {
  const prs = proyectos(db, salaId)
  const nombreProyecto = new Map(prs.map((x) => [x.id, x.nombre]))
  const ordenProyecto = new Map(prs.map((x) => [x.id, x.orden]))
  const ordenPerfil = new Map(perfiles().map((x, i) => [x.id, i]))
  return todos<{ proyecto_id: string; perfil_id: string; texto: string }>(db, 'SELECT proyecto_id, perfil_id, texto FROM hojas WHERE sala_id = ?', salaId)
    .sort(
      (a, b) =>
        Number(b.perfil_id === perfilPrimero) - Number(a.perfil_id === perfilPrimero) ||
        ordenPerfil.get(a.perfil_id)! - ordenPerfil.get(b.perfil_id)! ||
        ordenProyecto.get(a.proyecto_id)! - ordenProyecto.get(b.proyecto_id)!,
    )
    .map((h) => ({ proyecto_id: h.proyecto_id, proyecto: nombreProyecto.get(h.proyecto_id), perfil_id: h.perfil_id, perfil: nombrePerfil(h.perfil_id), texto: h.texto }))
}

// --- GET /api/yo ---------------------------------------------------------------------

export function vistaYo(db: Db, p: ParticipanteFila) {
  const sala = cargarSala(db, p.sala_id)
  const mesa = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ?', p.mesa_id)!
  const c = contenido(db, sala.id)
  const prs = proyectos(db, sala.id)
  // Ronda 1: solo la hoja propia. Con revelar_hojas, las 6 (la propia primero).
  const hojas = hojasDeSala(db, sala.id, p.perfil_id).filter((h) => sala.revelar_hojas || h.perfil_id === p.perfil_id)
  const ronda = sala.ronda_actual
  const mios = ronda > 0 ? misVotos(db, p, ronda) : []
  const idsVivos = vivos(db, sala.id).map((x) => x.id)
  const prog = progreso(db, sala)
  const pm = prog.por_mesa.find((m) => m.mesa_id === p.mesa_id)!
  return {
    version: `v-${sala.version}-${p.id}`,
    participante: { ...participantePublico(p, mesa), activo: Boolean(p.activo) },
    sala: { id: sala.id, nombre: sala.nombre, estado: sala.estado, ronda_actual: sala.ronda_actual, pregunta_guiada: preguntaGuiada(sala) },
    config: {
      vista_participante: sala.vista_participante,
      alcance_resultados: sala.alcance_resultados,
      revelar_hojas: Boolean(sala.revelar_hojas),
      pais: sala.pais,
      zona_horaria: sala.zona_horaria,
      modo_preguntas: sala.modo_preguntas,
    },
    contenido: {
      caso: c.caso,
      portafolio: prs.map((x) => ({ id: x.id, nombre: x.nombre, tipo: x.tipo, sector: x.sector, descripcion: x.descripcion, modo: x.modo })),
      hojas,
    },
    criterios: c.criterios.map((k) => ({ id: k.id, nombre: k.nombre, pregunta: k.pregunta, perfil_informante: k.perfil_informante, rubrica: k.rubrica })),
    escala: c.escala,
    mis_votos: mios.map((v) => votoPublico(v, sala.zona_horaria)),
    // Aditivo (20-oct): los votos propios de las rondas anteriores, para que la comparación R1→R2 del celular muestre
    // «Tú» también en la ronda 1. Son solo de esta persona, igual que mis_votos.
    mis_votos_anteriores: ronda > 1 ? misVotosAntes(db, p, ronda).map((v) => votoPublico(v, sala.zona_horaria)) : [],
    pendientes: idsVivos.filter((id) => !mios.some((v) => v.proyecto_id === id)),
    completo_ronda: ronda > 0 && mios.length >= idsVivos.length,
    progreso_mesa: { inscritos: pm.inscritos, completos: pm.completos, precierre: pm.precierre },
    resultados: ronda > 0 ? resultadosParticipante(db, sala, p, ronda) : null,
  }
}
