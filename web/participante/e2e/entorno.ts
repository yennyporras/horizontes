// Entorno del recorrido e2e del participante: API real (BD en memoria) + Vite + Chromium a 360 px.
// Corre dentro de Vitest (tools/test.sh). Sin Chromium instalado, las pruebas se omiten con aviso (en CI fallan).
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { createServer as servidorHttp, request, type Server } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import type { Browser, BrowserContext } from 'playwright-core'
import { construirApp } from '../../../server/app'
import { abrirDb } from '../../../server/db/index'
import { asegurarSuperadmin } from '../../../server/dominio/admins'

const RAIZ = resolve(__dirname, '../../..')
const USUARIO = 'e2e_t2'
const CLAVE = 'clave-e2e-participante'

/**
 * Navegador de Playwright instalado (misma revisión que playwright-core). Para Chromium también vale PW_EXE.
 * Con HZ_E2E=0 se omite, como el e2e del tablero: las pruebas en navegador cargan la máquina y se corren aparte.
 */
export function hayNavegador(motor: Motor): boolean {
  if (process.env.HZ_E2E === '0') return false
  if (motor === 'chromium' && process.env.PW_EXE) return existsSync(process.env.PW_EXE)
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ms-playwright') : process.platform === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : join(homedir(), '.cache/ms-playwright'))
  try {
    return readdirSync(base).some((d) => d.startsWith(`${motor}-`) || (motor === 'chromium' && d.startsWith('chromium')))
  } catch {
    return false
  }
}
export const hayChromium = () => hayNavegador('chromium')

export type Motor = 'chromium' | 'webkit'

/** Celulares emulados para el recorrido por perfiles: motor real + user agent, pantalla y densidad del equipo. */
export interface PerfilMovil {
  nombre: string
  motor: Motor
  contexto: { userAgent: string; viewport: { width: number; height: number }; deviceScaleFactor: number }
}
export const PERFILES_MOVILES: PerfilMovil[] = [
  {
    nombre: 'Chrome Android (Pixel 7)',
    motor: 'chromium',
    contexto: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
      viewport: { width: 412, height: 839 },
      deviceScaleFactor: 2.625,
    },
  },
  {
    nombre: 'Safari iOS (iPhone 13, WebKit)',
    motor: 'webkit',
    contexto: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 664 },
      deviceScaleFactor: 3,
    },
  },
  {
    nombre: 'Samsung Internet (Galaxy S24)',
    motor: 'chromium',
    contexto: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/27.0 Chrome/125.0.0.0 Mobile Safari/537.36',
      viewport: { width: 360, height: 780 },
      deviceScaleFactor: 3,
    },
  },
]

/** Contexto de un perfil móvil. WebKit se lanza aparte la primera vez y se cierra con el entorno. */
export async function celularPerfil(e: Entorno, perfil: PerfilMovil): Promise<BrowserContext> {
  let browser = e.browser
  if (perfil.motor === 'webkit') {
    if (!e.webkit) {
      const { webkit } = await import('playwright-core')
      e.webkit = await webkit.launch()
    }
    browser = e.webkit
  }
  return browser.newContext({ ...perfil.contexto, isMobile: true, hasTouch: true, locale: 'es-CO' })
}

export interface Entorno {
  api: FastifyInstance
  web_server: Server
  browser: Browser
  /** WebKit (Safari iOS), solo si un perfil lo pide. */
  webkit?: Browser
  web: string
  apiUrl: string
  cookie: string
  cerrar: () => Promise<void>
}

