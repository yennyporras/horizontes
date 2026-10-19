// Cambios del 19-oct (docs/CAMBIOS_19OCT_CONTRATO.md): programación por sala y ronda, respuestas por persona,
// modo guiado y base_url. API real con BD en memoria y reloj simulado.
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb, migrar } from '../../server/db/index'
import { MIGRACIONES } from '../../server/db/esquema'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { type Entorno, RESPUESTAS_5, T0, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const iso = (ms: number) => new Date(ms).toISOString()
const MIN = 60_000
/** `payload` se manda como JSON tal cual (también `null`); `cookie: null` pide sin sesión. */
const pedir = (method: 'GET' | 'PATCH' | 'PUT', url: string, payload?: unknown, cookie: string | null = e.cookie) => {
  const headers: Record<string, string> = cookie ? { cookie } : {}
  if (payload !== undefined) headers['content-type'] = 'application/json'
  return e.app.inject({ method, url, headers, payload: payload === undefined ? undefined : JSON.stringify(payload) })
}
const config = (id: string, c: object) => pedir('PATCH', `/api/admin/salas/${id}/config`, c)
const detalle = async (id: string) => (await pedir('GET', `/api/admin/salas/${id}`)).json()
const yo = (token: string) => e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': token } })
const tablero = async (s: { id: string; token_tablero: string }) => (await e.app.inject({ method: 'GET', url: `/api/tablero/${s.id}?t=${s.token_tablero}` })).json()
const eventos = async (id: string) => (await detalle(id)).eventos as { tipo: string; por: string; detalle: Record<string, unknown> | null }[]

describe('programación de apertura y cierre por sala y por ronda', () => {
  it('abre la inscripción, la ronda 1 y la ronda 2 a su hora y cierra cada una (chequeo perezoso)', async () => {
    const s = await crearSala(e, 1)
    const r = await config(s.id, {
      apertura_programada_sala_at: iso(T0 + 10 * MIN),
      apertura_programada_r1_at: iso(T0 + 20 * MIN),
      cierre_programado_r1_at: iso(T0 + 40 * MIN),
      apertura_programada_r2_at: iso(T0 + 45 * MIN),
      cierre_programado_r2_at: iso(T0 + 70 * MIN),
      cierre_programado_sala_at: iso(T0 + 80 * MIN),
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({
      apertura_programada_sala_at: '2026-10-20T14:10:00-05:00',
      apertura_programada_r1_at: '2026-10-20T14:20:00-05:00',
      cierre_programado_r1_at: '2026-10-20T14:40:00-05:00',
      apertura_programada_r2_at: '2026-10-20T14:45:00-05:00',
      cierre_programado_r2_at: '2026-10-20T15:10:00-05:00',
      cierre_programado_sala_at: '2026-10-20T15:20:00-05:00',
      // Alias: el cierre de la ronda siguiente (la 1) mientras no haya ronda abierta.
      cierre_programado_ronda_at: '2026-10-20T14:40:00-05:00',
    })

    const pasos: [number, string][] = [
      [T0 + 10 * MIN - 1, 'preparada'],
      [T0 + 10 * MIN, 'inscripcion'],
      [T0 + 20 * MIN, 'r1_abierta'],
      [T0 + 40 * MIN, 'r1_cerrada'],
      [T0 + 45 * MIN, 'r2_abierta'],
      [T0 + 70 * MIN, 'r2_cerrada'],
      [T0 + 80 * MIN, 'cerrada'],
    ]
    for (const [ms, estado] of pasos) {
      e.reloj.ms = ms
      expect((await detalle(s.id)).sala.estado).toBe(estado)
    }
    const ev = await eventos(s.id)
    const programados = ev.filter((x) => x.por === 'programado')
    expect(programados.filter((x) => x.tipo === 'apertura_programada').map((x) => x.detalle!.accion)).toEqual(['abrir_ronda_2', 'abrir_ronda_1', 'abrir_inscripcion'])
    expect(programados.filter((x) => x.tipo === 'cierre_programado').map((x) => x.detalle!.accion)).toEqual(['cerrar_sala', 'cerrar_ronda_2', 'cerrar_ronda_1'])
    expect(ev.some((x) => x.tipo.endsWith('_descartada') || x.tipo.endsWith('_descartado'))).toBe(false)
    const cfg = (await detalle(s.id)).sala.config
    for (const campo of ['apertura_programada_sala_at', 'apertura_programada_r1_at', 'cierre_programado_r1_at', 'apertura_programada_r2_at', 'cierre_programado_r2_at', 'cierre_programado_sala_at', 'cierre_programado_ronda_at']) {
      expect(cfg[campo]).toBeNull()
    }
  })

  it('con varias horas vencidas a la vez las aplica en el orden del taller y la versión sube', async () => {
    const s = await crearSala(e, 1)
    await config(s.id, { apertura_programada_sala_at: iso(T0 + MIN), apertura_programada_r1_at: iso(T0 + 2 * MIN) })
    const v1 = (await detalle(s.id)).version
    e.reloj.ms = T0 + 5 * MIN
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('r1_abierta')
    expect(d.version).not.toBe(v1)
  })

  it('el intervalo también aplica las aperturas sin peticiones', async () => {
    const db = abrirDb(':memory:')
    const reloj = { ms: T0 }
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, ahora: () => reloj.ms, intervaloCierresMs: 20 })
    const cookie = await loginCookie(app, 'paola', 'superclave123')
    const s = (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'X', plantilla: 'foodsume_2026', mesas: 1 } })).json()
    await app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie }, payload: { apertura_programada_r1_at: iso(T0 + 1000) } })
    reloj.ms = T0 + 1000
    await new Promise((r) => setTimeout(r, 120))
    expect((db.prepare('SELECT estado FROM salas WHERE id = ?').get(s.id) as { estado: string }).estado).toBe('r1_abierta')
    await app.close()
  })

  it('una apertura programada que arranca la sala deja el respaldo de inicio; un cierre de sala, solo el de cierre', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-resp19-'))
    const db = abrirDb(join(dir, 'h.sqlite'))
    const reloj = { ms: T0 }
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, dbPath: join(dir, 'h.sqlite'), ahora: () => reloj.ms, intervaloCierresMs: 0 })
    try {
      const cookie = await loginCookie(app, 'paola', 'superclave123')
      const crear = async () => (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'R', plantilla: 'foodsume_2026', mesas: 1 } })).json()
      const programar = (id: string, c: object) => app.inject({ method: 'PATCH', url: `/api/admin/salas/${id}/config`, headers: { cookie }, payload: c })
      const s1 = await crear()
      const s2 = await crear()
      await programar(s1.id, { apertura_programada_sala_at: iso(T0 + MIN) })
      await programar(s2.id, { cierre_programado_sala_at: iso(T0 + MIN) })
      reloj.ms = T0 + MIN
      await app.inject({ url: '/api/admin/salas', headers: { cookie } })
      const respaldos = readdirSync(join(dir, 'respaldos'))
      expect(respaldos.filter((f) => f.includes(`${s1.id}_inicio`))).toHaveLength(1)
      expect(respaldos.filter((f) => f.includes(s2.id)).map((f) => f.includes('_cierre'))).toEqual([true])
    } finally {
      await app.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('una apertura cuya transición no es válida a esa hora se descarta y queda en la bitácora', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    // R2 programada sin cerrar R1: a su hora la ronda 1 sigue abierta.
    await config(s.id, { apertura_programada_r2_at: iso(T0 + 10 * MIN) })
    e.reloj.ms = T0 + 10 * MIN
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('r1_abierta')
    expect(d.sala.config.apertura_programada_r2_at).toBeNull()
    const desc = d.eventos.find((x: { tipo: string }) => x.tipo === 'apertura_programada_descartada')
    expect(desc).toMatchObject({ por: 'programado', detalle: { accion: 'abrir_ronda_2', estado: 'r1_abierta' } })
    // Descartada: cerrar R1 después no abre R2 de golpe.
    await accion(e, s.id, 'cerrar_ronda_1')
    e.reloj.ms = T0 + 20 * MIN
    expect((await detalle(s.id)).sala.estado).toBe('r1_cerrada')
  })

  it('un cierre de ronda que vence sin esa ronda abierta se descarta', async () => {
    const s = await crearSala(e, 1)
    await config(s.id, { cierre_programado_r2_at: iso(T0 + 5 * MIN) })
    e.reloj.ms = T0 + 5 * MIN
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('preparada')
    expect(d.sala.config.cierre_programado_r2_at).toBeNull()
    expect(d.eventos.find((x: { tipo: string }) => x.tipo === 'cierre_programado_descartado')).toMatchObject({ detalle: { accion: 'cerrar_ronda_2' } })
  })

  it('la acción manual consume lo programado para ella', async () => {
    const s = await crearSala(e, 1)
    await config(s.id, { apertura_programada_sala_at: iso(T0 + 10 * MIN), apertura_programada_r1_at: iso(T0 + 20 * MIN) })
    const r = await accion(e, s.id, 'abrir_ronda_1')
    expect(r.json().sala.config).toMatchObject({ apertura_programada_sala_at: null, apertura_programada_r1_at: null })
    e.reloj.ms = T0 + 30 * MIN
    expect((await eventos(s.id)).some((x) => x.por === 'programado')).toBe(false)
  })

  it('valida el orden: cada apertura antes de su cierre y las etapas en el orden del taller', async () => {
    const s = await crearSala(e, 1)
    const malos = [
      { apertura_programada_r1_at: iso(T0 + 20 * MIN), cierre_programado_r1_at: iso(T0 + 10 * MIN) },
      { apertura_programada_r1_at: iso(T0 + 20 * MIN), cierre_programado_r1_at: iso(T0 + 20 * MIN) },
      { apertura_programada_sala_at: iso(T0 + 30 * MIN), cierre_programado_sala_at: iso(T0 + 30 * MIN) },
      { cierre_programado_r1_at: iso(T0 + 30 * MIN), apertura_programada_r2_at: iso(T0 + 20 * MIN) },
      { cierre_programado_r2_at: iso(T0 + 90 * MIN), cierre_programado_sala_at: iso(T0 + 60 * MIN) },
      { apertura_programada_sala_at: iso(T0 + 30 * MIN), apertura_programada_r1_at: iso(T0 + 20 * MIN) },
    ]
    for (const c of malos) {
      const r = await config(s.id, c)
      expect(r.statusCode, JSON.stringify(c)).toBe(422)
      expect(r.json().error.codigo).toBe('ORDEN_INVALIDO')
    }
    // Se compara también contra lo ya guardado.
    expect((await config(s.id, { cierre_programado_r1_at: iso(T0 + 30 * MIN) })).statusCode).toBe(200)
    const r = await config(s.id, { apertura_programada_r1_at: iso(T0 + 40 * MIN) })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.mensaje).toBe('La apertura de la ronda 1 debe ser antes que el cierre de la ronda 1.')
    // Etapas distintas a la misma hora sí: cerrar R1 y abrir R2 en el mismo minuto.
    expect((await config(s.id, { apertura_programada_r2_at: iso(T0 + 30 * MIN) })).statusCode).toBe(200)
    // Nada de lo rechazado quedó guardado.
    expect((await detalle(s.id)).sala.config).toMatchObject({ apertura_programada_sala_at: null, apertura_programada_r1_at: null, cierre_programado_sala_at: null })
  })

  it('rechaza una hora pasada con 422 HORA_PASADA y una fecha inválida con CONFIG_INVALIDA', async () => {
    const s = await crearSala(e, 1)
    e.reloj.ms = T0 + 10 * MIN
    for (const campo of ['apertura_programada_sala_at', 'apertura_programada_r1_at', 'cierre_programado_r1_at', 'apertura_programada_r2_at', 'cierre_programado_r2_at']) {
      const r = await config(s.id, { [campo]: '2026-10-20T14:05:00-05:00' })
      expect(r.statusCode).toBe(422)
      expect(r.json().error.codigo).toBe('HORA_PASADA')
      expect(r.json().error.mensaje).toContain('14:10:00')
      expect((await config(s.id, { [campo]: 'mañana' })).json().error.codigo).toBe('CONFIG_INVALIDA')
    }
  })

  it('cierre_programado_ronda_at sigue funcionando como alias de la ronda abierta', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    let r = await config(s.id, { cierre_programado_ronda_at: iso(T0 + 10 * MIN) })
    expect(r.json()).toMatchObject({ cierre_programado_ronda_at: '2026-10-20T14:10:00-05:00', cierre_programado_r1_at: '2026-10-20T14:10:00-05:00', cierre_programado_r2_at: null })
    e.reloj.ms = T0 + 10 * MIN
    expect((await detalle(s.id)).sala.estado).toBe('r1_cerrada')

    // Con R1 cerrada, el alias apunta a la ronda 2.
    r = await config(s.id, { cierre_programado_ronda_at: iso(T0 + 30 * MIN) })
    expect(r.json()).toMatchObject({ cierre_programado_ronda_at: '2026-10-20T14:30:00-05:00', cierre_programado_r1_at: null, cierre_programado_r2_at: '2026-10-20T14:30:00-05:00' })
    await accion(e, s.id, 'abrir_ronda_2')
    e.reloj.ms = T0 + 30 * MIN
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('r2_cerrada')
    expect(d.sala.config.cierre_programado_ronda_at).toBeNull()

    // El campo propio manda sobre el alias si llegan juntos; null borra.
    const s2 = await crearSala(e, 1)
    r = await config(s2.id, { cierre_programado_ronda_at: iso(T0 + 50 * MIN), cierre_programado_r1_at: iso(T0 + 60 * MIN) })
    expect(r.json().cierre_programado_r1_at).toBe('2026-10-20T15:00:00-05:00')
    expect((await config(s2.id, { cierre_programado_ronda_at: null })).json()).toMatchObject({ cierre_programado_ronda_at: null, cierre_programado_r1_at: null })
  })

  it('la migración pasa un cierre de ronda guardado antes del 19-oct a la ronda que habría cerrado', () => {
    const db = new DatabaseSync(':memory:')
    for (const m of MIGRACIONES.slice(0, 3)) db.exec(m)
    db.exec('PRAGMA user_version = 3')
    const t = '2026-10-20T20:00:00.000Z'
    const ins = db.prepare(
      `INSERT INTO salas (id, codigo, nombre, plantilla, estado, ronda_actual, token_tablero_hash, token_tablero, creada_at, cierre_programado_ronda_at)
       VALUES (?, ?, 'X', 'foodsume_2026', ?, ?, 'h', 't', '2026-10-20T19:00:00.000Z', ?)`,
    )
    ins.run('s_a', 'A', 'r1_abierta', 1, t)
    ins.run('s_b', 'B', 'r1_cerrada', 1, t)
    ins.run('s_c', 'C', 'inscripcion', 0, t)
    ins.run('s_d', 'D', 'r2_abierta', 2, t)
    ins.run('s_e', 'E', 'r1_abierta', 1, null)
    migrar(db)
    const fila = (id: string) => ({ ...(db.prepare('SELECT cierre_programado_ronda_at AS ronda, cierre_programado_r1_at AS r1, cierre_programado_r2_at AS r2, modo_preguntas AS modo FROM salas WHERE id = ?').get(id) as object) })
    expect(fila('s_a')).toEqual({ ronda: null, r1: t, r2: null, modo: 'automatico' })
    expect(fila('s_b')).toEqual({ ronda: null, r1: null, r2: t, modo: 'automatico' })
    expect(fila('s_c')).toEqual({ ronda: null, r1: t, r2: null, modo: 'automatico' })
    expect(fila('s_d')).toEqual({ ronda: null, r1: null, r2: t, modo: 'automatico' })
    expect(fila('s_e')).toEqual({ ronda: null, r1: null, r2: null, modo: 'automatico' })
    db.close()
  })
})

