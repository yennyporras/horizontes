// API real (docs/CONTRATO_API.md): participante, tablero y admin.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import QRCode from 'qrcode'
import type { Db } from '../db/index.js'
import { ErrorApi, responderConVersion } from '../http.js'
import {
  type AdminFila,
  adminDeSesion,
  adminPublico,
  cambiarClave,
  crearAdmin,
  editarAdmin,
  exigirSuperadmin,
  listarAdmins,
  login,
  logout,
  DURACION_SESION_MS,
} from '../dominio/admins.js'
import { aplicarAccion, aplicarCierresProgramados, cambiarConfig } from '../dominio/estados.js'
import { detalleSala, editarParticipante, exportInscritos, exportVotos, listarSalas, mesasAdmin, salaResumen, urls } from '../dominio/gestion.js'
import { autenticarParticipante, infoMesa, inscribir, resultadosParticipante, vistaYo, votar } from '../dominio/participantes.js'
import { construirTablero, rondaCerrada } from '../dominio/resultados.js'
import { type MesaFila, agregarMesas, cargarSala, crearSalaDesdePlantilla } from '../dominio/salas.js'
import type { Reloj } from '../dominio/util.js'
import { sha256 } from '../dominio/util.js'
import { uno } from '../db/index.js'

export interface OpcionesApi {
  db: Db
  ahora: Reloj
  baseUrl: string
}

const COOKIE = 'hz_admin'

declare module 'fastify' {
  interface FastifyRequest {
    admin?: AdminFila
  }
}

