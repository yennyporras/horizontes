// Backlog T1: eventos paginados, límite por IP, respaldo al cerrar sala y caché del tablero.
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { LimitadorPeticiones, reiniciarSalaLimpia } from '../../server/dominio/mantenimiento'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'
import { uno } from '../../server/db/index'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(() => e.app.close())

describe('eventos paginados', () => {
  it('pagina del más reciente al más antiguo con cursor `antes`', async () => {
    const s = await crearSala(e, 1)
    for (const a of ['abrir_inscripcion', 'abrir_ronda_1', 'cerrar_ronda_1', 'reabrir_ronda', 'cerrar_ronda_1']) await accion(e, s.id, a)
    const p1 = (await e.app.inject({ url: `/api/admin/salas/${s.id}/eventos?limite=4`, headers: { cookie: e.cookie } })).json()
    expect(p1.eventos).toHaveLength(4)
    expect(p1.eventos[0].tipo).toBe('ronda_cerrada')
    expect(p1.siguiente).toBe(p1.eventos[3].id)
    const p2 = (await e.app.inject({ url: `/api/admin/salas/${s.id}/eventos?limite=4&antes=${p1.siguiente}`, headers: { cookie: e.cookie } })).json()
    expect(p2.eventos.map((x: { tipo: string }) => x.tipo)).toEqual(['inscripcion_abierta', 'sala_creada'])
    expect(p2.siguiente).toBeNull()
  })

  it('exige sesión de admin', async () => {
    const s = await crearSala(e, 1)
    expect((await e.app.inject(`/api/admin/salas/${s.id}/eventos`)).statusCode).toBe(401)
  })
})

describe('límite por IP', () => {
  it('el limitador corta al pasar el tope y reabre al cambiar de ventana', () => {
    const l = new LimitadorPeticiones(2, 1000)
    expect([l.permitir('a', 0), l.permitir('a', 1), l.permitir('a', 2)]).toEqual([true, true, false])
    expect(l.permitir('b', 2)).toBe(true)
    expect(l.permitir('a', 1000)).toBe(true)
  })

  it('el login responde 429 tras 20 intentos por minuto desde la misma IP', async () => {
    let ultimo = 0
    for (let i = 0; i < 21; i++) ultimo = (await e.app.inject({ method: 'POST', url: '/api/admin/login', payload: { usuario: 'nadie', clave: 'x' } })).statusCode
    expect(ultimo).toBe(429)
    e.reloj.ms += 61_000
    expect((await e.app.inject({ method: 'POST', url: '/api/admin/login', payload: { usuario: 'nadie', clave: 'x' } })).statusCode).toBe(401)
  }, 30_000)
})

describe('respaldo al cerrar sala', () => {
  it('cerrar la sala (a mano o programado) deja una copia en respaldos/', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-resp-'))
    const dbPath = join(dir, 'h.sqlite')
    const db = abrirDb(dbPath)
    const reloj = { ms: T0 }
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, dbPath, ahora: () => reloj.ms, intervaloCierresMs: 0 })
    try {
      const cookie = await loginCookie(app, 'paola', 'superclave123')
      const crear = async () => (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'R', plantilla: 'foodsume_2026', mesas: 1 } })).json()
      const s1 = await crear()
      await app.inject({ method: 'POST', url: `/api/admin/salas/${s1.id}/acciones`, headers: { cookie }, payload: { accion: 'cerrar_sala' } })
      expect(readdirSync(join(dir, 'respaldos')).filter((f) => f.includes(s1.id))).toHaveLength(1)

      const s2 = await crear()
      await app.inject({ method: 'PATCH', url: `/api/admin/salas/${s2.id}/config`, headers: { cookie }, payload: { cierre_programado_sala_at: new Date(T0 + 60_000).toISOString() } })
      reloj.ms = T0 + 60_000
      await app.inject({ url: '/api/admin/salas', headers: { cookie } })
      expect(readdirSync(join(dir, 'respaldos')).filter((f) => f.includes(s2.id))).toHaveLength(1)
    } finally {
      await app.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('con BD en memoria no intenta respaldar', async () => {
    const s = await crearSala(e, 1)
    expect((await accion(e, s.id, 'cerrar_sala')).statusCode).toBe(200)
    expect(existsSync(join(process.cwd(), 'respaldos'))).toBe(false)
  })
})

