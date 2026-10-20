// QA por roles (20-oct): contrato nuevo del servidor. R1 oculta, convergencia, resultados.csv, tipo de sala, métricas,
// resumen del taller y modo demo. Ver docs/DECISIONES.md (entradas CONTRATO: del 20-oct) y docs/CONTRATO_API.md.
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb, migrar, uno } from '../../server/db/index'
import { MIGRACIONES } from '../../server/db/esquema'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { NOMBRE_SALA_DEMO, PERSONAS_DEMO } from '../../server/dominio/demo'
import { convergencia, dispersion } from '../../server/dominio/resultados'
import { SECTORES, TIPOS_SALA } from '../../server/dominio/salas'
import { SECTORES_SALA } from '../../web/shared/api/contrato'
import { PESOS_CANONICOS, agregar } from '../../shared/motor/motor'
import { type Entorno, RESPUESTAS_5, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

type Resp = typeof RESPUESTAS_5
const con = (cambios: Partial<Resp>): Resp => ({ ...RESPUESTAS_5, ...cambios })
const todo = (v: number): Resp => ({ alistamiento_tecnico: v, conocimiento_cliente: v, regulacion: v, capacidades_organizacionales: v, alineacion_core: v, inversion_requerida: v })

const pedir = (method: 'GET' | 'POST' | 'PATCH', url: string, payload?: object, cookie = e.cookie) => e.app.inject({ method, url, payload, headers: { cookie } })
const tablero = (s: { id: string; token_tablero: string }, q = '', cookie?: string) =>
  e.app.inject({ url: `/api/tablero/${s.id}?t=${s.token_tablero}${q}`, headers: cookie ? { cookie } : {} })
const ronda = (t: any, proyecto: string, r: number) => t.proyectos_vivos.find((p: any) => p.id === proyecto).rondas.find((x: any) => x.ronda === r)
const vivo = (t: any, proyecto: string) => t.proyectos_vivos.find((p: any) => p.id === proyecto)

async function persona(codigo: string, correo: string) {
  const r = await inscribir(e, codigo, correo)
  expect(r.statusCode).toBe(201)
  return r.json() as { token: string; participante: { id: string } }
}
async function votarAmbos(token: string, r: number, insumex: Resp = RESPUESTAS_5, nutriwhat: Resp = RESPUESTAS_5) {
  expect((await votar(e, token, 'insumex', r, insumex)).statusCode).toBe(200)
  expect((await votar(e, token, 'nutriwhat', r, nutriwhat)).statusCode).toBe(200)
}

describe('migración 8: tipo, empresa y sector de la sala', () => {
  it('las salas existentes quedan como taller, sin empresa ni sector, y se crea el índice de consentimientos', () => {
    const db = new DatabaseSync(':memory:')
    for (const m of MIGRACIONES.slice(0, 7)) db.exec(m)
    db.exec('PRAGMA user_version = 7')
    db.prepare(
      `INSERT INTO salas (id, codigo, nombre, plantilla, estado, token_tablero_hash, token_tablero, creada_at) VALUES ('s_x', 'HZXXX', 'X', 'foodsume_2026', 'preparada', '', 'tok', '2026-10-20T00:00:00.000Z')`,
    ).run()
    migrar(db)
    expect(db.prepare("SELECT tipo, empresa, sector FROM salas WHERE id = 's_x'").get()).toEqual({ tipo: 'taller', empresa: null, sector: null })
    expect(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'ix_consentimientos_participante'").get()).toBeTruthy()
    expect(() => db.prepare("UPDATE salas SET tipo = 'otro' WHERE id = 's_x'").run()).toThrow()
    expect(() => db.prepare("UPDATE salas SET sector = 'mineria' WHERE id = 's_x'").run()).toThrow()
    db.close()
  })

  it('crear con tipo, empresa y sector; sin ellos nace taller; van en la lista y en el detalle', async () => {
    const r = await pedir('POST', '/api/admin/salas', { nombre: 'Comité Nutresa', plantilla: 'foodsume_2026', mesas: 2, tipo: 'taller', empresa: '  Grupo   Nutresa ', sector: 'alimentos' })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ tipo: 'taller', empresa: 'Grupo Nutresa', sector: 'alimentos' })
    const sin = (await pedir('POST', '/api/admin/salas', { nombre: 'Sin datos', plantilla: 'foodsume_2026', mesas: 1 })).json()
    expect(sin).toMatchObject({ tipo: 'taller', empresa: null, sector: null })
    const lista = (await pedir('GET', '/api/admin/salas')).json().salas
    expect(lista.find((s: any) => s.id === r.json().id)).toMatchObject({ tipo: 'taller', empresa: 'Grupo Nutresa', sector: 'alimentos' })
    expect((await pedir('GET', `/api/admin/salas/${r.json().id}`)).json().sala).toMatchObject({ tipo: 'taller', empresa: 'Grupo Nutresa', sector: 'alimentos' })
  })

  it.each([
    [{ tipo: 'demo' }],
    [{ tipo: 1 }],
    [{ empresa: 'x'.repeat(81) }],
    [{ empresa: 42 }],
    [{ empresa: '<b>ACME</b>' }],
    [{ sector: 'mineria' }],
    [{ sector: 'Alimentos' }],
  ])('crear o configurar con %j → 422 DATOS_INVALIDOS', async (cuerpo) => {
    const r = await pedir('POST', '/api/admin/salas', { nombre: 'Mala', plantilla: 'foodsume_2026', mesas: 1, ...cuerpo })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('DATOS_INVALIDOS')
    const s = await crearSala(e, 1)
    const c = await pedir('PATCH', `/api/admin/salas/${s.id}/config`, cuerpo)
    expect(c.statusCode).toBe(422)
  })

  it('PATCH config cambia tipo, empresa y sector; empresa vacía y sector null los quitan; sube la versión', async () => {
    const s = await crearSala(e, 1)
    const v0 = (await pedir('GET', `/api/admin/salas/${s.id}`)).json().version
    expect((await pedir('PATCH', `/api/admin/salas/${s.id}/config`, { tipo: 'ensayo', empresa: 'ACME S.A.S.', sector: 'energia' })).statusCode).toBe(200)
    const d = (await pedir('GET', `/api/admin/salas/${s.id}`)).json()
    expect(d.sala).toMatchObject({ tipo: 'ensayo', empresa: 'ACME S.A.S.', sector: 'energia' })
    expect(d.version).not.toBe(v0)
    await pedir('PATCH', `/api/admin/salas/${s.id}/config`, { empresa: '', sector: null })
    expect((await pedir('GET', `/api/admin/salas/${s.id}`)).json().sala).toMatchObject({ tipo: 'ensayo', empresa: null, sector: null })
  })

  it('los sectores y tipos del servidor son los del contrato (web/shared/api/contrato.ts)', () => {
    expect([...SECTORES]).toEqual([...SECTORES_SALA])
    expect([...TIPOS_SALA]).toEqual(['taller', 'ensayo'])
  })

  it('el servidor de mocks sirve métricas, demostración y el tipo en la lista', async () => {
    const m = await construirApp({ mocks: true })
    try {
      expect((await m.inject('/api/admin/metricas')).json()).toMatchObject({ talleres: expect.any(Number), paises: expect.any(Array) })
      const d = await m.inject({ method: 'POST', url: '/api/admin/demo' })
      expect(d.statusCode).toBe(201)
      expect(d.json().sala).toMatchObject({ nombre: 'Demostración', tipo: 'ensayo' })
      expect((await m.inject('/api/admin/salas')).json().salas[0]).toMatchObject({ tipo: 'taller' })
    } finally {
      await m.close()
    }
  })

  it('duplicar crea un ensayo con la misma empresa y sector', async () => {
    const s = (await pedir('POST', '/api/admin/salas', { nombre: 'Original', plantilla: 'foodsume_2026', mesas: 1, empresa: 'ACME', sector: 'salud' })).json()
    const d = await pedir('POST', `/api/admin/salas/${s.id}/duplicar`, {})
    expect(d.statusCode).toBe(201)
    expect(d.json()).toMatchObject({ tipo: 'ensayo', empresa: 'ACME', sector: 'salud', nombre: 'Original (copia)' })
  })
})

