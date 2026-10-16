// Entorno del recorrido e2e del participante: API real (BD en memoria) + Vite + Chromium a 360 px.
// Corre dentro de Vitest (tools/test.sh). Sin Chromium instalado, las pruebas se omiten con aviso.
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import type { Browser, BrowserContext } from 'playwright-core'
import type { ViteDevServer } from 'vite'
import { construirApp } from '../../../server/app'
import { abrirDb } from '../../../server/db/index'
import { asegurarSuperadmin } from '../../../server/dominio/admins'

const RAIZ = resolve(__dirname, '../../..')
const USUARIO = 'e2e_t2'
const CLAVE = 'clave-e2e-participante'

/** Chromium headless que trae Playwright (misma revisión que playwright-core) o el de PW_EXE. */
export function hayChromium(): boolean {
  if (process.env.PW_EXE) return existsSync(process.env.PW_EXE)
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? (process.platform === 'win32' ? join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData/Local'), 'ms-playwright') : process.platform === 'darwin' ? join(homedir(), 'Library/Caches/ms-playwright') : join(homedir(), '.cache/ms-playwright'))
  try {
    return readdirSync(base).some((d) => d.startsWith('chromium'))
  } catch {
    return false
  }
}

export interface Entorno {
  api: FastifyInstance
  vite: ViteDevServer
  browser: Browser
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

  // Misma raíz y proxy que vite.config.ts, pero sin el plugin de React (Babel): esbuild compila el TSX
  // y la prueba gasta mucha menos CPU mientras corre en paralelo con el resto de la suite.
  const { createServer } = await import('vite')
  const vite = await createServer({
    configFile: false,
    root: join(RAIZ, 'web'),
    logLevel: 'silent',
    esbuild: { jsx: 'automatic' },
    server: { port: 5600 + Math.floor(Math.random() * 300), strictPort: false, host: '127.0.0.1', hmr: false, proxy: { '/api': { target: apiUrl, changeOrigin: true } } },
  })
  await vite.listen()
  const web = (vite.resolvedUrls?.local[0] ?? '').replace(/\/$/, '')

  const { chromium } = await import('playwright-core')
  const browser = await chromium.launch({ executablePath: process.env.PW_EXE || undefined, args: ['--disable-gpu'] })

  const r = await fetch(`${apiUrl}/api/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: USUARIO, clave: CLAVE }) })
  if (!r.ok) throw new Error(`login admin falló: ${r.status}`)
  const cookie = (r.headers.get('set-cookie') ?? '').split(';')[0]

  return {
    api,
    vite,
    browser,
    web,
    apiUrl,
    cookie,
    cerrar: async () => {
      await browser.close().catch(() => {})
      await vite.close().catch(() => {})
      await api.close().catch(() => {})
    },
  }
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

/** Inscribe por API (otro celular de la mesa). Devuelve el token. */
export async function inscribirApi(e: Entorno, codigoMesa: string, nombre: string, correo: string): Promise<string> {
  const mesa = await json(e, 'GET', `/api/mesas/${codigoMesa}`)
  const version = (mesa.datos as { consentimiento: { version: string } }).consentimiento.version
  const r = await json(e, 'POST', '/api/inscripcion', { codigoMesa, nombre, correo, consentimiento: { aceptado: true, version } })
  if (r.status !== 201 && r.status !== 409) throw new Error(`inscripción: ${r.status} ${JSON.stringify(r.datos)}`)
  const d = r.datos as { token?: string; error?: { token?: string } }
  return (d.token ?? d.error?.token)!
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