export async function rutasApi(app: FastifyInstance, op: OpcionesApi) {
  const { db, ahora } = op

  // Chequeo perezoso: los cierres programados vencidos se aplican antes de responder cualquier petición.
  app.addHook('onRequest', async (req) => {
    if (req.url.startsWith('/api/')) aplicarCierresProgramados(db, ahora())
  })

  // --- Participante -------------------------------------------------------------------

  app.get<{ Params: { codigo: string } }>('/api/mesas/:codigo', async (req) => infoMesa(db, req.params.codigo))

  app.post<{ Body: Record<string, never> }>('/api/inscripcion', async (req, reply) => {
    const r = inscribir(db, (req.body ?? {}) as never, { ip: req.ip, userAgent: req.headers['user-agent'] }, ahora())
    if (r.nuevo) return reply.code(201).send({ token: r.token, participante: r.participante })
    return reply.code(409).send({
      error: { codigo: 'CORREO_YA_INSCRITO', mensaje: 'Ese correo ya estaba inscrito en esta sala. Recuperamos tu sesión.' },
      token: r.token,
      participante: r.participante,
    })
  })

  const participante = (req: FastifyRequest) => autenticarParticipante(db, req.headers['x-participante-token'] as string | undefined)

  app.get('/api/yo', async (req, reply) => responderConVersion(req, reply, vistaYo(db, participante(req))))

  app.put('/api/votos', async (req) => votar(db, participante(req), (req.body ?? {}) as never, ahora()))

  app.get<{ Querystring: { ronda?: string } }>('/api/resultados', async (req, reply) => {
    const p = participante(req)
    const sala = cargarSala(db, p.sala_id)
    const ronda = req.query.ronda ? Number(req.query.ronda) : sala.ronda_actual
    const r = resultadosParticipante(db, sala, p, ronda)
    if (!r) throw new ErrorApi(403, 'RESULTADOS_NO_DISPONIBLES', 'Los resultados de esta ronda aún no están disponibles.')
    return responderConVersion(req, reply, r)
  })

  // --- Tablero --------------------------------------------------------------------------

  app.get<{ Params: { salaId: string }; Querystring: { alcance?: string; mesa?: string; t?: string } }>('/api/tablero/:salaId', async (req, reply) => {
    const sala = cargarSala(db, req.params.salaId)
    const sesion = adminDeSesion(db, req.cookies[COOKIE], ahora())
    const esAdmin = Boolean(sesion && !sesion.debe_cambiar_clave)
    if (!esAdmin && (!req.query.t || sha256(req.query.t) !== sala.token_tablero_hash)) {
      throw new ErrorApi(401, 'TOKEN_TABLERO_INVALIDO', 'El enlace del tablero no es válido. Pide el enlace actualizado al facilitador.')
    }
    let alcance: { tipo: 'sala' } | { tipo: 'mesa'; mesa: MesaFila } = { tipo: 'sala' }
    if (req.query.alcance === 'mesa' || (req.query.mesa && req.query.alcance !== 'sala')) {
      const clave = String(req.query.mesa ?? '')
      const mesa = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE sala_id = ? AND (id = ? OR codigo = ?)', sala.id, clave, clave.toUpperCase())
      if (!mesa) throw new ErrorApi(404, 'MESA_NO_EXISTE', 'Esa mesa no existe en esta sala.')
      alcance = { tipo: 'mesa', mesa }
    }
    const ronda = sala.ronda_actual
    const rondas = ronda >= 2 ? [1, 2] : [1]
    const t = construirTablero(db, sala, {
      alcance,
      rondas,
      preliminar: ronda > 0 && !rondaCerrada(sala, ronda),
      sufijoVersion: alcance.tipo === 'mesa' ? `-${alcance.mesa.id}` : '-sala',
    })
    return responderConVersion(req, reply, t)
  })

  // --- Admin ----------------------------------------------------------------------------

  // Secure solo si la petición llegó por HTTPS (Coolify/Traefik manda X-Forwarded-Proto; trustProxy está activo).
  const ponerCookie = (req: FastifyRequest, reply: FastifyReply, token: string) =>
    reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', secure: req.protocol === 'https', maxAge: DURACION_SESION_MS / 1000 })

  app.post<{ Body: { usuario?: unknown; clave?: unknown } }>('/api/admin/login', async (req, reply) => {
    const { token, admin } = login(db, req.body?.usuario, req.body?.clave, ahora())
    ponerCookie(req, reply, token)
    return { ok: true, admin: adminPublico(admin) }
  })

  app.post('/api/admin/logout', async (req, reply) => {
    logout(db, req.cookies[COOKIE])
    reply.clearCookie(COOKIE, { path: '/' })
    return { ok: true }
  })

  // Todas las demás rutas /api/admin/* exigen sesión. Con debe_cambiar_clave solo se permite yo, cambiar-clave y logout.
  const LIBRES_CAMBIO = new Set(['/api/admin/yo', '/api/admin/cambiar-clave'])
  app.addHook('preHandler', async (req) => {
    const url = req.routeOptions.url ?? ''
    if (!url.startsWith('/api/admin/') || url === '/api/admin/login' || url === '/api/admin/logout') return
    const a = adminDeSesion(db, req.cookies[COOKIE], ahora())
    if (!a) throw new ErrorApi(401, 'SESION_REQUERIDA', 'Inicia sesión para continuar.')
    if (a.debe_cambiar_clave && !LIBRES_CAMBIO.has(url)) {
      throw new ErrorApi(403, 'CAMBIO_CLAVE_REQUERIDO', 'Antes de continuar cambia tu clave temporal.')
    }
    req.admin = a
  })
  const por = (req: FastifyRequest) => `admin:${req.admin!.usuario}`

  app.get('/api/admin/yo', async (req) => {
    const a = req.admin!
    return { id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol, debe_cambiar_clave: Boolean(a.debe_cambiar_clave) }
  })

  app.post<{ Body: { actual?: unknown; nueva?: unknown } }>('/api/admin/cambiar-clave', async (req) => {
    cambiarClave(db, req.admin!, req.body?.actual, req.body?.nueva)
    return { ok: true }
  })

  app.get('/api/admin/salas', async () => ({ salas: listarSalas(db) }))

  app.post<{ Body: { nombre?: string; plantilla?: string; mesas?: number } }>('/api/admin/salas', async (req, reply) => {
    const b = req.body ?? {}
    const sala = crearSalaDesdePlantilla(db, { nombre: b.nombre ?? '', plantilla: b.plantilla ?? 'foodsume_2026', mesas: b.mesas ?? 1 }, ahora(), por(req))
    return reply.code(201).send({ ...salaResumen(sala, op.baseUrl), mesas: mesasAdmin(db, sala, op.baseUrl) })
  })

  app.get<{ Params: { id: string } }>('/api/admin/salas/:id', async (req, reply) => {
    const d = detalleSala(db, req.params.id, op.baseUrl)
    const a = req.admin!
    return responderConVersion(req, reply, { ...d, admin_actual: { id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol } })
  })

  app.patch<{ Params: { id: string } }>('/api/admin/salas/:id/config', async (req) => {
    const s = cambiarConfig(db, cargarSala(db, req.params.id).id, (req.body ?? {}) as never, ahora(), por(req))
    return salaResumen(s, op.baseUrl).config
  })

  app.post<{ Params: { id: string }; Body: { accion?: string; ronda?: number } }>('/api/admin/salas/:id/acciones', async (req) => {
    const s = aplicarAccion(db, cargarSala(db, req.params.id).id, String(req.body?.accion ?? ''), ahora(), por(req), { ronda: req.body?.ronda })
    return { sala: salaResumen(s, op.baseUrl) }
  })

  app.post<{ Params: { id: string }; Body: { cantidad?: number } }>('/api/admin/salas/:id/mesas', async (req) => {
    const sala = cargarSala(db, req.params.id)
    agregarMesas(db, sala.id, Number(req.body?.cantidad))
    return { mesas: mesasAdmin(db, cargarSala(db, sala.id), op.baseUrl) }
  })

  app.get<{ Params: { mesaId: string } }>('/api/admin/mesas/:mesaId/qr.svg', async (req, reply) => {
    const m = uno<MesaFila>(db, 'SELECT * FROM mesas WHERE id = ? OR codigo = ?', req.params.mesaId, req.params.mesaId.toUpperCase())
    if (!m) throw new ErrorApi(404, 'MESA_NO_EXISTE', 'Esa mesa no existe.')
    const url = urls(op.baseUrl, cargarSala(db, m.sala_id), m).url_participante!
    const svg = await QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#1C4587', light: '#FFFFFF' } })
    return reply.type('image/svg+xml; charset=utf-8').header('Cache-Control', 'private, max-age=3600').send(svg)
  })

  app.patch<{ Params: { id: string } }>('/api/admin/participantes/:id', async (req) =>
    editarParticipante(db, req.params.id, (req.body ?? {}) as never, ahora(), por(req)),
  )

  app.get('/api/admin/admins', async (req) => {
    exigirSuperadmin(req.admin!)
    return { admins: listarAdmins(db) }
  })
  app.post('/api/admin/admins', async (req, reply) => reply.code(201).send(crearAdmin(db, req.admin!, (req.body ?? {}) as never, ahora())))
  app.patch<{ Params: { id: string } }>('/api/admin/admins/:id', async (req) => editarAdmin(db, req.admin!, Number(req.params.id), (req.body ?? {}) as never))

  app.get<{ Params: { id: string; archivo: string } }>('/api/admin/salas/:id/export/:archivo', async (req, reply) => {
    const sala = cargarSala(db, req.params.id)
    const archivo = req.params.archivo
    if (archivo !== 'inscritos.csv' && archivo !== 'votos.csv') throw new ErrorApi(404, 'NO_ENCONTRADO', 'Ese archivo no existe. Usa inscritos.csv o votos.csv.')
    const cuerpo = archivo === 'inscritos.csv' ? exportInscritos(db, sala.id) : exportVotos(db, sala.id)
    return reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${sala.codigo}_${archivo}"`)
      .send(cuerpo)
  })
}