export async function iniciar(): Promise<Entorno> {
  const db = abrirDb(':memory:')
  asegurarSuperadmin(db, USUARIO, CLAVE, Date.now())
  const api = await construirApp({ db, intervaloCierresMs: 0, baseUrl: 'http://127.0.0.1' })
  await api.listen({ port: 0, host: '127.0.0.1' })
  const apiUrl = `http://127.0.0.1:${(api.server.address() as AddressInfo).port}`

  // Build de producción en una carpeta temporal (≈2 s, una vez) servido por un estático mínimo que
  // reenvía /api. Más fiel que el servidor de desarrollo y gasta mucha menos CPU mientras el resto de
  // la suite corre en paralelo. Sin el plugin de React: esbuild compila el TSX.
  const salida = mkdtempSync(join(tmpdir(), 'hz-e2e-web-'))
  await construirProduccion(salida)
  const web_server = estatico(salida, apiUrl)
  await new Promise<void>((r) => web_server.listen(0, '127.0.0.1', r))
  const web = `http://127.0.0.1:${(web_server.address() as AddressInfo).port}`

  const { chromium } = await import('playwright-core')
  let browser: Browser
  try {
    browser = await chromium.launch({ executablePath: process.env.PW_EXE || undefined, args: ['--disable-gpu'] })
  } catch (err) {
    // Sin esto, la API y el estático quedan escuchando y Vitest no termina.
    web_server.closeAllConnections()
    web_server.close()
    await api.close()
    rmSync(salida, { recursive: true, force: true })
    throw err
  }

  const r = await fetch(`${apiUrl}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: USUARIO, clave: CLAVE }) })
  if (!r.ok) throw new Error(`login admin falló: ${r.status}`)
  const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0]

  const entorno: Entorno = {
    api,
    web_server,
    browser,
    web,
    apiUrl,
    cookie,
    cerrar: async () => {
      // Las conexiones keep-alive (navegador → Vite → API) no deben colgar el cierre.
      const conTope = (p: Promise<unknown>) => Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, 5000))])
      await conTope(browser.close())
      if (entorno.webkit) await conTope(entorno.webkit.close())
      web_server.closeAllConnections()
      await conTope(new Promise((r) => web_server.close(r)))
      api.server.closeAllConnections()
      await conTope(api.close())
      rmSync(salida, { recursive: true, force: true })
    },
  }
  return entorno
}

/**
 * Vitest corre con NODE_ENV=test y Vite lo respeta: sin forzarlo, el «build de producción» salía con React de
 * desarrollo (StrictMode con efectos y consultas dobles, jsxDEV, import.meta.env.DEV verdadero y con él el simulador
 * del panel y /m/_ui): más pesado y distinto de lo que recibe el celular (docs/DECISIONES.md, 20-oct).
 */
async function construirProduccion(salida: string) {
  const { build } = await import('vite')
  const antes = process.env.NODE_ENV
  process.env.NODE_ENV = 'production'
  try {
    await build({ configFile: false, root: join(RAIZ, 'web'), logLevel: 'silent', esbuild: { jsx: 'automatic' }, build: { outDir: salida, emptyOutDir: true } })
  } finally {
    if (antes === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = antes
  }
  // Guardia: si React de desarrollo se cuela otra vez en el build, el e2e lo dice en vez de volverse intermitente.
  const js = readdirSync(join(salida, 'assets')).filter((f) => f.endsWith('.js'))
  const conDesarrollo = js.filter((f) => /react-devtools|jsxDEV/.test(readFileSync(join(salida, 'assets', f), 'utf8')))
  if (conDesarrollo.length) throw new Error(`El build del e2e trae React de desarrollo (${conDesarrollo.join(', ')}): debe ser el de producción.`)
}

const TIPOS: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }

/** Sirve el build (con fallback SPA a index.html) y reenvía /api al servidor real. */
function estatico(raiz: string, apiUrl: string): Server {
  const destino = new URL(apiUrl)
  return servidorHttp((req, res) => {
    const url = req.url ?? '/'
    if (url.startsWith('/api')) {
      const p = request({ host: destino.hostname, port: destino.port, path: url, method: req.method, headers: req.headers }, (r) => {
        res.writeHead(r.statusCode ?? 502, r.headers)
        r.pipe(res)
      })
      p.on('error', () => res.writeHead(502).end())
      req.pipe(p)
      return
    }
    const ruta = normalize(join(raiz, decodeURIComponent(url.split('?')[0])))
    const archivo = ruta.startsWith(raiz) && extname(ruta) && existsSync(ruta) ? ruta : join(raiz, 'index.html')
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' })
    res.end(readFileSync(archivo))
  })
}

/** Celular de 360 px (táctil). */
export function celular(e: Entorno): Promise<BrowserContext> {
  return e.browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'es-CO' })
}

async function json(e: Entorno, metodo: string, ruta: string, cuerpo?: unknown, headers: Record<string, string> = {}) {
  const r = await fetch(`${e.apiUrl}${ruta}`, {
    method: metodo,
    headers: { ...(cuerpo === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  })
  const datos = await r.json().catch(() => null)
  return { status: r.status, datos }
}

export async function crearSala(e: Entorno, nombre: string, mesas = 2) {
  const r = await json(e, 'POST', '/api/admin/salas', { nombre, plantilla: 'foodsume_2026', mesas }, { cookie: e.cookie })
  if (r.status !== 201) throw new Error(`crear sala: ${r.status} ${JSON.stringify(r.datos)}`)
  return r.datos as { id: string; codigo: string; mesas: { id: string; codigo: string }[] }
}

export async function accion(e: Entorno, salaId: string, accion: string) {
  const r = await json(e, 'POST', `/api/admin/salas/${salaId}/acciones`, { accion }, { cookie: e.cookie })
  if (r.status !== 200) throw new Error(`${accion}: ${r.status} ${JSON.stringify(r.datos)}`)
}

export async function configurar(e: Entorno, salaId: string, cambios: Record<string, unknown>) {
  const r = await json(e, 'PATCH', `/api/admin/salas/${salaId}/config`, cambios, { cookie: e.cookie })
  if (r.status !== 200) throw new Error(`config: ${r.status} ${JSON.stringify(r.datos)}`)
}

/** Modo guiado (C19-5, S4): el facilitador fija la pregunta que ve toda la sala (null la quita). */
export async function fijarPregunta(e: Entorno, salaId: string, pregunta: { proyecto_id: string; criterio_id: string } | null) {
  const r = await json(e, 'PUT', `/api/admin/salas/${salaId}/pregunta-guiada`, pregunta, { cookie: e.cookie })
  if (r.status !== 200) throw new Error(`pregunta guiada: ${r.status} ${JSON.stringify(r.datos)}`)
}

/** Inscribe por API (otro celular de la mesa). Devuelve el token. */
export async function inscribirApi(e: Entorno, codigoMesa: string, nombre: string, correo: string): Promise<string> {
  const mesa = await json(e, 'GET', `/api/mesas/${codigoMesa}`)
  const version = (mesa.datos as { consentimiento: { version: string } }).consentimiento.version
  const r = await json(e, 'POST', '/api/inscripcion', { codigoMesa, nombre, correo, consentimiento: { aceptado: true, version } })
  if (r.status !== 201 && r.status !== 409) throw new Error(`inscripción: ${r.status} ${JSON.stringify(r.datos)}`)
  const d = r.datos as { token?: string; error?: { token?: string } }
  return (d.token ?? d.error?.token)!
}

/**
 * «Dar acceso de nuevo» del panel (D1): enlace personal de un solo uso. Devuelve la ruta con su `?acceso=`,
 * para abrirla en el estático del e2e (la URL del servidor trae su BASE_URL).
 */
export async function darAcceso(e: Entorno, participanteId: string): Promise<string> {
  const r = await json(e, 'POST', `/api/admin/participantes/${participanteId}/acceso`, {}, { cookie: e.cookie })
  if (r.status !== 200) throw new Error(`acceso: ${r.status} ${JSON.stringify(r.datos)}`)
  const url = new URL((r.datos as { url: string }).url)
  return `${url.pathname}${url.search}`
}

export const TODO_5 = {
  alistamiento_tecnico: 5,
  conocimiento_cliente: 5,
  regulacion: 5,
  capacidades_organizacionales: 5,
  alineacion_core: 5,
  inversion_requerida: 5,
}

export async function votarApi(e: Entorno, token: string, proyecto_id: string, ronda: number, respuestas: Record<string, number> = TODO_5) {
  const r = await json(e, 'PUT', '/api/votos', { proyecto_id, ronda, respuestas }, { 'x-participante-token': token })
  if (r.status !== 200) throw new Error(`voto: ${r.status} ${JSON.stringify(r.datos)}`)
}