describe('respuestas por persona (solo admin)', () => {
  it('lista nombre, correo, mesa, perfil, ronda y respuestas de cada persona', async () => {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_ronda_1')
    const a = (await inscribir(e, s.mesas[0].codigo, 'ana@prueba.co', 'Ana Pérez')).json()
    const b = (await inscribir(e, s.mesas[1].codigo, 'beto@prueba.co', 'Beto Ríos')).json()
    await votar(e, a.token, 'nutriwhat', 1, { ...RESPUESTAS_5, regulacion: 9 })
    await votar(e, a.token, 'insumex', 1)
    await votar(e, b.token, 'insumex', 1, { ...RESPUESTAS_5, alineacion_core: 1 })
    const r = await pedir('GET', `/api/admin/salas/${s.id}/respuestas`)
    expect(r.statusCode).toBe(200)
    const filas = r.json().respuestas
    expect(filas).toHaveLength(3)
    expect(filas[0]).toEqual({
      participante_id: a.participante.id,
      nombre: 'Ana Pérez',
      correo: 'ana@prueba.co',
      mesa_id: s.mesas[0].id,
      mesa: 'Mesa 1',
      perfil_id: a.participante.perfil.id,
      activo: true,
      ronda: 1,
      proyecto_id: 'insumex',
      respuestas: RESPUESTAS_5,
      actualizado_at: '2026-10-20T14:00:00-05:00',
    })
    expect(filas[1]).toMatchObject({ participante_id: a.participante.id, proyecto_id: 'nutriwhat', respuestas: { regulacion: 9 } })
    expect(filas[2]).toMatchObject({ nombre: 'Beto Ríos', mesa: 'Mesa 2', respuestas: { alineacion_core: 1 } })
    // Por código de sala también.
    expect((await pedir('GET', `/api/admin/salas/${s.codigo}/respuestas`)).json().respuestas).toHaveLength(3)
  })

  it('401 sin sesión, 403 con clave temporal y 200 para un admin (no solo el superadmin)', async () => {
    const s = await crearSala(e, 1)
    const url = `/api/admin/salas/${s.id}/respuestas`
    const sin = await pedir('GET', url, undefined, null)
    expect(sin.statusCode).toBe(401)
    expect(sin.json().error.codigo).toBe('SESION_REQUERIDA')
    await e.app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie: e.cookie }, payload: { usuario: 'jorge', nombre: 'Jorge', correo: 'jorge@estratek.com.co', clave_temporal: 'temporal123' } })
    const temp = await loginCookie(e.app, 'jorge', 'temporal123')
    const r403 = await pedir('GET', url, undefined, temp)
    expect(r403.statusCode).toBe(403)
    expect(r403.json().error.codigo).toBe('CAMBIO_CLAVE_REQUERIDO')
    await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie: temp }, payload: { actual: 'temporal123', nueva: 'definitiva456' } })
    expect((await pedir('GET', url, undefined, temp)).statusCode).toBe(200)
    expect((await pedir('GET', '/api/admin/salas/s_noexiste/respuestas')).statusCode).toBe(404)
  })

  it('ninguna ruta pública expone nombres, correos ni respuestas de otra persona', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    const tokens: string[] = []
    for (const n of ['uno', 'dos', 'tres']) {
      const t = (await inscribir(e, s.mesas[0].codigo, `${n}@secreto.co`, `Nombre ${n}`)).json().token
      tokens.push(t)
      for (const p of ['insumex', 'nutriwhat']) await votar(e, t, p, 1)
    }
    await accion(e, s.id, 'cerrar_ronda_1')
    const publicas = [
      await yo(tokens[0]),
      await e.app.inject({ method: 'GET', url: '/api/resultados?ronda=1', headers: { 'x-participante-token': tokens[0] } }),
      await e.app.inject({ method: 'GET', url: `/api/tablero/${s.id}?t=${s.token_tablero}` }),
      await e.app.inject({ method: 'GET', url: `/api/mesas/${s.mesas[0].codigo}` }),
    ]
    for (const r of publicas) {
      expect(r.statusCode).toBe(200)
      expect(r.body).not.toMatch(/dos@secreto|tres@secreto|Nombre dos|Nombre tres|participante_id/)
    }
    // Sin sesión de admin, la ruta de respuestas no responde aunque se tenga el token del tablero o de un participante.
    expect((await e.app.inject({ method: 'GET', url: `/api/admin/salas/${s.id}/respuestas?t=${s.token_tablero}` })).statusCode).toBe(401)
    expect((await e.app.inject({ method: 'GET', url: `/api/admin/salas/${s.id}/respuestas`, headers: { 'x-participante-token': tokens[0] } })).statusCode).toBe(401)
  })
})

