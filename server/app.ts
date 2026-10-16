import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import Fastify, { type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { RAIZ } from './config.js'
import { ErrorApi, cuerpoError } from './http.js'
import { rutasMocks } from './mocks.js'

export interface OpcionesApp {
  mocks?: boolean
  logger?: boolean
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
    // La API real llega en R1. Mientras tanto, cualquier otra ruta /api responde 501.
    app.all('/api/*', async (_req, reply) =>
      reply.code(501).send(cuerpoError('NO_IMPLEMENTADO', 'Esta ruta aún no está implementada. Usa USE_MOCKS=1.')),
    )
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
