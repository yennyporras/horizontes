import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Writable } from 'node:stream'
import Fastify, { type FastifyError, type FastifyInstance, LogController } from 'fastify'
import { constants as zlib } from 'node:zlib'
import compress from '@fastify/compress'
import cookie from '@fastify/cookie'
import fastifyStatic from '@fastify/static'
import { RAIZ, config } from './config.js'
import { ErrorApi, cuerpoError } from './http.js'
import { rutasMocks } from './mocks.js'
import { type Db, abrirDb } from './db/index.js'
import { asegurarSuperadmin } from './dominio/admins.js'
import { aplicarCierresProgramados } from './dominio/estados.js'
import { respaldarBd } from './dominio/mantenimiento.js'
import type { TiemposDemo } from './dominio/demo.js'
import { cargarSala } from './dominio/salas.js'
import type { Reloj } from './dominio/util.js'
import { rutasApi } from './rutas/api.js'
import { LIMITE_CUERPO, ROBOTS_TXT, cabecerasSeguridad, errorDeFastify, opcionesLogger } from './seguridad.js'

export interface OpcionesApp {
  mocks?: boolean
  logger?: boolean
  /** Destino del log (pruebas que verifican que no salen datos personales). Implica logger. */
  logStream?: Writable
  /** BD ya abierta (pruebas). Si falta, se abre config.dbPath. */
  db?: Db
  /** Ruta del archivo de la BD (para respaldos). Con `db` inyectada sin ruta no hay respaldos. */
  dbPath?: string
  /** Reloj inyectable para simular la hora en pruebas. */
  ahora?: Reloj
  /** Intervalo del chequeo de aperturas y cierres programados (ms). 0 lo apaga. Por defecto 15 s. */
  intervaloCierresMs?: number
  baseUrl?: string
  /** Carpeta del build de la web (por defecto dist/web). Las pruebas de estáticos usan una propia. */
  webDir?: string
  /** Tiempos del modo demo (`POST /api/admin/demo`); las pruebas los acortan. Por defecto, cerca de un minuto. */
  demo?: Partial<TiemposDemo>
}

/** Archivos con hash en el nombre (Vite los deja en /assets): no cambian nunca, se cachean un año. */
export const CACHE_ASSETS = 'public, max-age=31536000, immutable'