describe('R1 oculta (decisión 1 de Paola)', () => {
  /** 2 mesas, alcance de la sala: 3 personas de la mesa 1 votaron los 2 proyectos y 1 de la mesa 2 no ha votado. */
  async function r1Abierta() {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    const mesa1 = []
    for (let i = 0; i < 3; i++) {
      const p = await persona(s.mesas[0].codigo, `m1-${i}@x.co`)
      await votarAmbos(p.token, 1, con({ regulacion: i === 0 ? 9 : 5 }))
      mesa1.push(p)
    }
    const tarde = await persona(s.mesas[1].codigo, 'm2@x.co')
    return { s, mesa1, tarde }
  }

  it('tablero público, /api/resultados y /api/yo: oculta con n_votos y todo lo demás en null', async () => {
    const { s, mesa1 } = await r1Abierta()
    const vistas = [
      (await tablero(s)).json(),
      (await e.app.inject({ url: '/api/resultados?ronda=1', headers: { 'x-participante-token': mesa1[0].token } })).json(),
      (await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': mesa1[1].token } })).json().resultados,
    ]
    for (const t of vistas) {
      for (const proyecto of ['insumex', 'nutriwhat']) {
        expect(ronda(t, proyecto, 1)).toEqual({ ronda: 1, n_votos: 3, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null, oculta: true })
        expect(vivo(t, proyecto)).not.toHaveProperty('convergencia')
      }
      expect(t).not.toHaveProperty('convergencia_alcance')
    }
  })

  it('la sesión admin solo ve el preliminar con vista=panel; la cookie sola (proyector en el navegador del facilitador) no basta', async () => {
    const { s } = await r1Abierta()
    const panel = await tablero(s, '&vista=panel', e.cookie)
    expect(ronda(panel.json(), 'insumex', 1)).toMatchObject({ n_votos: 3, promedios: { regulacion: 19 / 3 } })
    expect(ronda(panel.json(), 'insumex', 1)).not.toHaveProperty('oculta')
    expect(panel.json().version).toMatch(/-sala-panel$/)
    const proyector = (await tablero(s, '', e.cookie)).json()
    expect(ronda(proyector, 'insumex', 1).oculta).toBe(true)
    expect(proyector.version).toMatch(/-sala$/)
    // vista=panel sin sesión admin no destapa nada.
    expect(ronda((await tablero(s, '&vista=panel')).json(), 'insumex', 1).oculta).toBe(true)
  })

  it('con el alcance en precierre se muestra (la mesa completa ve su mesa; la sala, cuando todos votaron)', async () => {
    const { s, mesa1, tarde } = await r1Abierta()
    const mesa = (await tablero(s, `&alcance=mesa&mesa=${s.mesas[0].id}`)).json()
    expect(mesa.progreso.por_mesa[0].precierre).toBe(true)
    expect(ronda(mesa, 'insumex', 1).promedios.regulacion).toBeCloseTo(19 / 3, 9)
    // Con alcance de mesa en la sala, el celular de la mesa 1 ya ve su resultado.
    await pedir('PATCH', `/api/admin/salas/${s.id}/config`, { alcance_resultados: 'mesa' })
    const yo = (await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': mesa1[0].token } })).json().resultados
    expect(ronda(yo, 'insumex', 1)).not.toHaveProperty('oculta')
    await pedir('PATCH', `/api/admin/salas/${s.id}/config`, { alcance_resultados: 'sala' })
    expect(ronda((await tablero(s)).json(), 'insumex', 1).oculta).toBe(true)
    await votarAmbos(tarde.token, 1)
    const sala = (await tablero(s)).json()
    expect(sala.progreso.precierre).toBe(true)
    expect(ronda(sala, 'insumex', 1)).not.toHaveProperty('oculta')
    expect(ronda(sala, 'insumex', 1).promedios).not.toBeNull()
  })

  it('al cerrar la ronda 1 se muestra; la ronda 2 sigue en vivo para todos', async () => {
    const { s, mesa1 } = await r1Abierta()
    await accion(e, s.id, 'cerrar_ronda_1')
    expect(ronda((await tablero(s)).json(), 'insumex', 1)).toMatchObject({ n_votos: 3, promedios: { regulacion: 19 / 3 } })
    await accion(e, s.id, 'abrir_ronda_2')
    for (const p of mesa1) await votarAmbos(p.token, 2)
    const t = (await tablero(s)).json()
    expect(ronda(t, 'insumex', 1)).not.toHaveProperty('oculta')
    expect(ronda(t, 'insumex', 2)).toMatchObject({ n_votos: 3, promedios: RESPUESTAS_5 })
    expect(ronda(t, 'insumex', 2)).not.toHaveProperty('oculta')
  })
})

describe('convergencia R1 → R2', () => {
  it('dispersión, reducción, criterio de mayor cambio y movimiento por eje; promedio del alcance', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    const ps = [await persona(s.mesas[0].codigo, 'a@x.co'), await persona(s.mesas[0].codigo, 'b@x.co'), await persona(s.mesas[0].codigo, 'c@x.co')]
    // R1: INSUMEX muy disperso (1, 5 y 9 en todo); NUTRIWHAT unánime en 5.
    for (const [i, p] of ps.entries()) await votarAmbos(p.token, 1, todo([1, 5, 9][i]))
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    // R2: INSUMEX casi de acuerdo, con regulación arriba (7, 7, 9); NUTRIWHAT sigue unánime.
    for (const [i, p] of ps.entries()) await votarAmbos(p.token, 2, con({ regulacion: [7, 7, 9][i] }))
    // Con la ronda 2 abierta ya hay convergencia (las dos rondas tienen resultado visible).
    expect(vivo((await tablero(s)).json(), 'insumex').convergencia).toBeDefined()
    await accion(e, s.id, 'cerrar_ronda_2')
    const t = (await tablero(s)).json()

    const r1 = agregar([todo(1), todo(5), todo(9)], PESOS_CANONICOS)!
    const r2 = agregar([con({ regulacion: 7 }), con({ regulacion: 7 }), con({ regulacion: 9 })], PESOS_CANONICOS)!
    const d1 = Math.sqrt(32 / 3)
    const d2 = Math.sqrt(8 / 9) / 6
    expect(vivo(t, 'insumex').convergencia).toEqual({
      dispersion_r1: Math.round(d1 * 100) / 100,
      dispersion_r2: Math.round(d2 * 100) / 100,
      reduccion_pct: 95,
      criterio_mayor_cambio: 'regulacion',
      delta_x: Math.round((r2.eje_x - r1.eje_x) * 100) / 100,
      delta_y: 0,
    })
    expect(vivo(t, 'insumex').convergencia.delta_x).toBe(0.56)
    // Sin dispersión en R1 la reducción es 0 (no se divide por cero).
    expect(vivo(t, 'nutriwhat').convergencia).toMatchObject({ dispersion_r1: 0, dispersion_r2: 0, reduccion_pct: 0, delta_x: 0, delta_y: 0 })
    expect(t.convergencia_alcance).toEqual({ reduccion_pct: 48 })
    // Igual en el celular.
    const res = (await e.app.inject({ url: '/api/resultados?ronda=2', headers: { 'x-participante-token': ps[0].token } })).json()
    expect(vivo(res, 'insumex').convergencia.reduccion_pct).toBe(95)
    expect(res.convergencia_alcance).toEqual({ reduccion_pct: 48 })
  })

  it('sin convergencia si una de las rondas está bajo el mínimo', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    const ps = [await persona(s.mesas[0].codigo, 'a@x.co'), await persona(s.mesas[0].codigo, 'b@x.co'), await persona(s.mesas[0].codigo, 'c@x.co')]
    for (const p of ps) await votarAmbos(p.token, 1)
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    for (const p of ps.slice(0, 2)) await votarAmbos(p.token, 2)
    await accion(e, s.id, 'cerrar_ronda_2')
    const t = (await tablero(s)).json()
    expect(ronda(t, 'insumex', 2).bajo_minimo).toBe(true)
    expect(vivo(t, 'insumex')).not.toHaveProperty('convergencia')
    expect(t).not.toHaveProperty('convergencia_alcance')
  })

  it('funciones puras: dispersión poblacional desde la distribución, reducción negativa y empate del mayor cambio', () => {
    const a = agregar([todo(1), todo(9)])!
    expect(dispersion(a.distribucion)).toBe(4)
    const unanime = agregar([todo(5), todo(5)])!
    const c = convergencia({ ronda: 1, ...unanime, total: unanime.total }, { ronda: 2, ...a, total: a.total })!
    expect(c.reduccion_pct).toBe(0)
    const c2 = convergencia({ ronda: 1, ...agregar([todo(3), todo(7)])!, total: 0 }, { ronda: 2, ...a, total: 0 })!
    expect(c2.reduccion_pct).toBe(-100)
    // Todos los criterios cambian lo mismo (0): gana el primero.
    expect(c2.criterio_mayor_cambio).toBe('alistamiento_tecnico')
    expect(convergencia({ ronda: 1, n_votos: 2, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null, bajo_minimo: true }, { ronda: 2, ...a, total: 0 })).toBeNull()
  })
})

