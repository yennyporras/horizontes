// E2E: reproduce la prueba sintética del golden (20 personas, 2 proyectos, 2 rondas) por API
// y recorre la sala completa: inscripción → R1 → precierre → cierre → R2 → cierre → sala cerrada.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CRITERIOS } from '../../shared/motor/motor'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

const golden = JSON.parse(readFileSync(resolve(__dirname, '../golden/motor_golden.json'), 'utf8'))
const ps = golden.prueba_sintetica as {
  votos: Record<string, number | string>[]
  esperado: Record<string, Record<string, { n: number; promedio_por_criterio: Record<string, number>; t2m: number; eje_x: number; eje_y: number }>>
}
const TOL = golden.tolerancia as number

let e: Entorno
let sala: Awaited<ReturnType<typeof crearSala>>
const tokens = new Map<number, string>()

beforeAll(async () => {
  e = await crearEntorno()
  sala = await crearSala(e, 4, 'E2E sintético')
})
afterAll(() => e.app.close())

async function tablero(query = '') {
  const r = await e.app.inject(`/api/tablero/${sala.id}?t=${sala.token_tablero}${query}`)
  expect(r.statusCode).toBe(200)
  return r.json()
}

async function votarRonda(ronda: number) {
  for (const v of ps.votos.filter((x) => x.ronda === ronda)) {
    const respuestas = Object.fromEntries(CRITERIOS.map((c) => [c, v[c]]))
    const r = await votar(e, tokens.get(v.respondiente_id as number)!, String(v.proyecto).toLowerCase(), ronda, respuestas)
    expect(r.statusCode, r.body).toBe(200)
  }
}

function compararConGolden(t: { proyectos_vivos: { nombre: string; rondas: { ronda: number; n_votos: number; promedios: Record<string, number>; t2m: number; eje_x: number; eje_y: number }[] }[] }, ronda: number) {
  for (const p of t.proyectos_vivos) {
    const esp = ps.esperado[p.nombre][String(ronda)]
    const r = p.rondas.find((x) => x.ronda === ronda)!
    expect(r.n_votos).toBe(esp.n)
    for (const c of CRITERIOS) expect(Math.abs(r.promedios[c] - esp.promedio_por_criterio[c])).toBeLessThan(TOL)
    expect(Math.abs(r.t2m - esp.t2m)).toBeLessThan(TOL)
    expect(Math.abs(r.eje_x - esp.eje_x)).toBeLessThan(TOL)
    expect(Math.abs(r.eje_y - esp.eje_y)).toBeLessThan(TOL)
  }
}

describe('e2e sintético por API', () => {
  it('inscribe 20 personas en 4 mesas', async () => {
    expect((await accion(e, sala.id, 'abrir_inscripcion')).statusCode).toBe(200)
    const ids = [...new Set(ps.votos.map((v) => v.respondiente_id as number))]
    expect(ids).toHaveLength(20)
    for (const id of ids) {
      const mesa = sala.mesas[(id - 1) % 4]
      const r = await inscribir(e, mesa.codigo, `persona${id}@prueba.co`, `Persona ${id}`)
      expect(r.statusCode).toBe(201)
      tokens.set(id, r.json().token)
    }
    const t = await tablero()
    expect(t.progreso.inscritos).toBe(20)
    expect(t.progreso.por_mesa.map((m: { inscritos: number }) => m.inscritos)).toEqual([5, 5, 5, 5])
  })

  it('ronda 1: votos, precierre de sala y resultado preliminar sin cerrar', async () => {
    expect((await accion(e, sala.id, 'abrir_ronda_1')).statusCode).toBe(200)
    await votarRonda(1)
    const t = await tablero()
    expect(t.progreso.completos).toBe(20)
    expect(t.progreso.precierre).toBe(true)
    expect(t.sala.estado).toBe('r1_abierta') // el precierre nunca cierra
    expect(t.preliminar).toBe(true)
    compararConGolden(t, 1)
    // El participante ve el resultado preliminar de su mesa aunque la vista sea "registrado".
    const r = await e.app.inject({ url: '/api/resultados', headers: { 'x-participante-token': tokens.get(1)! } })
    expect(r.statusCode).toBe(200)
    expect(r.json().preliminar).toBe(true)
    expect(r.json().alcance.tipo).toBe('mesa')
  })

  it('cierra R1, abre R2 (revela hojas) y reproduce el golden de R2', async () => {
    expect((await accion(e, sala.id, 'cerrar_ronda_1')).statusCode).toBe(200)
    const r2 = await accion(e, sala.id, 'abrir_ronda_2')
    expect(r2.json().sala.config.revelar_hojas).toBe(true)
    await votarRonda(2)
    expect((await accion(e, sala.id, 'cerrar_ronda_2')).statusCode).toBe(200)
    const t = await tablero()
    expect(t.sala.estado).toBe('r2_cerrada')
    expect(t.preliminar).toBe(false)
    compararConGolden(t, 1)
    compararConGolden(t, 2)
  })

  it('el participante ve la comparación R1→R2 con alcance sala', async () => {
    const cfg = await e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${sala.id}/config`, headers: { cookie: e.cookie }, payload: { alcance_resultados: 'sala' } })
    expect(cfg.statusCode).toBe(200)
    const r = await e.app.inject({ url: '/api/resultados?ronda=2', headers: { 'x-participante-token': tokens.get(7)! } })
    expect(r.statusCode).toBe(200)
    const t = r.json()
    expect(t.alcance.tipo).toBe('sala')
    expect(t.preliminar).toBe(false)
    compararConGolden(t, 1)
    compararConGolden(t, 2)
  })

  it('cierra la sala: no hay más votos ni inscripciones', async () => {
    expect((await accion(e, sala.id, 'cerrar_sala')).statusCode).toBe(200)
    const v = await votar(e, tokens.get(1)!, 'insumex', 2)
    expect(v.statusCode).toBe(409)
    const i = await inscribir(e, sala.mesas[0].codigo, 'tarde@prueba.co')
    expect(i.statusCode).toBe(409)
    expect(i.json().error.codigo).toBe('INSCRIPCION_CERRADA')
    const t = await tablero()
    expect(t.sala.estado).toBe('cerrada')
    compararConGolden(t, 2)
  })
})
