// Utilidades para pruebas de integración contra la API real (BD en memoria y reloj simulado).
import type { FastifyInstance } from 'fastify'
import { construirApp } from '../../server/app'
import { abrirDb, type Db } from '../../server/db/index'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { VERSION_CONSENTIMIENTO } from '../../server/dominio/consentimiento'

export const RESPUESTAS_5 = {
  alistamiento_tecnico: 5,
  conocimiento_cliente: 5,
  regulacion: 5,
  capacidades_organizacionales: 5,
  alineacion_core: 5,
  inversion_requerida: 5,
}

export interface Entorno {
  app: FastifyInstance
  db: Db
  reloj: { ms: number }
  /** Cookie de sesión del superadmin (usuario "paola"). */
  cookie: string
}

export const T0 = Date.parse('2026-10-20T14:00:00-05:00')

export async function crearEntorno(): Promise<Entorno> {
  const db = abrirDb(':memory:')
  const reloj = { ms: T0 }
  asegurarSuperadmin(db, 'paola', 'superclave123', reloj.ms)
  const app = await construirApp({ db, ahora: () => reloj.ms, intervaloCierresMs: 0, baseUrl: 'https://horizontes.test' })
  const cookie = await loginCookie(app, 'paola', 'superclave123')
  return { app, db, reloj, cookie }
}

export async function loginCookie(app: FastifyInstance, usuario: string, clave: string): Promise<string> {
  const r = await app.inject({ method: 'POST', url: '/api/admin/login', payload: { usuario, clave } })
  if (r.statusCode !== 200) throw new Error(`login falló: ${r.statusCode} ${r.body}`)
  const c = r.cookies.find((x) => x.name === 'hz_admin')!
  return `hz_admin=${c.value}`
}

export async function crearSala(e: Entorno, mesas = 2, nombre = 'Sala de prueba') {
  const r = await e.app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie: e.cookie }, payload: { nombre, plantilla: 'foodsume_2026', mesas } })
  if (r.statusCode !== 201) throw new Error(`crear sala falló: ${r.body}`)
  return r.json() as { id: string; codigo: string; token_tablero: string; mesas: { id: string; codigo: string }[] }
}

export async function accion(e: Entorno, salaId: string, accion: string, extra: object = {}) {
  return e.app.inject({ method: 'POST', url: `/api/admin/salas/${salaId}/acciones`, headers: { cookie: e.cookie }, payload: { accion, ...extra } })
}

export async function inscribir(e: Entorno, codigoMesa: string, correo: string, nombre = 'Persona Prueba') {
  const r = await e.app.inject({
    method: 'POST',
    url: '/api/inscripcion',
    payload: { codigoMesa, nombre, correo, consentimiento: { aceptado: true, version: VERSION_CONSENTIMIENTO } },
    headers: { 'user-agent': 'vitest' },
  })
  return r
}

export async function votar(e: Entorno, token: string, proyecto_id: string, ronda: number, respuestas: object = RESPUESTAS_5) {
  return e.app.inject({ method: 'PUT', url: '/api/votos', headers: { 'x-participante-token': token }, payload: { proyecto_id, ronda, respuestas } })
}