describe('resultados.csv', () => {
  it('sin datos personales: por alcance, ronda y proyecto, solo con 3 votos o más, con coma decimal', async () => {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    for (let i = 0; i < 3; i++) await votarAmbos((await persona(s.mesas[0].codigo, `uno${i}@x.co`)).token, 1, con({ alineacion_core: i === 0 ? 1 : 5 }))
    for (let i = 0; i < 2; i++) await votarAmbos((await persona(s.mesas[1].codigo, `dos${i}@x.co`)).token, 1)
    await accion(e, s.id, 'cerrar_ronda_1')
    const r = await pedir('GET', `/api/admin/salas/${s.id}/export/resultados.csv`)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('text/csv')
    expect(r.headers['content-disposition']).toContain('resultados.csv')
    expect(r.body.startsWith('﻿')).toBe(true)
    const lineas = r.body.slice(1).trim().split('\r\n').map((l) => l.split(';'))
    expect(lineas[0]).toEqual([
      'alcance', 'ronda', 'proyecto', 'n_votos',
      'alistamiento_tecnico', 'conocimiento_cliente', 'regulacion', 'capacidades_organizacionales', 'alineacion_core', 'inversion_requerida',
      't2m', 'eje_x', 'eje_y',
    ])
    expect(lineas.slice(1).map((l) => l.slice(0, 4))).toEqual([
      ['sala', '1', 'INSUMEX', '5'],
      ['sala', '1', 'NUTRIWHAT', '5'],
      ['Mesa 1', '1', 'INSUMEX', '3'],
      ['Mesa 1', '1', 'NUTRIWHAT', '3'],
    ])
    // Mesa 1: alineación (1 + 5 + 5) / 3 = 3,67; eje Y = 3,67·0,7 + 5·0,3 = 4,07.
    expect(lineas[3][8]).toBe('3,67')
    expect(lineas[3][12]).toBe('4,07')
    expect(lineas[1][4]).toBe('5,00')
    for (const dato of ['uno0@x.co', 'Persona Prueba', 'Mesa 2', '127.0.0.1']) expect(r.body).not.toContain(dato)
  })

  it('un archivo que no existe responde 404 y nombra los tres', async () => {
    const s = await crearSala(e, 1)
    const r = await pedir('GET', `/api/admin/salas/${s.id}/export/otro.csv`)
    expect(r.statusCode).toBe(404)
    expect(r.json().error.mensaje).toContain('resultados.csv')
    expect((await e.app.inject(`/api/admin/salas/${s.id}/export/resultados.csv`)).statusCode).toBe(401)
  })
})