describe('caché del tablero', () => {
  it('reutiliza el cálculo mientras la versión no cambia y lo renueva con un voto', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const tok = (await inscribir(e, s.mesas[0].codigo, 'a@x.co')).json().token
    await accion(e, s.id, 'abrir_ronda_1')
    const url = `/api/tablero/${s.id}?t=${s.token_tablero}`
    const a = (await e.app.inject(url)).json()
    const b = (await e.app.inject(url)).json()
    expect(b).toEqual(a)
    await votar(e, tok, 'insumex', 1)
    const c = (await e.app.inject(url)).json()
    expect(c.version).not.toBe(a.version)
    expect(c.proyectos_vivos[0].rondas[0].n_votos).toBe(1)
  })
})

describe('respaldo antes y después de cada sala', () => {
  it('respalda al arrancar la sala, antes de reiniciar una ronda y al cerrarla', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hz-resp-'))
    const dbPath = join(dir, 'h.sqlite')
    const db = abrirDb(dbPath)
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, dbPath, ahora: () => T0, intervaloCierresMs: 0 })
    try {
      const cookie = await loginCookie(app, 'paola', 'superclave123')
      const s = (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'R', plantilla: 'foodsume_2026', mesas: 1 } })).json()
      const acc = (accion: string) => app.inject({ method: 'POST', url: `/api/admin/salas/${s.id}/acciones`, headers: { cookie }, payload: { accion } })
      const respaldos = () => readdirSync(join(dir, 'respaldos')).filter((f) => f.includes(s.id))
      await acc('abrir_inscripcion')
      expect(respaldos().filter((f) => f.includes('_inicio'))).toHaveLength(1)
      await acc('abrir_inscripcion') // clic repetido: 409, sin respaldo nuevo
      await acc('abrir_ronda_1')
      expect(respaldos()).toHaveLength(1) // abrir R1 desde inscripción no repite el respaldo de inicio
      await acc('reiniciar_ronda')
      await acc('reiniciar_ronda') // mismo milisegundo: no choca con el anterior
      expect(respaldos().filter((f) => f.includes('_antes_reinicio'))).toHaveLength(2)
      await acc('cerrar_sala')
      expect(respaldos().filter((f) => f.includes('_cierre'))).toHaveLength(1)
    } finally {
      await app.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('reinicio limpio de la sala del taller', () => {
  it('borra participantes, consentimientos, votos y eventos; conserva mesas, código y tablero', async () => {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    const otra = await crearSala(e, 1)
    await accion(e, otra.id, 'abrir_inscripcion')
    const tOtra = (await inscribir(e, otra.mesas[0].codigo, 'otra@x.co')).json().token
    for (let i = 0; i < 3; i++) {
      const t = (await inscribir(e, s.mesas[i % 2].codigo, `p${i}@x.co`)).json().token
      expect((await votar(e, t, 'insumex', 1)).statusCode).toBe(200)
    }
    const r = reiniciarSalaLimpia(e.db, s.id, e.reloj.ms)
    expect(r.borrados).toMatchObject({ votos: 3, participantes: 3, consentimientos: 3 })
    expect(r.sala).toMatchObject({ estado: 'preparada', ronda_actual: 0, codigo: s.codigo, revelar_hojas: 0, cierre_programado_ronda_at: null })
    const n = (sql: string, id: string) => uno<{ n: number }>(e.db, sql, id)!.n
    expect(n('SELECT COUNT(*) AS n FROM participantes WHERE sala_id = ?', s.id)).toBe(0)
    expect(n('SELECT COUNT(*) AS n FROM mesas WHERE sala_id = ?', s.id)).toBe(2)
    expect(n("SELECT COUNT(*) AS n FROM eventos WHERE sala_id = ? AND tipo = 'sala_reiniciada'", s.id)).toBe(1)
    // La otra sala no se toca y el enlace del tablero sigue sirviendo.
    expect((await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': tOtra } })).statusCode).toBe(200)
    expect((await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).statusCode).toBe(200)
    // Y la sala vuelve a arrancar desde cero.
    expect((await accion(e, s.id, 'abrir_inscripcion')).statusCode).toBe(200)
    expect((await inscribir(e, s.mesas[0].codigo, 'p0@x.co')).statusCode).toBe(201)
  })
})
