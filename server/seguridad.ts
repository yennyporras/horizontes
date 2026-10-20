// Endurecimiento HTTP: cabeceras de seguridad, errores 4xx de Fastify con forma de contrato
// y logs sin datos personales (Ley 1581: ni nombres, ni correos, ni tokens, ni IP en los logs de Coolify).
import type { Writable } from 'node:stream'
import type { FastifyError, FastifyInstance, FastifyServerOptions } from 'fastify'

/** Tamaño máximo del cuerpo JSON. El más grande legítimo (crear admin o inscripción) no pasa de 1 KB. */
export const LIMITE_CUERPO = 32 * 1024

// La SPA es un solo bundle de Vite servido por este mismo servidor: todo sale de 'self'.
// style-src 'unsafe-inline': React pone estilos en línea y la matriz es un SVG con atributos style.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

export const CABECERAS: Record<string, string> = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  // El enlace del tablero lleva el token en ?t=: que nunca salga en el Referer hacia otro sitio.
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
}

/**
 * Imágenes públicas de la marca que leen los robots de vista previa (LinkedIn, X, WhatsApp) al compartir la landing:
 * la imagen og:image (1200x630) y el ícono. Se permiten en robots.txt, sin X-Robots-Tag y se pueden cargar desde otro
 * origen (Cross-Origin-Resource-Policy: cross-origin). Lo demás sigue cerrado.
 */
export const ARCHIVOS_PUBLICOS = ['/og-horizontes.png', '/favicon.svg'] as const

export const ROBOTS_TXT = `User-agent: *\nAllow: /$\n${ARCHIVOS_PUBLICOS.map((a) => `Allow: ${a}\n`).join('')}Disallow: /\n`

const esArchivoPublico = (metodo: string, url: string) =>
  (metodo === 'GET' || metodo === 'HEAD') && (ARCHIVOS_PUBLICOS as readonly string[]).includes(url.split('?')[0])

export function esLanding(metodo: string, url: string): boolean {
  return (metodo === 'GET' || metodo === 'HEAD') && url.split('?')[0] === '/'
}

export function cabecerasSeguridad(app: FastifyInstance) {
  app.addHook('onSend', async (req, reply, payload) => {
    const publico = esArchivoPublico(req.method, req.url)
    if (publico) reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
    for (const [k, v] of Object.entries(CABECERAS)) if (!reply.hasHeader(k)) reply.header(k, v)
    // Solo la landing (GET o HEAD de `/`) se indexa; mesas, tablero, panel y API no (igual que D-123 del IRMI). Las
    // imágenes públicas de la marca tampoco llevan noindex: la tarjeta de vista previa debe poder leerlas.
    if (!esLanding(req.method, req.url) && !publico) reply.header('X-Robots-Tag', 'noindex, nofollow')
    // HSTS solo detrás de HTTPS (Traefik manda X-Forwarded-Proto); en desarrollo por http no aplica.
    if (req.protocol === 'https') reply.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    // Respuestas de la API: nada en cachés compartidas. Las de polling ya traen no-cache (revalidan con ETag).
    if (req.url.startsWith('/api/') && !reply.hasHeader('Cache-Control')) reply.header('Cache-Control', 'no-store')
    return payload
  })
}

/** Códigos de contrato para los 4xx que genera Fastify antes de llegar a las rutas. */
export function errorDeFastify(err: FastifyError): { status: number; codigo: string; mensaje: string } | null {
  const status = err.statusCode ?? 0
  if (status < 400 || status >= 500) return null
  if (status === 413) return { status, codigo: 'CUERPO_DEMASIADO_GRANDE', mensaje: 'La petición es demasiado grande.' }
  if (status === 415) return { status, codigo: 'TIPO_NO_SOPORTADO', mensaje: 'Envía los datos como JSON.' }
  // Los de @fastify/static (rango inválido, archivo prohibido o inexistente) conservan su código.
  if (status === 403 || status === 404 || status === 405 || status === 416) return { status, codigo: 'PETICION_INVALIDA', mensaje: 'No se pudo atender esa petición.' }
  return { status: 400, codigo: 'PETICION_INVALIDA', mensaje: 'La petición no es válida. Revisa los datos enviados.' }
}

const RE_CORREO = /[^\s@"'<>;,:()]+@[^\s@"'<>;,:()]+\.[a-z]{2,}/gi
const RE_TOKEN = /\b[A-Za-z0-9_-]{32,}\b/g

/** Quita correos y tokens largos de un texto antes de loguearlo. */
export function limpiarTexto(s: string): string {
  return s.replace(RE_CORREO, '[correo]').replace(RE_TOKEN, '[token]')
}

/**
 * Opciones del logger de Fastify. Redacta cabeceras y campos sensibles por si algún día se loguea una petición
 * o un cuerpo, y limpia correos y tokens del mensaje de los errores.
 */
export function opcionesLogger(stream?: Writable): FastifyServerOptions['logger'] {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    ...(stream ? { stream } : {}),
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers["x-participante-token"]',
        'req.headers.authorization',
        'req.headers["x-forwarded-for"]',
        'req.query.t',
        '*.ip',
        '*.correo',
        '*.nombre',
        '*.clave',
        '*.token',
        '*.actual',
        '*.nueva',
        '*.clave_temporal',
        '*.acceso',
      ],
      censor: '[oculto]',
    },
    serializers: {
      err: (e: Error) => ({ type: e.name, message: limpiarTexto(e.message ?? ''), stack: limpiarTexto(e.stack ?? '') }),
      // req.url puede traer ?t=<token del tablero> o ?acceso=<enlace de un solo uso>.
      req: (r: { method?: string; url?: string }) => ({ metodo: r.method, ruta: (r.url ?? '').split('?')[0] }),
    },
  }
}