describe('métricas del negocio y resumen del taller', () => {
  it('GET /api/admin/metricas cuenta solo talleres con gente; los ensayos no cuentan', async () => {
    expect((await pedir('GET', '/api/admin/metricas')).json()).toEqual({ talleres: 0, personas: 0, completaron_r2: 0, paises: [] })
    const co = await crearSala(e, 1)
    await accion(e, co.id, 'abrir_inscripcion')
    const a = await persona(co.mesas[0].codigo, 'a@x.co')
    await persona(co.mesas[0].codigo, 'b@x.co')
    await accion(e, co.id, 'abrir_ronda_1')
    await votarAmbos(a.token, 1)
    await accion(e, co.id, 'cerrar_ronda_1')
    await accion(e, co.id, 'abrir_ronda_2')
    await votarAmbos(a.token, 2)
    const pe = await crearSala(e, 1, 'Lima', { pais: 'PE' })
    await accion(e, pe.id, 'abrir_inscripcion')
    await persona(pe.mesas[0].codigo, 'c@x.co')
    await crearSala(e, 1, 'Vacía')
    const ensayo = (await pedir('POST', `/api/admin/salas/${co.id}/duplicar`, {})).json()
    await accion(e, ensayo.id, 'abrir_inscripcion')
    await persona(ensayo.mesas[0].codigo, 'd@x.co')
    expect((await pedir('GET', '/api/admin/metricas')).json()).toEqual({ talleres: 2, personas: 3, completaron_r2: 1, paises: ['CO', 'PE'] })
    expect((await e.app.inject('/api/admin/metricas')).statusCode).toBe(401)
  })

  it('resumen en el detalle: minutos de cada ronda desde la bitácora, completitud y accesos de nuevo', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const ps = [await persona(s.mesas[0].codigo, 'a@x.co'), await persona(s.mesas[0].codigo, 'b@x.co'), await persona(s.mesas[0].codigo, 'c@x.co')]
    const resumen = async () => (await pedir('GET', `/api/admin/salas/${s.id}`)).json().resumen
    expect(await resumen()).toEqual({ minutos_r1: null, minutos_r2: null, inscritos: 3, completaron_r1: 0, completaron_r2: 0, accesos_nuevos: 0 })
    await accion(e, s.id, 'abrir_ronda_1')
    for (const p of ps) await votarAmbos(p.token, 1)
    e.reloj.ms += 12 * 60_000
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    await votarAmbos(ps[0].token, 2)
    for (const p of ps.slice(0, 2)) expect((await pedir('POST', `/api/admin/participantes/${p.participante.id}/acceso`, {})).statusCode).toBe(200)
    expect(await resumen()).toEqual({ minutos_r1: 12, minutos_r2: null, inscritos: 3, completaron_r1: 3, completaron_r2: 1, accesos_nuevos: 2 })
    e.reloj.ms += 7.5 * 60_000
    // Cerrar la sala con la ronda 2 abierta cuenta como el cierre de la ronda 2.
    await accion(e, s.id, 'cerrar_sala')
    expect((await resumen()).minutos_r2).toBe(7.5)
  })
})