describe('modo de preguntas y pregunta guiada', () => {
  const fijar = (id: string, cuerpo: unknown, cookie: string | null = e.cookie) => pedir('PUT', `/api/admin/salas/${id}/pregunta-guiada`, cuerpo, cookie)

  it('modo_preguntas sale automático por defecto, se cambia por config y llega a /api/yo y al tablero', async () => {
    const s = await crearSala(e, 1)
    expect((await detalle(s.id)).sala.config.modo_preguntas).toBe('automatico')
    expect((await config(s.id, { modo_preguntas: 'todos' })).json().error.codigo).toBe('CONFIG_INVALIDA')
    expect((await config(s.id, { modo_preguntas: 'guiado' })).json().modo_preguntas).toBe('guiado')
    await accion(e, s.id, 'abrir_ronda_1')
    const t = (await inscribir(e, s.mesas[0].codigo, 'a@prueba.co')).json().token
    expect((await yo(t)).json().config.modo_preguntas).toBe('guiado')
    expect((await tablero(s)).config.modo_preguntas).toBe('guiado')
  })

  it('409 RONDA_CERRADA sin ronda abierta', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const r = await fijar(s.id, { proyecto_id: 'insumex', criterio_id: 'regulacion' })
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('RONDA_CERRADA')
  })

  it('con ronda abierta se ve en /api/yo, en el tablero y en el panel; sube la versión y queda en la bitácora', async () => {
    const s = await crearSala(e, 1)
    await config(s.id, { modo_preguntas: 'guiado' })
    await accion(e, s.id, 'abrir_ronda_1')
    const t = (await inscribir(e, s.mesas[0].codigo, 'a@prueba.co')).json().token
    const antes = await yo(t)
    expect(antes.json().sala.pregunta_guiada).toBeNull()
    const etag = antes.headers.etag as string
    const vTablero = (await tablero(s)).version

    const r = await fijar(s.id, { proyecto_id: 'insumex', criterio_id: 'regulacion' })
    expect(r.statusCode).toBe(200)
    expect(r.json().pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'regulacion' })

    const despues = await e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': t, 'if-none-match': etag } })
    expect(despues.statusCode).toBe(200)
    expect(despues.json().sala.pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'regulacion' })
    const tb = await tablero(s)
    expect(tb.version).not.toBe(vTablero)
    expect(tb.sala.pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'regulacion' })
    const d = await detalle(s.id)
    expect(d.version).toBe(r.json().version)
    expect(d.sala.pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'regulacion' })
    expect(d.eventos[0]).toMatchObject({ tipo: 'pregunta_guiada', por: 'admin:paola', detalle: { ronda: 1, proyecto_id: 'insumex', criterio_id: 'regulacion' } })

    // El voto se sigue guardando completo.
    expect((await votar(e, t, 'insumex', 1)).statusCode).toBe(200)

    // null la quita.
    expect((await fijar(s.id, null)).json().pregunta_guiada).toBeNull()
    expect((await yo(t)).json().sala.pregunta_guiada).toBeNull()
  })

  it('valida proyecto y criterio, y exige sesión', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    expect((await fijar(s.id, { proyecto_id: 'bioskin', criterio_id: 'regulacion' })).json().error.codigo).toBe('PROYECTO_INVALIDO')
    expect((await fijar(s.id, { proyecto_id: 'insumex', criterio_id: 'otro' })).json().error.codigo).toBe('CRITERIO_NO_EXISTE')
    expect((await fijar(s.id, { proyecto_id: 'insumex', criterio_id: 'regulacion' }, null)).statusCode).toBe(401)
  })

  it('cerrar la ronda o cambiar de modo quita la pregunta guiada', async () => {
    const s = await crearSala(e, 1)
    await config(s.id, { modo_preguntas: 'guiado' })
    await accion(e, s.id, 'abrir_ronda_1')
    await fijar(s.id, { proyecto_id: 'nutriwhat', criterio_id: 'alineacion_core' })
    await accion(e, s.id, 'cerrar_ronda_1')
    expect((await detalle(s.id)).sala.pregunta_guiada).toBeNull()
    await accion(e, s.id, 'abrir_ronda_2')
    await fijar(s.id, { proyecto_id: 'nutriwhat', criterio_id: 'alineacion_core' })
    await config(s.id, { modo_preguntas: 'automatico' })
    expect((await detalle(s.id)).sala.pregunta_guiada).toBeNull()
  })
})

describe('base_url', () => {
  it('el detalle de sala trae la BASE_URL del servidor (sin barra final) y la hora del servidor', async () => {
    const s = await crearSala(e, 1)
    const d = await detalle(s.id)
    expect(d.base_url).toBe('https://horizontes.test')
    expect(d.servidor_at).toBe('2026-10-20T14:00:00-05:00')
    expect(d.mesas[0].url_participante.startsWith(`${d.base_url}/m/`)).toBe(true)
  })
})
