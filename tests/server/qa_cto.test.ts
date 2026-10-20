// QA de Paola como CTO (20-oct): ETag del detalle de sala, mensajes con artículo y tildes, regla única del usuario admin,
// QR en carbón y el script para restablecer la cuenta superadministradora.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { abrirDb, uno } from '../../server/db/index'
import { type AdminFila, asegurarSuperadmin, restablecerSuperadmin, verificarClave } from '../../server/dominio/admins'
import { LARGO_MAXIMO_USUARIO, MENSAJE_USUARIO_ADMIN, usuarioAdminValido } from '../../shared/reglas/usuario'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const pedir = (method: 'GET' | 'POST', url: string, payload?: object, cookie = e.cookie, headers: Record<string, string> = {}) =>
  e.app.inject({ method, url, payload, headers: { cookie, ...headers } })

describe('detalle de sala con ETag', () => {
  it('con If-None-Match de la versión actual responde 304 sin cuerpo; tras un cambio, 200 con la versión nueva', async () => {
    const s = await crearSala(e, 1)
    const r = await pedir('GET', `/api/admin/salas/${s.id}`)
    expect(r.statusCode).toBe(200)
    const etag = r.headers.etag as string
    expect(etag).toBe(`"${r.json().version}"`)
    const r304 = await pedir('GET', `/api/admin/salas/${s.id}`, undefined, e.cookie, { 'if-none-match': etag })
    expect(r304.statusCode).toBe(304)
    expect(r304.body).toBe('')
    expect(r304.headers.etag).toBe(etag)
    await accion(e, s.id, 'abrir_inscripcion')
    const r2 = await pedir('GET', `/api/admin/salas/${s.id}`, undefined, e.cookie, { 'if-none-match': etag })
    expect(r2.statusCode).toBe(200)
    expect(r2.headers.etag).not.toBe(etag)
    // Sin sesión no hay atajo: 401 aunque la versión coincida.
    expect((await e.app.inject({ url: `/api/admin/salas/${s.id}`, headers: { 'if-none-match': r2.headers.etag as string } })).statusCode).toBe(401)
    expect((await pedir('GET', '/api/admin/salas/s_noexiste', undefined, e.cookie, { 'if-none-match': '"v-1"' })).statusCode).toBe(404)
  })
})

describe('mensajes', () => {
  it.each([
    ['abrir_inscripcion', 'r1_abierta', 'No se puede abrir la inscripción: la sala está con la ronda 1 abierta.'],
    ['cerrar_ronda_2', 'r1_abierta', 'No se puede cerrar la ronda 2: la sala está con la ronda 1 abierta.'],
    ['reabrir_sala', 'r1_abierta', 'No se puede reabrir la sala: la sala está con la ronda 1 abierta.'],
    ['reabrir_ronda', 'preparada', 'No se puede reabrir la ronda: la sala está preparada.'],
  ])('%s con la sala %s: «%s»', async (acc, estado, mensaje) => {
    const s = await crearSala(e, 1)
    if (estado === 'r1_abierta') await accion(e, s.id, 'abrir_ronda_1')
    const r = await accion(e, s.id, acc)
    expect(r.statusCode).toBe(409)
    expect(r.json().error).toEqual({ codigo: 'TRANSICION_INVALIDA', mensaje })
  })

  it('un proyecto que no es vivo: «Ese proyecto no se califica en esta sala.»', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    const p = (await inscribir(e, s.mesas[0].codigo, 'a@x.co')).json()
    const r = await votar(e, p.token, 'yummi', 1)
    expect(r.statusCode).toBe(422)
    expect(r.json().error).toEqual({ codigo: 'PROYECTO_INVALIDO', mensaje: 'Ese proyecto no se califica en esta sala.' })
  })

  it('clave temporal y gestión de administradores', async () => {
    expect((await pedir('POST', '/api/admin/admins', { usuario: 'nicolai', nombre: 'Nicolai', clave_temporal: 'temporal123' })).statusCode).toBe(201)
    const c = await loginCookie(e.app, 'nicolai', 'temporal123')
    expect((await pedir('GET', '/api/admin/salas', undefined, c)).json().error).toEqual({ codigo: 'CAMBIO_CLAVE_REQUERIDO', mensaje: 'Antes de continuar, cambia tu clave temporal.' })
    await pedir('POST', '/api/admin/cambiar-clave', { actual: 'temporal123', nueva: 'definitiva456' }, c)
    expect((await pedir('GET', '/api/admin/admins', undefined, c)).json().error).toEqual({
      codigo: 'SOLO_SUPERADMIN',
      mensaje: 'Solo la cuenta superadministradora puede gestionar administradores.',
    })
  })
})