describe('modo demo', () => {
  const RAPIDO = { inscripcionMs: 60, rondaMs: 250, pausaMs: 30 }

  async function appDemo() {
    const db = abrirDb(':memory:')
    asegurarSuperadmin(db, 'paola', 'superclave123', Date.now())
    const app = await construirApp({ db, intervaloCierresMs: 0, baseUrl: 'https://horizontes.test', demo: RAPIDO })
    const cookie = await loginCookie(app, 'paola', 'superclave123')
    return { db, app, cookie }
  }
  const esperar = async (cond: () => boolean, ms = 8000) => {
    const fin = Date.now() + ms
    while (!cond()) {
      if (Date.now() > fin) throw new Error('la condición no se cumplió a tiempo')
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  it('crea la sala «Demostración» (ensayo, 4 mesas, Colombia) y la juega sola hasta cerrar la ronda 2', async () => {
    const { db, app, cookie } = await appDemo()
    try {
      const r = await app.inject({ method: 'POST', url: '/api/admin/demo', headers: { cookie } })
      expect(r.statusCode).toBe(201)
      const sala = r.json().sala
      expect(sala).toMatchObject({ nombre: NOMBRE_SALA_DEMO, tipo: 'ensayo', config: { pais: 'CO' } })
      // Una sola a la vez.
      const otra = await app.inject({ method: 'POST', url: '/api/admin/demo', headers: { cookie } })
      expect(otra.statusCode).toBe(409)
      expect(otra.json().error.codigo).toBe('DEMO_EN_CURSO')
      const estado = () => (uno<{ estado: string }>(db, 'SELECT estado FROM salas WHERE id = ?', sala.id)!).estado
      await esperar(() => estado() === 'r2_cerrada')
      expect(uno(db, 'SELECT COUNT(*) AS n FROM mesas WHERE sala_id = ?', sala.id)).toEqual({ n: 4 })
      expect(uno(db, "SELECT COUNT(*) AS n FROM participantes WHERE sala_id = ? AND correo LIKE '%@example.com'", sala.id)).toEqual({ n: PERSONAS_DEMO })
      for (const r of [1, 2]) expect(uno(db, 'SELECT COUNT(*) AS n FROM votos WHERE sala_id = ? AND ronda = ?', sala.id, r)).toEqual({ n: PERSONAS_DEMO * 2 })
      const t = (await app.inject({ url: `/api/tablero/${sala.id}?t=${sala.token_tablero}` })).json()
      expect(ronda(t, 'insumex', 2).n_votos).toBe(PERSONAS_DEMO)
      expect(vivo(t, 'insumex').convergencia).toBeDefined()
      // La demostración no cuenta en las métricas.
      expect((await app.inject({ url: '/api/admin/metricas', headers: { cookie } })).json().talleres).toBe(0)
      // Terminada, se puede lanzar otra.
      expect((await app.inject({ method: 'POST', url: '/api/admin/demo', headers: { cookie } })).statusCode).toBe(201)
    } finally {
      await app.close()
    }
  })

  it('al cerrar la app los temporizadores se limpian y la sala queda donde iba', async () => {
    const { db, app, cookie } = await appDemo()
    const sala = (await app.inject({ method: 'POST', url: '/api/admin/demo', headers: { cookie } })).json().sala
    await esperar(() => (uno<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM participantes WHERE sala_id = ?', sala.id)!).n > 0)
    await app.close()
    const antes = uno(db, 'SELECT estado, version FROM salas WHERE id = ?', sala.id)
    await new Promise((r) => setTimeout(r, 700))
    expect(uno(db, 'SELECT estado, version FROM salas WHERE id = ?', sala.id)).toEqual(antes)
  })

  it('si alguien cierra la sala a mano, la demostración se detiene sin errores', async () => {
    const { db, app, cookie } = await appDemo()
    try {
      const sala = (await app.inject({ method: 'POST', url: '/api/admin/demo', headers: { cookie } })).json().sala
      await esperar(() => (uno<{ estado: string }>(db, 'SELECT estado FROM salas WHERE id = ?', sala.id)!).estado === 'r1_abierta')
      expect((await app.inject({ method: 'POST', url: `/api/admin/salas/${sala.id}/acciones`, headers: { cookie }, payload: { accion: 'cerrar_sala' } })).statusCode).toBe(200)
      await new Promise((r) => setTimeout(r, 400))
      expect(uno(db, 'SELECT estado FROM salas WHERE id = ?', sala.id)).toEqual({ estado: 'cerrada' })
      expect((await app.inject({ method: 'POST', url: '/api/admin/demo', headers: { cookie } })).statusCode).toBe(201)
    } finally {
      await app.close()
    }
  })

  it('solo la cuenta superadministradora; sin sesión, 401', async () => {
    const c = await pedir('POST', '/api/admin/admins', { usuario: 'nicolai', nombre: 'Nicolai', clave_temporal: 'temporal123' })
    expect(c.statusCode).toBe(201)
    const cookie = await loginCookie(e.app, 'nicolai', 'temporal123')
    expect((await pedir('POST', '/api/admin/cambiar-clave', { actual: 'temporal123', nueva: 'definitiva456' }, cookie)).statusCode).toBe(200)
    const r = await pedir('POST', '/api/admin/demo', undefined, cookie)
    expect(r.statusCode).toBe(403)
    expect(r.json().error).toEqual({ codigo: 'SOLO_SUPERADMIN', mensaje: 'Solo la cuenta superadministradora puede iniciar la demostración.' })
    expect((await e.app.inject({ method: 'POST', url: '/api/admin/demo' })).statusCode).toBe(401)
  })
})
