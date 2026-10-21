// Decisión de Paola (21-oct): cuando toda la sala votó la ronda 1 (precierre de la sala), el servidor cierra la ronda 1
// y abre la ronda 2 solo, con los eventos ronda_cerrada y ronda_abierta por «sistema» y luego ronda_2_automatica. Solo
// ocurre al ENTRAR en precierre con la ronda 1 abierta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MENSAJE_RONDA_2_SOLA } from '../../server/dominio/participantes'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(() => e.app.close())

interface Evento {
  tipo: string
  por: string
  detalle: Record<string, unknown> | null
}
const detalle = async (id: string) => (await e.app.inject({ url: `/api/admin/salas/${id}`, headers: { cookie: e.cookie } })).json()
const eventos = async (id: string) => (await detalle(id)).eventos as Evento[]
const editar = (id: string, payload: object) => e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${id}`, headers: { cookie: e.cookie }, payload })
const votarAmbos = async (token: string, ronda: number) => {
  for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, token, p, ronda)).statusCode).toBe(200)
}
const automaticas = (evs: Evento[]) => evs.filter((ev) => ev.tipo === 'ronda_2_automatica').length

/** Sala de 2 mesas con la ronda 1 abierta y 3 inscritos (2 en la mesa 1, 1 en la mesa 2). */
async function salaR1() {
  const s = await crearSala(e, 2)
  await accion(e, s.id, 'abrir_inscripcion')
  const ps = []
  for (const [i, correo] of ['a@x.co', 'b@x.co', 'c@x.co'].entries()) {
    const r = (await inscribir(e, s.mesas[i < 2 ? 0 : 1].codigo, correo)).json()
    ps.push(r as { token: string; participante: { id: string } })
  }
  expect((await accion(e, s.id, 'abrir_ronda_1')).statusCode).toBe(200)
  return { s, ps }
}

describe('la ronda 2 se abre sola cuando todos votaron la ronda 1', () => {
  it('el último voto deja la sala en r2_abierta con los eventos por sistema, revela las hojas y cambia la versión', async () => {
    const { s, ps } = await salaR1()
    await votarAmbos(ps[0].token, 1)
    await votarAmbos(ps[1].token, 1)
    await votar(e, ps[2].token, 'insumex', 1)
    const antes = await detalle(s.id)
    expect(antes.sala.estado).toBe('r1_abierta')
    expect(automaticas(antes.eventos)).toBe(0)

    const r = await votar(e, ps[2].token, 'nutriwhat', 1)
    expect(r.statusCode).toBe(200)
    // La respuesta del voto describe la ronda votada.
    expect(r.json()).toMatchObject({ completo_ronda: true, progreso_mesa: { inscritos: 1, completos: 1, precierre: true } })

    const d = await detalle(s.id)
    expect(d.sala).toMatchObject({ estado: 'r2_abierta', ronda_actual: 2 })
    expect(d.sala.config.revelar_hojas).toBe(true)
    expect(d.version).not.toBe(antes.version)
    const [auto, abierta, cerrada, precierre] = d.eventos as Evento[]
    expect(auto).toMatchObject({ tipo: 'ronda_2_automatica', por: 'sistema', detalle: { ronda: 2, mensaje: 'Todos votaron la ronda 1: la ronda 2 se abrió sola.' } })
    expect(abierta).toMatchObject({ tipo: 'ronda_abierta', por: 'sistema', detalle: { accion: 'abrir_ronda_2', desde: 'r1_cerrada', hacia: 'r2_abierta', ronda: 2 } })
    expect(cerrada).toMatchObject({ tipo: 'ronda_cerrada', por: 'sistema', detalle: { accion: 'cerrar_ronda_1', desde: 'r1_abierta', hacia: 'r1_cerrada', ronda: 1 } })
    expect(precierre).toMatchObject({ tipo: 'precierre', por: 'sistema', detalle: { alcance: 'sala', ronda: 1 } })
    expect(MENSAJE_RONDA_2_SOLA).toBe('Todos votaron la ronda 1: la ronda 2 se abrió sola.')

    // El celular lo ve en el siguiente polling (ETag nueva): la R2 abierta, las 12 hojas y sus votos de la R1 guardados.
    const y = (await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': ps[0].token } })).json()
    expect(y.sala).toMatchObject({ estado: 'r2_abierta', ronda_actual: 2 })
    expect(y.contenido.hojas).toHaveLength(12)
    expect(y.mis_votos_anteriores).toHaveLength(2)
    // La R1 quedó cerrada: no admite más votos; la R2 sí.
    expect((await votar(e, ps[0].token, 'insumex', 1)).json().error.codigo).toBe('RONDA_CERRADA')
    expect((await votar(e, ps[0].token, 'insumex', 2)).statusCode).toBe(200)
  })

  it('consume el cierre programado de la ronda 1, que ya no cierra la ronda 2 a esa hora', async () => {
    const { s, ps } = await salaR1()
    const hora = T0 + 30 * 60_000
    const cfg = await e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie: e.cookie }, payload: { cierre_programado_ronda_at: new Date(hora).toISOString() } })
    expect(cfg.statusCode).toBe(200)
    for (const p of ps) await votarAmbos(p.token, 1)
    let d = await detalle(s.id)
    expect(d.sala.estado).toBe('r2_abierta')
    expect(d.sala.config.cierre_programado_ronda_at).toBeNull()
    e.reloj.ms = hora + 1000
    d = await detalle(s.id)
    expect(d.sala.estado).toBe('r2_abierta')
    e.reloj.ms = T0
  })

  it('en la ronda 2 el precierre de la sala no cierra nada', async () => {
    const { s, ps } = await salaR1()
    for (const p of ps) await votarAmbos(p.token, 1)
    for (const p of ps) await votarAmbos(p.token, 2)
    const d = await detalle(s.id)
    expect(d.progreso.precierre).toBe(true)
    expect(d.sala.estado).toBe('r2_abierta')
    expect(automaticas(d.eventos)).toBe(1)
  })

  it('el precierre de una sola mesa no abre la ronda 2', async () => {
    const { s, ps } = await salaR1()
    await votarAmbos(ps[0].token, 1)
    await votarAmbos(ps[1].token, 1)
    const d = await detalle(s.id)
    expect(d.mesas[0].precierre).toBe(true)
    expect(d.sala.estado).toBe('r1_abierta')
    expect(automaticas(d.eventos)).toBe(0)
  })

  it('si el facilitador abre la ronda 2 a mano antes, no pasa nada raro cuando los demás completan', async () => {
    const { s, ps } = await salaR1()
    await votarAmbos(ps[0].token, 1)
    await votarAmbos(ps[1].token, 1)
    expect((await accion(e, s.id, 'cerrar_ronda_1')).statusCode).toBe(200)
    expect((await accion(e, s.id, 'abrir_ronda_2')).statusCode).toBe(200)
    // Quien no votó ya no puede votar la R1.
    expect((await votar(e, ps[2].token, 'insumex', 1)).statusCode).toBe(409)
    for (const p of ps) await votarAmbos(p.token, 2)
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('r2_abierta')
    expect(automaticas(d.eventos)).toBe(0)
    const porSistema = (d.eventos as Evento[]).filter((ev) => (ev.tipo === 'ronda_abierta' || ev.tipo === 'ronda_cerrada') && ev.por === 'sistema')
    expect(porSistema).toEqual([])
    // Cerrar la R2 a mano sigue igual.
    expect((await accion(e, s.id, 'cerrar_ronda_2')).statusCode).toBe(200)
  })

  it('volver a la ronda anterior deja la R1 abierta; editar un voto no vuelve a abrir la R2 hasta que el precierre se pierda y se recupere', async () => {
    const { s, ps } = await salaR1()
    for (const p of ps) await votarAmbos(p.token, 1)
    expect((await detalle(s.id)).sala.estado).toBe('r2_abierta')
    expect((await accion(e, s.id, 'volver_ronda_anterior')).statusCode).toBe(200)
    let d = await detalle(s.id)
    expect(d.sala.estado).toBe('r1_abierta')
    expect(d.progreso.precierre).toBe(true)

    // Editar un voto de la R1 con todos completos no repite el paso.
    expect((await votar(e, ps[0].token, 'insumex', 1, { alistamiento_tecnico: 9, conocimiento_cliente: 9, regulacion: 9, capacidades_organizacionales: 9, alineacion_core: 9, inversion_requerida: 9 })).statusCode).toBe(200)
    d = await detalle(s.id)
    expect(d.sala.estado).toBe('r1_abierta')
    expect(automaticas(d.eventos)).toBe(1)

    // Alguien llega tarde (se pierde el precierre) y al votar lo recupera: la R2 se abre sola otra vez.
    const tarde = (await inscribir(e, s.mesas[1].codigo, 'tarde@x.co')).json()
    expect((await detalle(s.id)).progreso.precierre).toBe(false)
    await votarAmbos(tarde.token, 1)
    d = await detalle(s.id)
    expect(d.sala.estado).toBe('r2_abierta')
    expect(automaticas(d.eventos)).toBe(2)
  })

  it('desactivar a la única persona que faltaba también abre la ronda 2', async () => {
    const { s, ps } = await salaR1()
    await votarAmbos(ps[0].token, 1)
    await votarAmbos(ps[1].token, 1)
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
    expect((await editar(ps[2].participante.id, { activo: false })).statusCode).toBe(200)
    const d = await detalle(s.id)
    expect(d.sala.estado).toBe('r2_abierta')
    expect(d.eventos[0]).toMatchObject({ tipo: 'ronda_2_automatica', por: 'sistema' })
    expect(d.resumen).toMatchObject({ completaron_r1: 2 })
  })

  it('cambiar de mesa a alguien no completa la sala por sí solo: con alguien sin votar sigue la R1', async () => {
    const { s, ps } = await salaR1()
    await votarAmbos(ps[0].token, 1)
    await votarAmbos(ps[1].token, 1)
    expect((await editar(ps[2].participante.id, { mesa_id: s.mesas[0].id })).statusCode).toBe(200)
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
  })
})
