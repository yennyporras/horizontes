// Deuda del servidor de la auditoría (20-oct): healthcheck con la base, respaldos por sala, borrar la rúbrica de las
// salas nuevas, compresión gzip/brotli, caché de /assets y utilidades de la línea de comandos.
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CACHE_ASSETS, construirApp } from '../../server/app'
import { argumento } from '../../server/cli'
import { abrirDb } from '../../server/db/index'
import { RESPALDOS_POR_SALA, respaldarBd } from '../../server/dominio/mantenimiento'
import { semilla } from '../../server/dominio/semilla'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

describe('GET /api/health consulta la base', () => {
  it('200 con la base al día; 503 BD_NO_DISPONIBLE si SQLite no responde', async () => {
    const db = abrirDb(':memory:')
    const app = await construirApp({ db, intervaloCierresMs: 0 })
    try {
      expect((await app.inject('/api/health')).json()).toEqual({ ok: true, modo: 'api' })
      db.close()
      const r = await app.inject('/api/health')
      expect(r.statusCode).toBe(503)
      expect(r.json()).toMatchObject({ ok: false, modo: 'api', error: { codigo: 'BD_NO_DISPONIBLE' } })
    } finally {
      await app.close()
    }
  })
})

describe('respaldos rotados por sala', () => {
  it(`cada sala conserva sus ${RESPALDOS_POR_SALA} respaldos más recientes sin borrar los de otras`, () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-resp-sala-'))
    const dbPath = join(dir, 'h.sqlite')
    const db = abrirDb(dbPath)
    try {
      for (let i = 0; i < 3; i++) respaldarBd(db, dbPath, 's_bbbbbb', 'inicio', T0 + i, 'America/Lima')
      for (let i = 0; i < RESPALDOS_POR_SALA + 4; i++) respaldarBd(db, dbPath, 's_aaaaaa', 'antes_reinicio', T0 + i, 'America/Bogota')
      const archivos = readdirSync(join(dir, 'respaldos'))
      expect(archivos.filter((f) => f.includes('_s_aaaaaa_'))).toHaveLength(RESPALDOS_POR_SALA)
      expect(archivos.filter((f) => f.includes('_s_bbbbbb_'))).toHaveLength(3)
      expect(archivos.every((f) => /^horizontes_2026-10-20T\d{2}-\d{2}-\d{2}-0[56]-00_s_[ab]{6}_(inicio|antes_reinicio)(_\d+)?\.sqlite$/.test(f))).toBe(true)
    } finally {
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('DELETE /api/admin/rubricas-plantilla/{criterio_id}', () => {
  const pedir = (method: string, url: string, payload?: object, cookie: string | null = e.cookie) =>
    e.app.inject({ method: method as 'GET', url, headers: cookie ? { cookie } : {}, ...(payload ? { payload } : {}) })
  const rubricaDe = async (salaId: string, criterio: string) =>
    (await pedir('GET', `/api/admin/salas/${salaId}/rubricas`)).json().criterios.find((c: { id: string }) => c.id === criterio).rubrica

  it('las salas nuevas vuelven a la rúbrica de la semilla; las existentes no cambian; es idempotente', async () => {
    const semillaReg = semilla().motor.criterios.find((c) => c.id === 'regulacion')!.rubrica
    const s1 = await crearSala(e, 1)
    const propia = semillaReg.map((n) => ({ valor: n.valor, texto: `Nivel ${n.valor} propio` }))
    expect((await pedir('PUT', `/api/admin/salas/${s1.id}/rubricas/regulacion`, { rubrica: propia, usar_en_salas_nuevas: true })).statusCode).toBe(200)
    expect(await rubricaDe((await crearSala(e, 1)).id, 'regulacion')).toEqual(propia)

    const r = await pedir('DELETE', '/api/admin/rubricas-plantilla/regulacion')
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({ plantilla: 'foodsume_2026', criterio_id: 'regulacion', borrada: true, rubrica: semillaReg })
    expect(await rubricaDe((await crearSala(e, 1)).id, 'regulacion')).toEqual(semillaReg)
    expect(await rubricaDe(s1.id, 'regulacion')).toEqual(propia)
    expect((await pedir('DELETE', '/api/admin/rubricas-plantilla/regulacion')).json().borrada).toBe(false)
  })

  it('422 con un criterio o una plantilla que no existen; 401 sin sesión', async () => {
    expect((await pedir('DELETE', '/api/admin/rubricas-plantilla/inventado')).json().error.codigo).toBe('CRITERIO_NO_EXISTE')
    expect((await pedir('DELETE', '/api/admin/rubricas-plantilla/regulacion?plantilla=otra')).json().error.codigo).toBe('PLANTILLA_NO_EXISTE')
    expect((await pedir('DELETE', '/api/admin/rubricas-plantilla/regulacion', undefined, null)).statusCode).toBe(401)
  })
})

describe('compresión de la API', () => {
  it('el tablero sale en brotli o gzip según Accept-Encoding y se descomprime igual; lo corto va sin comprimir', async () => {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_ronda_1')
    const p = (await inscribir(e, s.mesas[0].codigo, 'a@x.co')).json()
    await votar(e, p.token, 'insumex', 1)
    const url = `/api/tablero/${s.id}?t=${s.token_tablero}`
    const plano = await e.app.inject(url)
    expect(plano.headers['content-encoding']).toBeUndefined()
    const br = await e.app.inject({ url, headers: { 'accept-encoding': 'br' } })
    expect(br.headers['content-encoding']).toBe('br')
    expect(JSON.parse(brotliDecompressSync(br.rawPayload).toString('utf8'))).toEqual(plano.json())
    expect(br.rawPayload.length).toBeLessThan(plano.rawPayload.length / 2)
    const gz = await e.app.inject({ url, headers: { 'accept-encoding': 'gzip' } })
    expect(gz.headers['content-encoding']).toBe('gzip')
    expect(JSON.parse(gunzipSync(gz.rawPayload).toString('utf8'))).toEqual(plano.json())
    // El 304 del polling sigue funcionando con la ETag de la respuesta comprimida.
    expect((await e.app.inject({ url, headers: { 'accept-encoding': 'br', 'if-none-match': br.headers.etag as string } })).statusCode).toBe(304)
    expect((await e.app.inject({ url: '/api/health', headers: { 'accept-encoding': 'br, gzip' } })).headers['content-encoding']).toBeUndefined()
  })
})

describe('estáticos de la SPA', () => {
  let dir: string
  let app: Awaited<ReturnType<typeof construirApp>>
  const JS = `console.log(${JSON.stringify('horizontes '.repeat(4000))})\n`
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'hz-web-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Horizontes</title><script type="module" src="/assets/index-AbC123.js"></script>')
    writeFileSync(join(dir, 'assets', 'index-AbC123.js'), JS)
    app = await construirApp({ db: abrirDb(':memory:'), intervaloCierresMs: 0, webDir: dir })
  })
  afterEach(async () => {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  })

  it('/assets/* con hash: caché de un año immutable y comprimido con brotli o gzip', async () => {
    const r = await app.inject({ url: '/assets/index-AbC123.js', headers: { 'accept-encoding': 'gzip, deflate, br' } })
    expect(r.statusCode).toBe(200)
    expect(r.headers['cache-control']).toBe(CACHE_ASSETS)
    expect(CACHE_ASSETS).toBe('public, max-age=31536000, immutable')
    expect(r.headers['content-encoding']).toBe('br')
    expect(brotliDecompressSync(r.rawPayload).toString('utf8')).toBe(JS)
    const gz = await app.inject({ url: '/assets/index-AbC123.js', headers: { 'accept-encoding': 'gzip' } })
    expect(gz.headers['content-encoding']).toBe('gzip')
    expect(gunzipSync(gz.rawPayload).toString('utf8')).toBe(JS)
  })

  it('index.html (en / y en el fallback de la SPA) sigue sin caché', async () => {
    for (const url of ['/', '/index.html', '/admin', '/m/HZ7K2QX4-1', '/tablero/s_x']) {
      const r = await app.inject(url)
      expect(r.statusCode, url).toBe(200)
      expect(r.headers['cache-control'], url).toBe('no-cache')
      expect(r.body, url).toContain('<title>Horizontes</title>')
    }
    expect((await app.inject('/assets/no-existe.js')).statusCode).toBe(404)
  })
})

describe('server/cli.ts', () => {
  it('argumento() lee --nombre valor', () => {
    const argv = ['node', 'seed.ts', '--sala', 'Taller Jorge', '--mesas', '4']
    expect(argumento('sala', argv)).toBe('Taller Jorge')
    expect(argumento('mesas', argv)).toBe('4')
    expect(argumento('confirmar', argv)).toBeUndefined()
  })
})
