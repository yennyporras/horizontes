// Eliminar salas, mesas y administradores (pedido de Paola, 21-oct).
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const cuenta = (tabla: string, donde = '1 = 1', ...p: unknown[]) =>
  Number((e.db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${donde}`).get(...(p as never[])) as { n: number }).n)

async function crearAdmin(usuario: string) {
  const r = await e.app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie: e.cookie }, payload: { usuario, nombre: `Nombre ${usuario}`, clave_temporal: 'temporal123' } })
  expect(r.statusCode).toBe(201)
  return r.json() as { id: number }
}

async function adminConClave(usuario: string) {
  const a = await crearAdmin(usuario)
  let cookie = await loginCookie(e.app, usuario, 'temporal123')
  const c = await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie }, payload: { actual: 'temporal123', nueva: 'definitiva123' } })
  expect(c.statusCode).toBe(200)
  cookie = await loginCookie(e.app, usuario, 'definitiva123')
  return { id: a.id, cookie }
}

/** Sala con 2 mesas, 2 inscritos en la Mesa 1, R1 votada por ambos y un acceso de nuevo emitido. */
async function salaConDatos(nombre = 'Taller para borrar') {
  const sala = await crearSala(e, 2, nombre)
  expect((await accion(e, sala.id, 'abrir_inscripcion')).statusCode).toBe(200)
  const tokens = [] as string[]
  for (const correo of ['a@x.co', 'b@x.co', 'c@x.co']) tokens.push((await inscribir(e, sala.mesas[0].codigo, correo)).json().token)
  expect((await accion(e, sala.id, 'abrir_ronda_1')).statusCode).toBe(200)
  for (const t of tokens) for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, t, p, 1)).statusCode).toBe(200)
  const pid = (e.db.prepare('SELECT id FROM participantes WHERE sala_id = ? AND correo = ?').get(sala.id, 'a@x.co') as { id: string }).id
  expect((await e.app.inject({ method: 'POST', url: `/api/admin/participantes/${pid}/acceso`, headers: { cookie: e.cookie } })).statusCode).toBe(200)
  return sala
}

const borrarSala = (id: string, cuerpo: unknown, cookie = e.cookie) =>
  e.app.inject({ method: 'DELETE', url: `/api/admin/salas/${id}`, headers: { cookie }, payload: cuerpo as object })

describe('DELETE /api/admin/salas/{id}', () => {
  it('con el nombre exacto borra la sala y todo lo suyo en una transacción (204); las demás salas no cambian', async () => {
    const sala = await salaConDatos()
    const otra = await salaConDatos('Otra sala')
    // La foto del consolidado se toma al leer el tablero con la ronda abierta.
    for (const s of [sala, otra]) {
      expect((await e.app.inject({ method: 'GET', url: `/api/tablero/${s.id}?t=${s.token_tablero}` })).statusCode).toBe(200)
    }
    const antesOtra = Object.fromEntries(['participantes', 'votos', 'mesas', 'eventos', 'proyectos', 'fotos_agregado'].map((t) => [t, cuenta(t, 'sala_id = ?', otra.id)]))
    expect(cuenta('fotos_agregado', 'sala_id = ?', sala.id)).toBeGreaterThan(0)
    expect(cuenta('accesos_participante', 'sala_id = ?', sala.id)).toBe(1)

    const r = await borrarSala(sala.id, { confirmar: '  Taller para borrar ' })
    expect(r.statusCode).toBe(204)
    expect(r.body).toBe('')
    for (const t of ['salas']) expect(cuenta(t, 'id = ?', sala.id)).toBe(0)
    for (const t of ['mesas', 'participantes', 'votos', 'fotos_agregado', 'accesos_participante', 'eventos', 'proyectos', 'hojas', 'contenido_sala']) {
      expect(cuenta(t, 'sala_id = ?', sala.id), t).toBe(0)
    }
    expect(cuenta('consentimientos', 'participante_id NOT IN (SELECT id FROM participantes)')).toBe(0)
    expect(e.db.prepare('PRAGMA foreign_key_check').all()).toEqual([])
    for (const [t, n] of Object.entries(antesOtra)) expect(cuenta(t, 'sala_id = ?', otra.id), t).toBe(n)

    // Ya no existe: el detalle responde 404 y la lista no la trae.
    expect((await e.app.inject({ method: 'GET', url: `/api/admin/salas/${sala.id}`, headers: { cookie: e.cookie } })).statusCode).toBe(404)
    const lista = (await e.app.inject({ method: 'GET', url: '/api/admin/salas', headers: { cookie: e.cookie } })).json().salas as { id: string }[]
    expect(lista.map((s) => s.id)).toEqual([otra.id])
    expect((await borrarSala(sala.id, { confirmar: 'Taller para borrar' })).statusCode).toBe(404)
  })

  it('sin el nombre exacto responde 422 CONFIRMACION_INVALIDA y no borra nada', async () => {
    const sala = await crearSala(e, 1, 'Taller Norte')
    for (const cuerpo of [{}, { confirmar: 'taller norte' }, { confirmar: 'Taller' }, { confirmar: 123 }, null]) {
      const r = await borrarSala(sala.id, cuerpo)
      expect(r.statusCode, JSON.stringify(cuerpo)).toBe(422)
      expect(r.json().error.codigo).toBe('CONFIRMACION_INVALIDA')
      expect(r.json().error.mensaje).toBe('Para eliminar la sala escribe su nombre exacto: «Taller Norte».')
    }
    expect(cuenta('salas', 'id = ?', sala.id)).toBe(1)
  })

  it('un admin normal recibe 403 SOLO_SUPERADMIN, aunque escriba bien el nombre', async () => {
    const sala = await crearSala(e, 1, 'Sala ajena')
    const { cookie } = await adminConClave('jorge')
    const r = await borrarSala(sala.id, { confirmar: 'Sala ajena' }, cookie)
    expect(r.statusCode).toBe(403)
    expect(r.json().error.codigo).toBe('SOLO_SUPERADMIN')
    expect(cuenta('salas', 'id = ?', sala.id)).toBe(1)
    expect((await e.app.inject({ method: 'DELETE', url: `/api/admin/salas/${sala.id}`, payload: { confirmar: 'Sala ajena' } })).statusCode).toBe(401)
  })

  it('las rúbricas guardadas para las salas nuevas no son de la sala y se quedan', async () => {
    const sala = await crearSala(e, 1, 'Con rúbrica')
    const rubrica = [9, 7, 5, 3, 1].map((valor) => ({ valor, texto: `Nivel ${valor} propio` }))
    const put = await e.app.inject({
      method: 'PUT',
      url: `/api/admin/salas/${sala.id}/rubricas/regulacion`,
      headers: { cookie: e.cookie },
      payload: { rubrica, usar_en_salas_nuevas: true },
    })
    expect(put.statusCode).toBe(200)
    const antes = cuenta('rubricas_plantilla')
    expect((await borrarSala(sala.id, { confirmar: 'Con rúbrica' })).statusCode).toBe(204)
    expect(cuenta('rubricas_plantilla')).toBe(antes)
  })
})

describe('respaldo antes de eliminar una sala', () => {
  it('deja una copia «antes_eliminar» que conserva la sala borrada', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-elim-'))
    const dbPath = join(dir, 'h.sqlite')
    const db = abrirDb(dbPath)
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, dbPath, ahora: () => T0, intervaloCierresMs: 0, baseUrl: 'https://horizontes.test' })
    try {
      const cookie = await loginCookie(app, 'paola', 'superclave123')
      const s = (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'Respaldada', plantilla: 'foodsume_2026', mesas: 2 } })).json()
      expect((await app.inject({ method: 'DELETE', url: `/api/admin/salas/${s.id}`, headers: { cookie }, payload: { confirmar: 'Mal' } })).statusCode).toBe(422)
      expect(existsSync(join(dir, 'respaldos'))).toBe(false) // un nombre mal escrito no gasta respaldos
      expect((await app.inject({ method: 'DELETE', url: `/api/admin/salas/${s.id}`, headers: { cookie }, payload: { confirmar: 'Respaldada' } })).statusCode).toBe(204)
      const respaldos = readdirSync(join(dir, 'respaldos')).filter((f) => f.includes(s.id) && f.includes('_antes_eliminar'))
      expect(respaldos).toHaveLength(1)
      const copia = abrirDb(join(dir, 'respaldos', respaldos[0]))
      expect((copia.prepare('SELECT nombre FROM salas WHERE id = ?').get(s.id) as { nombre: string }).nombre).toBe('Respaldada')
      copia.close()
    } finally {
      await app.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('si el respaldo falla responde 500 RESPALDO_FALLIDO y no borra nada', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-elim-'))
    const dbPath = join(dir, 'h.sqlite')
    writeFileSync(join(dir, 'respaldos'), 'no soy una carpeta')
    const db = abrirDb(dbPath)
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, dbPath, ahora: () => T0, intervaloCierresMs: 0 })
    try {
      const cookie = await loginCookie(app, 'paola', 'superclave123')
      const s = (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'Sin respaldo', plantilla: 'foodsume_2026', mesas: 1 } })).json()
      const r = await app.inject({ method: 'DELETE', url: `/api/admin/salas/${s.id}`, headers: { cookie }, payload: { confirmar: 'Sin respaldo' } })
      expect(r.statusCode).toBe(500)
      expect(r.json().error.codigo).toBe('RESPALDO_FALLIDO')
      expect(db.prepare('SELECT COUNT(*) AS n FROM salas WHERE id = ?').get(s.id)).toEqual({ n: 1 })
    } finally {
      await app.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('DELETE /api/admin/mesas/{id}', () => {
  const borrarMesa = (id: string, cookie = e.cookie) => e.app.inject({ method: 'DELETE', url: `/api/admin/mesas/${id}`, headers: { cookie } })

  it('borra una mesa vacía, devuelve las que quedan y lo anota en la bitácora; cualquier admin puede', async () => {
    const sala = await crearSala(e, 3)
    const { cookie } = await adminConClave('jorge')
    const r = await borrarMesa(sala.mesas[1].id, cookie)
    expect(r.statusCode).toBe(200)
    expect((r.json().mesas as { id: string; numero: number }[]).map((m) => m.numero)).toEqual([1, 3])
    expect(cuenta('mesas', 'sala_id = ?', sala.id)).toBe(2)
    const ev = e.db.prepare("SELECT por, detalle_json FROM eventos WHERE sala_id = ? AND tipo = 'mesa_eliminada'").get(sala.id) as { por: string; detalle_json: string }
    expect(ev.por).toBe('admin:jorge')
    expect(JSON.parse(ev.detalle_json)).toMatchObject({ mesa_id: sala.mesas[1].id, numero: 2, nombre: 'Mesa 2' })
    // El QR de la mesa borrada ya no existe; agregar una mesa sigue numerando después de la mayor.
    expect((await e.app.inject({ method: 'GET', url: `/api/mesas/${sala.mesas[1].codigo}` })).statusCode).toBe(404)
    const mas = await e.app.inject({ method: 'POST', url: `/api/admin/salas/${sala.id}/mesas`, headers: { cookie: e.cookie }, payload: { cantidad: 1 } })
    expect((mas.json().mesas as { numero: number }[]).map((m) => m.numero)).toEqual([1, 3, 4])
  })

  it('con inscritos, activos o inactivos, responde 409 MESA_CON_INSCRITOS y pide moverlos antes', async () => {
    const sala = await crearSala(e, 2)
    expect((await accion(e, sala.id, 'abrir_inscripcion')).statusCode).toBe(200)
    const token = (await inscribir(e, sala.mesas[0].codigo, 'x@x.co')).json().token
    expect(token).toBeTruthy()
    const r = await borrarMesa(sala.mesas[0].id)
    expect(r.statusCode).toBe(409)
    expect(r.json().error).toEqual({ codigo: 'MESA_CON_INSCRITOS', mensaje: 'Mesa 1 tiene 1 persona inscrita. Muévelas a otra mesa en Participantes antes de eliminarla.' })
    const pid = (e.db.prepare('SELECT id FROM participantes WHERE correo = ?').get('x@x.co') as { id: string }).id
    expect((await e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${pid}`, headers: { cookie: e.cookie }, payload: { activo: false } })).statusCode).toBe(200)
    expect((await borrarMesa(sala.mesas[0].id)).json().error.codigo).toBe('MESA_CON_INSCRITOS')
    expect(cuenta('mesas', 'sala_id = ?', sala.id)).toBe(2)
  })

  it('no borra la última mesa de la sala (409 ULTIMA_MESA) y responde 404 si la mesa no existe', async () => {
    const sala = await crearSala(e, 1)
    const r = await borrarMesa(sala.mesas[0].id)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('ULTIMA_MESA')
    expect((await borrarMesa('m_noexiste')).statusCode).toBe(404)
  })
})