export async function construirApp(op: OpcionesApp = {}): Promise<FastifyInstance> {
  // Sin log por petición: 40 celulares con polling son ~16 peticiones/s de ruido y escribir a stdout es síncrono
  // (en Windows, con el lector lento, frenaba el event loop segundos). Se registran solo las lentas y los 5xx.
  // trustProxy: solo los TRUST_PROXY_HOPS saltos de proxy propios (Traefik de Coolify = 1); un X-Forwarded-For inventado
  // por el cliente no cambia req.ip. Esa IP se guarda en cada inscripción y voto, y nunca se loguea.
  const app = Fastify({
    logger: op.logger || op.logStream ? opcionesLogger(op.logStream) : false,
    trustProxy: (_ip: string, salto: number) => salto < config.trustProxyHops,
    logController: new LogController({ disableRequestLogging: true }),
    bodyLimit: LIMITE_CUERPO,
  })
  cabecerasSeguridad(app)
  app.addHook('onResponse', async (req, reply) => {
    if (reply.elapsedTime > 500 || reply.statusCode >= 500) {
      req.log.warn({ metodo: req.method, ruta: req.url.split('?')[0], status: reply.statusCode, ms: Math.round(reply.elapsedTime) }, 'petición lenta o con error')
    }
  })
  await app.register(cookie)
  // gzip y brotli para la API y los estáticos (el bundle de la SPA pesa ~400 KB sin comprimir; en el wifi de un salón
  // con 40 celulares se nota). Brotli en calidad 5: comprime casi como la 11 a una fracción del CPU, y se hace en cada
  // respuesta. Solo desde 1 KB: un 304 o un error corto no ganan nada.
  await app.register(compress, {
    global: true,
    encodings: ['br', 'gzip'],
    threshold: 1024,
    brotliOptions: { params: { [zlib.BROTLI_PARAM_QUALITY]: 5 } },
  })

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ErrorApi) return reply.code(err.status).send(cuerpoError(err.codigo, err.message))
    if ((err as { validation?: unknown }).validation) return reply.code(400).send(cuerpoError('PETICION_INVALIDA', (err as Error).message))
    // JSON mal formado, cuerpo enorme, content-type raro: 4xx con forma de contrato, no 500.
    const f = errorDeFastify(err as FastifyError)
    if (f) return reply.code(f.status).send(cuerpoError(f.codigo, f.mensaje))
    app.log.error({ err }, 'error no controlado')
    return reply.code(500).send(cuerpoError('ERROR_INTERNO', 'Algo falló en el servidor. Intenta de nuevo.'))
  })

  // version: commit desplegado (Coolify pasa SOURCE_COMMIT a la imagen); el monitor /admin/salud lo muestra.
  // Con la API real consulta la base: si SQLite no responde (volumen perdido, archivo bloqueado o dañado), 503 y el
  // healthcheck de Docker y Coolify marca el contenedor como enfermo en vez de darlo por sano.
  const version = process.env.SOURCE_COMMIT || process.env.APP_VERSION || undefined
  let consultarBd: (() => void) | null = null
  app.get('/api/health', async (_req, reply) => {
    if (consultarBd) {
      try {
        consultarBd()
      } catch (e) {
        app.log.error({ err: e }, 'la BD no responde al healthcheck')
        return reply.code(503).send({ ok: false, modo: 'api', version, ...cuerpoError('BD_NO_DISPONIBLE', 'La base de datos no responde.') })
      }
    }
    return { ok: true, modo: op.mocks ? 'mocks' : 'api', version }
  })
  app.get('/robots.txt', async (_req, reply) => reply.type('text/plain; charset=utf-8').send(ROBOTS_TXT))

  if (op.mocks) {
    await app.register(rutasMocks)
  } else {
    const dbPath = op.db ? (op.dbPath ?? ':memory:') : (op.dbPath ?? config.dbPath)
    const db = op.db ?? abrirDb(dbPath)
    consultarBd = () => db.prepare('SELECT COUNT(*) AS n FROM salas').get()
    const ahora = op.ahora ?? Date.now
    const sa = asegurarSuperadmin(db, config.superadminUsuario, config.superadminClave, ahora())
    if (sa === 'creado') app.log.info(`Superadmin "${config.superadminUsuario}" creado desde .env`)
    if (sa === 'sin_config') app.log.warn('SUPERADMIN_USUARIO / SUPERADMIN_CLAVE no están definidos: no se creó superadmin.')
    if (!process.env.POLITICA_PRIVACIDAD_URL) app.log.warn(`POLITICA_PRIVACIDAD_URL no está definida: se usa ${config.politicaUrl}`)
    const baseUrl = op.baseUrl ?? config.baseUrl

    // Respaldo de la BD al empezar cada sala, antes de reiniciar una ronda y cada vez que una sala se cierra
    // (a mano o programado). Un fallo no rompe la petición.
    const respaldar = (salaId: string, momento: string) => {
      try {
        const r = respaldarBd(db, dbPath, salaId, momento, ahora(), cargarSala(db, salaId).zona_horaria)
        if (r) app.log.info(`Respaldo de la BD (${momento}) de ${salaId}: ${r}`)
      } catch (e) {
        app.log.error({ err: e }, 'No se pudo respaldar la BD')
      }
    }
    // Antes de eliminar una sala el respaldo es obligatorio: si falla, la sala no se borra (500 RESPALDO_FALLIDO).
    const respaldarAntesDeEliminar = (salaId: string) => {
      try {
        const r = respaldarBd(db, dbPath, salaId, 'antes_eliminar', ahora(), cargarSala(db, salaId).zona_horaria)
        if (r) app.log.info(`Respaldo de la BD (antes_eliminar) de ${salaId}: ${r}`)
      } catch (e) {
        app.log.error({ err: e }, 'No se pudo respaldar la BD antes de eliminar la sala')
        throw new ErrorApi(500, 'RESPALDO_FALLIDO', 'No pudimos guardar el respaldo de la sala, así que no se borró nada. Intenta de nuevo; si sigue, revisa Salud.')
      }
    }
    const alCerrarSala = (salaId: string) => respaldar(salaId, 'cierre')
    // Aperturas y cierres programados. Una sala que arranca sola se respalda como al abrirla a mano (sin datos aún).
    const revisarCierres = () => {
      const r = aplicarCierresProgramados(db, ahora())
      for (const id of r.salasIniciadas) respaldar(id, 'inicio')
      for (const id of r.salasCerradas) alCerrarSala(id)
    }

    await app.register(rutasApi, { db, ahora, baseUrl, revisarCierres, alCerrarSala, respaldar, respaldarAntesDeEliminar, demo: op.demo })
    const intervalo = op.intervaloCierresMs ?? 15_000
    if (intervalo > 0) {
      const t = setInterval(() => {
        try {
          revisarCierres()
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
  const web = op.webDir ?? resolve(RAIZ, 'dist', 'web')
  const hayWeb = existsSync(web)
  // wildcard: true busca cada archivo al pedirlo, así un build nuevo se sirve sin reiniciar el servidor.
  // Caché: /assets/* lleva hash en el nombre (un año, immutable); index.html y lo demás se revalidan siempre
  // (no-cache), así un despliegue nuevo llega en la siguiente carga.
  if (hayWeb) {
    await app.register(fastifyStatic, {
      root: web,
      wildcard: true,
      cacheControl: false,
      setHeaders: (reply, ruta) => {
        reply.header('Cache-Control', /[\\/]assets[\\/]/.test(ruta) ? CACHE_ASSETS : 'no-cache')
      },
    })
  }
  app.setNotFoundHandler((req, reply) => {
    // Un asset que no existe (build viejo en caché del celular) es 404, no la SPA.
    if (!hayWeb || req.url.startsWith('/api/') || req.url.startsWith('/assets/')) return reply.code(404).send(cuerpoError('NO_ENCONTRADO', 'Ruta no encontrada.'))
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
  })

  return app
}
