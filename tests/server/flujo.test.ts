// Precierre (§4) y cierres programados (§5) con reloj simulado.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { type Entorno, T0, VISTA_MESA_REGISTRADO, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(() => e.app.close())

const iso = (ms: number) => new Date(ms).toISOString()

async function detalle(salaId: string) {
  return (await e.app.inject({ url: `/api/admin/salas/${salaId}`, headers: { cookie: e.cookie } })).json()
}

describe('precierre', () => {
  it('aparece solo cuando todos los inscritos activos completan, se recalcula y nunca cierra', async () => {
    const s = await crearSala(e, 2, 'Sala de prueba', VISTA_MESA_REGISTRADO)
    await accion(e, s.id, 'abrir_inscripcion')
    const a = (await inscribir(e, s.mesas[0].codigo, 'a@x.co')).json().token
    const b = (await inscribir(e, s.mesas[0].codigo, 'b@x.co')).json().token
    await accion(e, s.id, 'abrir_ronda_1')

    await votar(e, a, 'insumex', 1)
    await votar(e, a, 'nutriwhat', 1)
    await votar(e, b, 'insumex', 1)
    let d = await detalle(s.id)
    expect(d.mesas[0].precierre).toBe(false)

    const r = await votar(e, b, 'nutriwhat', 1)
    expect(r.json().progreso_mesa).toEqual({ inscritos: 2, completos: 2, precierre: true })
    d = await detalle(s.id)
    expect(d.mesas[0].precierre).toBe(true)
    expect(d.mesas[1].precierre).toBe(false) // mesa sin inscritos no está en precierre
    expect(d.progreso.precierre).toBe(true) // todas las mesas con inscritos están en precierre
    expect(d.sala.estado).toBe('r1_abierta')
    expect(d.eventos.some((ev: { tipo: string; detalle: { mensaje?: string } }) => ev.tipo === 'precierre' && ev.detalle.mensaje?.includes('Mesa 1'))).toBe(true)

    // Alguien se inscribe tarde: el precierre desaparece.
    await inscribir(e, s.mesas[0].codigo, 'c@x.co')
    d = await detalle(s.id)
    expect(d.mesas[0].precierre).toBe(false)
    const yo = await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': a } })
    expect(yo.json().resultados).toBeNull()
  })

  it('un participante desactivado no bloquea el precierre', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const a = (await inscribir(e, s.mesas[0].codigo, 'a@x.co')).json().token
    const b = (await inscribir(e, s.mesas[0].codigo, 'b@x.co')).json()
    await accion(e, s.id, 'abrir_ronda_1')
    await votar(e, a, 'insumex', 1)
    await votar(e, a, 'nutriwhat', 1)
    expect((await detalle(s.id)).mesas[0].precierre).toBe(false)
    await e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${b.participante.id}`, headers: { cookie: e.cookie }, payload: { activo: false } })
    expect((await detalle(s.id)).mesas[0].precierre).toBe(true)
  })
})

describe('cierres programados (reloj simulado)', () => {
  it('cierra la ronda a la hora exacta con chequeo perezoso y deja evento por "programado"', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    const hora = T0 + 30 * 60_000
    const cfg = await e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie: e.cookie }, payload: { cierre_programado_ronda_at: iso(hora) } })
    expect(cfg.json().cierre_programado_ronda_at).toBe('2026-10-20T14:30:00-05:00')

    e.reloj.ms = hora - 1000
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
    e.reloj.ms = hora
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('r1_cerrada')
    expect(d.sala.config.cierre_programado_ronda_at).toBeNull()
    expect(d.eventos.some((ev: { tipo: string; por: string }) => ev.tipo === 'cierre_programado' && ev.por === 'programado')).toBe(true)

    // R2 abierta después no se cierra por el programado ya consumido.
    await accion(e, s.id, 'abrir_ronda_2')
    e.reloj.ms = hora + 3600_000
    expect((await detalle(s.id)).sala.estado).toBe('r2_abierta')
  })

  it('cierra la sala a la hora programada', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    await e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie: e.cookie }, payload: { cierre_programado_sala_at: iso(T0 + 3600_000) } })
    e.reloj.ms = T0 + 3600_000 + 1
    const i = await inscribir(e, s.mesas[0].codigo, 'x@x.co')
    expect(i.statusCode).toBe(409)
    expect((await detalle(s.id)).sala.estado).toBe('cerrada')
  })

  it('un programado vencido sin ronda abierta se descarta', async () => {
    const s = await crearSala(e, 1)
    await e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie: e.cookie }, payload: { cierre_programado_ronda_at: iso(T0 + 60_000) } })
    e.reloj.ms = T0 + 120_000
    const d = await detalle(s.id)
    expect(d.sala.config.cierre_programado_ronda_at).toBeNull()
    await accion(e, s.id, 'abrir_ronda_1')
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
  })

  it('el intervalo aplica el cierre sin peticiones', async () => {
    const db = abrirDb(':memory:')
    const reloj = { ms: T0 }
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, ahora: () => reloj.ms, intervaloCierresMs: 20 })
    const cookie = await loginCookie(app, 'paola', 'superclave123')
    const s = (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre: 'X', plantilla: 'foodsume_2026', mesas: 1 } })).json()
    await app.inject({ method: 'POST', url: `/api/admin/salas/${s.id}/acciones`, headers: { cookie }, payload: { accion: 'abrir_ronda_1' } })
    await app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie }, payload: { cierre_programado_ronda_at: iso(T0 + 1000) } })
    reloj.ms = T0 + 1000
    await new Promise((r) => setTimeout(r, 120))
    const estado = (db.prepare('SELECT estado FROM salas WHERE id = ?').get(s.id) as { estado: string }).estado
    expect(estado).toBe('r1_cerrada')
    await app.close()
  })
})
