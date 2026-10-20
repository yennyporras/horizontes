import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { FastifyInstance } from 'fastify'
import { RAIZ } from './config.js'
import { cuerpoError, responderConVersion } from './http.js'
import { consentimientoVigente } from './dominio/consentimiento.js'
import { MOTIVO_CON_VOTOS } from './dominio/rubricas.js'
import { nombrePerfil, semilla } from './dominio/semilla.js'

// Servidor de mocks (USE_MOCKS=1 o --mocks): sirve mocks/*.json en las rutas del contrato.
// Se relee el archivo en cada petición: editar un mock se ve sin reiniciar.
const leer = (nombre: string) => JSON.parse(readFileSync(resolve(RAIZ, 'mocks', `${nombre}.json`), 'utf8'))

const QR_MOCK =
  '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/>' +
  '<text x="100" y="105" text-anchor="middle" font-family="sans-serif">QR mock</text></svg>'

export async function rutasMocks(app: FastifyInstance) {
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Horizontes-Mock', '1')
    return payload
  })

  // Participante
  app.get<{ Params: { codigo: string } }>('/api/mesas/:codigo', async (req, reply) => {
    if (req.params.codigo.toUpperCase() === 'NOEXISTE') {
      return reply.code(404).send(cuerpoError('MESA_NO_EXISTE', 'No encontramos esa mesa. Revisa el código o el QR.'))
    }
    const yo = leer('GET_api_yo')
    return {
      sala: { id: yo.sala.id, nombre: yo.sala.nombre, estado: yo.sala.estado, pais: yo.config.pais },
      mesa: { id: yo.participante.mesa.id, nombre: yo.participante.mesa.nombre },
      inscripcion_abierta: true,
      consentimiento: consentimientoVigente(yo.config.pais),
    }
  })

  app.post<{
    Body: { codigoMesa?: string; nombre?: string; correo?: string; consentimiento?: { aceptado?: boolean; version?: string } }
  }>('/api/inscripcion', async (req, reply) => {
    const b = req.body ?? {}
    if (!b.consentimiento?.aceptado) {
      return reply
        .code(422)
        .send(cuerpoError('CONSENTIMIENTO_REQUERIDO', 'Para continuar debes aceptar la autorización de tratamiento de datos.'))
    }
    const yo = leer('GET_api_yo')
    return reply.code(201).send({
      token: 'mock-token-participante',
      participante: { id: yo.participante.id, nombre: b.nombre ?? yo.participante.nombre, mesa: yo.participante.mesa, perfil: yo.participante.perfil },
    })
  })

  app.get('/api/yo', async (req, reply) => responderConVersion(req, reply, leer('GET_api_yo')))

  app.put<{ Body: { proyecto_id: string; ronda: number; respuestas: Record<string, number> } }>('/api/votos', async (req, reply) => {
    const b = req.body
    const valores = Object.values(b?.respuestas ?? {})
    if (valores.length !== 6 || valores.some((v) => ![1, 3, 5, 7, 9].includes(v))) {
      return reply.code(422).send(cuerpoError('RESPUESTA_INVALIDA', 'Responde las 6 preguntas con 1, 3, 5, 7 o 9.'))
    }
    const yo = leer('GET_api_yo')
    return {
      voto: { proyecto_id: b.proyecto_id, ronda: b.ronda, respuestas: b.respuestas, actualizado_at: new Date().toISOString() },
      completo_ronda: false,
      progreso_mesa: yo.progreso_mesa,
    }
  })

  app.get('/api/resultados', async (req, reply) => responderConVersion(req, reply, leer('GET_api_tablero')))

  // Tablero
  app.get('/api/tablero/:salaId', async (req, reply) => responderConVersion(req, reply, leer('GET_api_tablero')))

  // Admin
  const admin = () => leer('GET_api_admin_salas_id')
  app.post('/api/admin/login', async () => ({ ok: true, admin: admin().admin_actual }))
  app.post('/api/admin/logout', async () => ({ ok: true }))
  app.get('/api/admin/yo', async () => admin().admin_actual)
  app.get('/api/admin/salas', async () => {
    const a = admin()
    return {
      salas: [{ id: a.sala.id, codigo: a.sala.codigo, nombre: a.sala.nombre, estado: a.sala.estado, creada_at: a.sala.creada_at, mesas: a.mesas.length }],
    }
  })
  app.post('/api/admin/salas', async (_req, reply) => reply.code(201).send(admin().sala))
  app.post('/api/admin/salas/:id/duplicar', async (_req, reply) => reply.code(201).send({ ...admin().sala, id: 's_copia', nombre: `${admin().sala.nombre} (copia)`, estado: 'preparada' }))
  app.get('/api/admin/salas/:id', async (req, reply) => responderConVersion(req, reply, admin()))
  app.patch('/api/admin/salas/:id/config', async (req) => ({ ...admin().sala.config, ...(req.body as object) }))
  app.post('/api/admin/salas/:id/acciones', async () => ({ sala: admin().sala }))
  // La sala del mock está en ronda 1 con votos: las rúbricas se ven pero no se editan.
  app.get('/api/admin/salas/:id/rubricas', async () => ({
    criterios: semilla().motor.criterios.map((c) => ({ id: c.id, nombre: c.nombre, pregunta: c.pregunta, rubrica: c.rubrica })),
    editable: false,
    motivo_no_editable: MOTIVO_CON_VOTOS,
  }))
  app.put('/api/admin/salas/:id/rubricas/:criterio', async (_req, reply) => reply.code(409).send(cuerpoError('RUBRICA_CON_VOTOS', MOTIVO_CON_VOTOS)))
  // Las 12 hojas de la semilla (6 perfiles por proyecto vivo), en el orden del catálogo de perfiles.
  app.get('/api/admin/salas/:id/hojas', async () => {
    const { perfiles, plantilla } = semilla()
    const proyecto = (id: string) => plantilla.proyectos.find((p) => p.id === id)?.nombre ?? id
    return {
      hojas: perfiles.flatMap((pf) =>
        plantilla.hojas.filter((h) => h.perfil_id === pf.id).map((h) => ({ ...h, proyecto: proyecto(h.proyecto_id), perfil: nombrePerfil(h.perfil_id) })),
      ),
    }
  })
  // Respuestas por persona: los votos del mock de /api/yo a nombre del participante del mock de la sala.
  app.get('/api/admin/salas/:id/respuestas', async () => {
    const a = admin()
    const p = a.participantes[0]
    const mesa = a.mesas.find((m: { id: string }) => m.id === p.mesa_id)
    return {
      respuestas: (leer('GET_api_yo').mis_votos as object[]).map((v) => ({
        participante_id: p.id,
        nombre: p.nombre,
        correo: p.correo,
        mesa_id: p.mesa_id,
        mesa: mesa?.nombre ?? '',
        perfil_id: p.perfil_id,
        activo: p.activo,
        ...v,
      })),
    }
  })
  // Modo guiado: el mock acepta cualquier pregunta (o null) y no la guarda.
  app.put('/api/admin/salas/:id/pregunta-guiada', async (req) => ({ pregunta_guiada: req.body ?? null, version: admin().version }))
  app.post('/api/admin/salas/:id/mesas', async () => ({ mesas: admin().mesas }))
  app.patch('/api/admin/participantes/:id', async (req) => ({ ...admin().participantes[0], ...(req.body as object) }))
  app.get('/api/admin/admins', async () => ({ admins: [admin().admin_actual] }))
  app.post('/api/admin/admins', async (req, reply) => reply.code(201).send({ id: 2, rol: 'admin', activo: true, ...(req.body as object) }))
  app.patch('/api/admin/admins/:id', async (req) => ({ id: 2, rol: 'admin', activo: true, ...(req.body as object) }))
  app.post('/api/admin/cambiar-clave', async () => ({ ok: true }))
  app.get('/api/admin/mesas/:mesaId/qr.svg', async (_req, reply) => reply.type('image/svg+xml').send(QR_MOCK))
  app.get('/api/admin/salas/:id/export/:archivo', async (_req, reply) => reply.type('text/csv; charset=utf-8').send('﻿columna\nmock\n'))
}
