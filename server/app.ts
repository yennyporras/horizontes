import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { RAIZ, config } from './config.js'
import { ErrorApi, cuerpoError } from './http.js'
import { rutasMocks } from './mocks.js'
import { type Db, abrirDb } from './db/index.js'
import { asegurarSuperadmin } from './dominio/admins.js'
import { aplicarCierresProgramados } from './dominio/estados.js'
import type { Reloj } from './dominio/util.js'
import { rutasApi } from './rutas/api.js'

export interface OpcionesApp {
  mocks?: boolean
  logger?: boolean
  /** BD ya abierta (pruebas). Si falta, se abre config.dbPath. */
  db?: Db
  /** Reloj inyectable para simular la hora en pruebas. */
  ahora?: Reloj
  /** Intervalo del chequeo de cierres programados (ms). 0 lo apaga. Por defecto 15 s. */
  intervaloCierresMs?: number
  baseUrl?: string
}

export async function construirApp(op: OpcionesApp = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: op.logger ?? false, trustProxy: true })
  await app.register(cookie)

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ErrorApi) return reply.code(err.status).send(cuerpoError(err.codigo, err.message))
    if ((err as { validation?: unknown }).validation) return reply.code(400).send(cuerpoError('PETICION_INVALIDA', (err as Error).message))
    app.log.error(err)
    return reply.code(500).send(cuerpoError('ERROR_INTERNO', 'Algo falló en el servidor. Intenta de nuevo.'))
  })

  app.get('/api/health', async () => ({ ok: true, modo: op.mocks ? 'mocks' : 'api' }))

  if (op.mocks) {
    await app.register(rutasMocks)
  } else {
    const db = op.db ?? abrirDb(config.dbPath)
    const ahora = op.ahora ?? Date.now
    const sa = asegurarSuperadmin(db, config.superadminUsuario, config.superadminClave, ahora())
    if (sa === 'creado') app.log.info(`Superadmin "${config.superadminUsuario}" creado desde .env`)
    if (sa === 'sin_config') app.log.warn('SUPERADMIN_USUARIO / SUPERADMIN_CLAVE no están definidos: no se creó superadmin.')
    if (!process.env.POLITICA_PRIVACIDAD_URL) app.log.warn(`POLITICA_PRIVACIDAD_URL no está definida: se usa ${config.politicaUrl}`)
    const baseUrl = op.baseUrl ?? config.baseUrl
    await app.register(rutasApi, { db, ahora, baseUrl })
    const intervalo = op.intervaloCierresMs ?? 15_000
    if (intervalo > 0) {
      const t = setInterval(() => {
        try {
          aplicarCierresProgramados(db, ahora())
        } catch (e) {
          app.log.error(e)
        }
      }, intervalo)
      t.unref()
      app.addHook('onClose', async () => clearInterval(t))
    }
    if (!op.db) app.addHook('onClose', async () => db.close())
  }

  // Producción: sirve el build de Vite (dist/web) con fallback SPA para /m, /tablero y /admin.
  const web = resolve(RAIZ, 'dist', 'web')
  const hayWeb = existsSync(web)
  if (hayWeb) await app.register(fastifyStatic, { root: web, wildcard: false })
  app.setNotFoundHandler((req, reply) => {
    if (!hayWeb || req.url.startsWith('/api/')) return reply.code(404).send(cuerpoError('NO_ENCONTRADO', 'Ruta no encontrada.'))
    return reply.sendFile('index.html')
  })

  return app
}
