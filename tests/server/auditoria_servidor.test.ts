// Hallazgos S-3 a S-12 de la auditoría del servidor (20-oct). Cada prueba reproduce el caso del informe.
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { migrar } from '../../server/db/index'
import { MIGRACIONES } from '../../server/db/esquema'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, loginCookie } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const pedir = (method: string, url: string, payload?: unknown, cookie: string | null = e.cookie) =>
  e.app.inject({ method: method as 'GET', url, headers: cookie ? { cookie } : {}, ...(payload === undefined ? {} : { payload: payload as object }) })
const config = (id: string, cuerpo: object) => pedir('PATCH', `/api/admin/salas/${id}/config`, cuerpo)
const estado = async (id: string) => (await pedir('GET', `/api/admin/salas/${id}`)).json().sala.estado

describe('S-3: el límite de peticiones no se evita codificando la URL', () => {
  it('reproduce la auditoría: 25 intentos de login por /api/admin/%6Cogin terminan en 429', async () => {
    let ultimo = 0
    for (let i = 0; i < 25; i++) {
      ultimo = (await e.app.inject({ method: 'POST', url: '/api/admin/%6Cogin', payload: { usuario: 'paola', clave: 'mala-clave-1' } })).statusCode
    }
    expect(ultimo).toBe(429)
    // El cupo es el mismo para la URL normal y la codificada: ya está agotado.
    const normal = await e.app.inject({ method: 'POST', url: '/api/admin/login?x=1', payload: { usuario: 'paola', clave: 'superclave123' } })
    expect(normal.statusCode).toBe(429)
  })
})

describe('S-5: códigos de mesa y GET /api/mesas/:codigo', () => {
  it('el código de una mesa nueva no se deduce del de la sala', async () => {
    const s = await crearSala(e, 2)
    for (const m of s.mesas) expect(m.codigo).toMatch(new RegExp(`^${s.codigo}[A-HJ-NP-Z2-9]{3}-\\d+$`))
    expect((await e.app.inject(`/api/mesas/${s.codigo}-1`)).statusCode).toBe(404)
    expect((await e.app.inject(`/api/mesas/${s.mesas[0].codigo}`)).statusCode).toBe(200)
  })

  it('las mesas existentes con el código viejo ({sala}-{n}) siguen funcionando', async () => {
    const s = await crearSala(e, 1)
    e.db.prepare('UPDATE mesas SET codigo = ? WHERE id = ?').run(`${s.codigo}-1`, s.mesas[0].id)
    expect((await e.app.inject(`/api/mesas/${s.codigo}-1`)).json().mesa.id).toBe(s.mesas[0].id)
    await accion(e, s.id, 'abrir_inscripcion')
    expect((await inscribir(e, `${s.codigo.toLowerCase()}-1`, 'viejo@x.co')).statusCode).toBe(201)
    // Agregar mesas a esa sala deja las nuevas con sufijo y no toca la vieja.
    const m = (await pedir('POST', `/api/admin/salas/${s.id}/mesas`, { cantidad: 1 })).json().mesas
    expect(m[0].codigo).toBe(`${s.codigo}-1`)
    expect(m[1].codigo).toMatch(new RegExp(`^${s.codigo}[A-HJ-NP-Z2-9]{3}-2$`))
  })

  it('GET /api/mesas/:codigo tiene límite por IP: quien recorre códigos recibe 429', async () => {
    let ultimo = 0
    for (let i = 0; i < 601; i++) ultimo = (await e.app.inject(`/api/mesas/HZAAA${i}-1`)).statusCode
    expect(ultimo).toBe(429)
  })
})

describe('S-7 y S-8: fechas programadas', () => {
  it('reproduce la auditoría: un año de 5 dígitos ya no cierra la ronda al instante (422)', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    const r = await config(s.id, { cierre_programado_r1_at: '+020266-10-20T15:00:00-05:00' })
    expect([r.statusCode, r.json().error.codigo]).toEqual([422, 'CONFIG_INVALIDA'])
    expect(await estado(s.id)).toBe('r1_abierta')
  })

  it.each(['2026-10-20T16:00', 'October 21, 2026', '2026-10-21', '2026-10-20 16:00:00-05:00', '2026-10-20T16:00:00-0500'])('rechaza %j: debe ser ISO con zona', async (v) => {
    const s = await crearSala(e, 1)
    const r = await config(s.id, { cierre_programado_r1_at: v })
    expect([r.statusCode, r.json().error.codigo]).toEqual([422, 'CONFIG_INVALIDA'])
  })

  it.each(['2026-10-20T16:00-05:00', '2026-10-20T21:00:00Z', '2026-10-20T21:00:00.000Z'])('acepta %j', async (v) => {
    const s = await crearSala(e, 1)
    const r = await config(s.id, { cierre_programado_r1_at: v })
    expect(r.statusCode).toBe(200)
    expect(r.json().cierre_programado_r1_at).toBe('2026-10-20T16:00:00-05:00')
  })

  it('una hora guardada con un año extendido (de antes del arreglo) no se aplica de golpe: se compara en milisegundos', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    e.db.prepare('UPDATE salas SET cierre_programado_r1_at = ? WHERE id = ?').run('+020266-10-20T20:00:00.000Z', s.id)
    expect(await estado(s.id)).toBe('r1_abierta')
    // Y una hora normal sí se aplica a su hora.
    e.db.prepare('UPDATE salas SET cierre_programado_r1_at = ? WHERE id = ?').run(new Date(T0 + 60_000).toISOString(), s.id)
    e.reloj.ms = T0 + 60_000
    expect(await estado(s.id)).toBe('r1_cerrada')
  })
})