describe('regla única del usuario admin (shared/reglas/usuario.ts)', () => {
  it.each([
    ['ana', true],
    ['nicolai.eslava', true],
    ['a_b-c.9', true],
    ['x'.repeat(LARGO_MAXIMO_USUARIO), true],
    ['ab', false],
    ['x'.repeat(LARGO_MAXIMO_USUARIO + 1), false],
    ['Ana', false],
    ['josé', false],
    ['ana maría', false],
    ['ana@estratek', false],
  ])('«%s» → %s', (usuario, ok) => {
    expect(usuarioAdminValido(usuario)).toBe(ok)
  })

  it('el servidor aplica la misma regla y el mismo mensaje (recorta y pasa a minúsculas antes)', async () => {
    const largo = await pedir('POST', '/api/admin/admins', { usuario: 'x'.repeat(31), nombre: 'Largo', clave_temporal: 'temporal123' })
    expect(largo.statusCode).toBe(422)
    expect(largo.json().error.mensaje).toBe(MENSAJE_USUARIO_ADMIN)
    expect(MENSAJE_USUARIO_ADMIN).toBe('El usuario debe tener entre 3 y 30 caracteres: letras minúsculas, números, punto, guion o guion bajo.')
    const ok = await pedir('POST', '/api/admin/admins', { usuario: '  Paula.Silva ', nombre: 'Paula', clave_temporal: 'temporal123' })
    expect(ok.statusCode).toBe(201)
    expect(ok.json().usuario).toBe('paula.silva')
  })
})

describe('QR de la mesa', () => {
  it('se dibuja en carbón #141414 sobre blanco (familia Estratek), sin el azul viejo', async () => {
    const s = await crearSala(e, 1)
    const r = await pedir('GET', `/api/admin/mesas/${s.mesas[0].id}/qr.svg`)
    expect(r.statusCode).toBe(200)
    expect(r.body.toUpperCase()).toContain('#141414')
    expect(r.body.toUpperCase()).not.toContain('#1C4587')
  })
})

describe('restablecer la cuenta superadministradora', () => {
  it('cambia la clave, la activa, no pide cambiarla y cierra sus sesiones; si no existe, la crea', async () => {
    const sesiones = () => uno<{ n: number }>(e.db, "SELECT COUNT(*) AS n FROM sesiones_admin s JOIN admins a ON a.id = s.admin_id WHERE a.usuario = 'paola'")!.n
    expect(sesiones()).toBeGreaterThan(0)
    e.db.prepare("UPDATE admins SET activo = 0, debe_cambiar_clave = 1 WHERE usuario = 'paola'").run()
    expect(restablecerSuperadmin(e.db, ' Paola ', 'clave-nueva-2026', e.reloj.ms)).toBe('restablecido')
    const a = uno<AdminFila>(e.db, "SELECT * FROM admins WHERE usuario = 'paola'")!
    expect({ activo: a.activo, debe: a.debe_cambiar_clave, rol: a.rol }).toEqual({ activo: 1, debe: 0, rol: 'superadmin' })
    expect(verificarClave('clave-nueva-2026', a.clave_hash)).toBe(true)
    expect(sesiones()).toBe(0)
    expect((await e.app.inject({ url: '/api/admin/yo', headers: { cookie: e.cookie } })).statusCode).toBe(401)
    await loginCookie(e.app, 'paola', 'clave-nueva-2026')
    expect(restablecerSuperadmin(e.db, 'sebastian', 'otra-clave-2026', e.reloj.ms)).toBe('creado')
    expect(uno(e.db, "SELECT rol, debe_cambiar_clave AS d FROM admins WHERE usuario = 'sebastian'")).toEqual({ rol: 'superadmin', d: 0 })
  })

  it('no promueve a un admin, ni acepta una clave corta', async () => {
    await pedir('POST', '/api/admin/admins', { usuario: 'nicolai', nombre: 'Nicolai', clave_temporal: 'temporal123' })
    expect(() => restablecerSuperadmin(e.db, 'nicolai', 'clave-nueva-2026', e.reloj.ms)).toThrow(/no la cuenta superadministradora/)
    expect(uno(e.db, "SELECT rol FROM admins WHERE usuario = 'nicolai'")).toEqual({ rol: 'admin' })
    expect(() => restablecerSuperadmin(e.db, 'paola', 'corta', e.reloj.ms)).toThrow(/al menos 8/)
  })

  it('npm run admin:restablecer: sin --confirmar no cambia nada; con --confirmar restablece y no imprime la clave', () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-restablecer-'))
    try {
      const dbPath = join(dir, 'hz.sqlite')
      const db = abrirDb(dbPath)
      asegurarSuperadmin(db, 'paola', 'clave-vieja-2026', Date.now())
      db.close()
      const raiz = resolve(import.meta.dirname, '../..')
      expect(JSON.parse(readFileSync(join(raiz, 'package.json'), 'utf8')).scripts['admin:restablecer']).toBe('tsx server/restablecer_superadmin.ts')
      const correr = (...args: string[]) =>
        execFileSync(process.execPath, ['--import', pathToFileURL(join(raiz, 'node_modules/tsx/dist/loader.mjs')).href, join(raiz, 'server/restablecer_superadmin.ts'), ...args], {
          cwd: dir,
          env: { ...process.env, DB_PATH: dbPath, SUPERADMIN_USUARIO: 'paola', SUPERADMIN_CLAVE: 'clave-nueva-2026' },
          encoding: 'utf8',
        })
      const claveDe = () => {
        const d = abrirDb(dbPath)
        const h = uno<{ clave_hash: string }>(d, "SELECT clave_hash FROM admins WHERE usuario = 'paola'")!.clave_hash
        d.close()
        return h
      }
      const ensayo = correr()
      expect(ensayo).toContain('Nada cambió')
      expect(verificarClave('clave-vieja-2026', claveDe())).toBe(true)
      const salida = correr('--confirmar')
      expect(salida).toContain('restablecida')
      expect(salida).not.toContain('clave-nueva-2026')
      expect(verificarClave('clave-nueva-2026', claveDe())).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