describe('DELETE /api/admin/admins/{id}', () => {
  const borrarAdmin = (id: number, cookie = e.cookie) => e.app.inject({ method: 'DELETE', url: `/api/admin/admins/${id}`, headers: { cookie } })

  it('borra la cuenta y sus sesiones; lo que creó se conserva', async () => {
    const { id, cookie } = await adminConClave('jorge')
    const sala = (await e.app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'De Jorge', plantilla: 'foodsume_2026', mesas: 1 } })).json()
    expect(cuenta('sesiones_admin', 'admin_id = ?', id)).toBeGreaterThan(0)
    const r = await borrarAdmin(id)
    expect(r.statusCode).toBe(204)
    expect(cuenta('admins', 'id = ?', id)).toBe(0)
    expect(cuenta('sesiones_admin', 'admin_id = ?', id)).toBe(0)
    expect((await e.app.inject({ method: 'GET', url: '/api/admin/yo', headers: { cookie } })).statusCode).toBe(401)
    expect(cuenta('salas', 'id = ?', sala.id)).toBe(1)
    expect(cuenta('eventos', "sala_id = ? AND tipo = 'sala_creada' AND por = 'admin:jorge'", sala.id)).toBe(1)
    expect((await borrarAdmin(id)).statusCode).toBe(404)
  })

  it('la cuenta superadministradora no se borra a sí misma; un admin normal recibe 403', async () => {
    const paola = (e.db.prepare("SELECT id FROM admins WHERE usuario = 'paola'").get() as { id: number }).id
    const r = await borrarAdmin(paola)
    expect(r.statusCode).toBe(409)
    expect(r.json().error).toEqual({ codigo: 'OPERACION_INVALIDA', mensaje: 'No puedes eliminar tu propia cuenta.' })
    const { cookie } = await adminConClave('jorge')
    const otro = await crearAdmin('luisa')
    const r2 = await borrarAdmin(otro.id, cookie)
    expect(r2.statusCode).toBe(403)
    expect(r2.json().error.codigo).toBe('SOLO_SUPERADMIN')
    expect(cuenta('admins', 'id = ?', otro.id)).toBe(1)
  })

  it('no borra otra cuenta superadministradora (409)', async () => {
    asegurarSuperadmin(e.db, 'segunda', 'superclave456', T0)
    const segunda = (e.db.prepare("SELECT id FROM admins WHERE usuario = 'segunda'").get() as { id: number }).id
    const r = await borrarAdmin(segunda)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.mensaje).toBe('La cuenta superadministradora no se elimina desde aquí.')
  })

  it('las cuentas que creó quedan con creado_por en null', async () => {
    const jorge = await crearAdmin('jorge')
    await crearAdmin('luisa')
    e.db.prepare('UPDATE admins SET creado_por = ? WHERE usuario = ?').run(jorge.id, 'luisa')
    expect((await borrarAdmin(jorge.id)).statusCode).toBe(204)
    expect(e.db.prepare("SELECT creado_por FROM admins WHERE usuario = 'luisa'").get()).toEqual({ creado_por: null })
  })
})