describe('S-9: cuerpos y consultas raras responden 4xx, no 500', () => {
  it('?t=a&t=b en el tablero responde 401', async () => {
    const s = await crearSala(e, 1)
    const r = await e.app.inject(`/api/tablero/${s.id}?t=a&t=b`)
    expect([r.statusCode, r.json().error.codigo]).toEqual([401, 'TOKEN_TABLERO_INVALIDO'])
    expect((await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}&t=${s.token_tablero}`)).statusCode).toBe(401)
  })

  it.each([123, ['a'], { a: 1 }, null])('POST /api/admin/salas con nombre %j responde 422', async (nombre) => {
    const r = await pedir('POST', '/api/admin/salas', { nombre, plantilla: 'foodsume_2026', mesas: 1 })
    expect([r.statusCode, r.json().error.codigo]).toEqual([422, 'DATOS_INVALIDOS'])
  })

  it.each([true, {}, 5, ['m']])('PATCH de participante con mesa_id %j responde 422', async (mesa_id) => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const p = (await inscribir(e, s.mesas[0].codigo, 'a@x.co')).json().participante
    const r = await pedir('PATCH', `/api/admin/participantes/${p.id}`, { mesa_id })
    expect([r.statusCode, r.json().error.codigo]).toEqual([422, 'DATOS_INVALIDOS'])
    expect((await pedir('PATCH', `/api/admin/participantes/${p.id}`, { perfil_id: ['cliente'] })).statusCode).toBe(422)
  })
})

describe('S-10: pregunta guiada en modo automático', () => {
  it('fijarla responde 409 MODO_NO_GUIADO; quitarla (null) sí se puede', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    const r = await pedir('PUT', `/api/admin/salas/${s.id}/pregunta-guiada`, { proyecto_id: 'insumex', criterio_id: 'regulacion' })
    expect([r.statusCode, r.json().error.codigo]).toEqual([409, 'MODO_NO_GUIADO'])
    expect((await pedir('PUT', `/api/admin/salas/${s.id}/pregunta-guiada`, null)).statusCode).toBe(200)
    await config(s.id, { modo_preguntas: 'guiado' })
    expect((await pedir('PUT', `/api/admin/salas/${s.id}/pregunta-guiada`, { proyecto_id: 'insumex', criterio_id: 'regulacion' })).statusCode).toBe(200)
  })
})

describe('S-11: cambiar la clave cierra las otras sesiones del admin', () => {
  it('la sesión que la cambió sigue; la del otro navegador queda en 401', async () => {
    const otra = await loginCookie(e.app, 'paola', 'superclave123')
    expect((await pedir('GET', '/api/admin/yo', undefined, otra)).statusCode).toBe(200)
    const r = await pedir('POST', '/api/admin/cambiar-clave', { actual: 'superclave123', nueva: 'nueva-clave-456' })
    expect(r.statusCode).toBe(200)
    expect((await pedir('GET', '/api/admin/yo')).statusCode).toBe(200)
    expect((await pedir('GET', '/api/admin/yo', undefined, otra)).statusCode).toBe(401)
  })
})

describe('S-12: el token del tablero tiene una sola fuente', () => {
  it('las salas nuevas no guardan hash; el enlace con el token sigue funcionando', async () => {
    const s = await crearSala(e, 1)
    const fila = e.db.prepare('SELECT token_tablero_hash, token_tablero FROM salas WHERE id = ?').get(s.id) as { token_tablero_hash: string; token_tablero: string }
    expect(fila.token_tablero_hash).toBe('')
    expect(fila.token_tablero).toBe(s.token_tablero)
    expect((await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).statusCode).toBe(200)
    expect((await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}x`)).statusCode).toBe(401)
  })

  it('la migración 7 vacía el hash de las salas existentes y su enlace sigue sirviendo', () => {
    const db = new DatabaseSync(':memory:')
    for (const m of MIGRACIONES.slice(0, 6)) db.exec(m)
    db.exec('PRAGMA user_version = 6')
    db.prepare(
      `INSERT INTO salas (id, codigo, nombre, plantilla, estado, token_tablero_hash, token_tablero, creada_at) VALUES ('s_x', 'HZXXX', 'X', 'foodsume_2026', 'preparada', 'abc', 'tok', '2026-10-20T00:00:00.000Z')`,
    ).run()
    migrar(db)
    expect(db.prepare("SELECT token_tablero_hash AS h, token_tablero AS t FROM salas WHERE id = 's_x'").get()).toEqual({ h: '', t: 'tok' })
    db.close()
  })
})
