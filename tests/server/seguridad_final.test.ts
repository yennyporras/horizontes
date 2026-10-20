// Hallazgos M-1, M-3 y B-2 de la auditoría de seguridad (20-oct). Cada prueba reproduce el caso del informe.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

describe('M-1a: HEAD no evita el límite de peticiones', () => {
  it('HEAD /api/mesas/:codigo con códigos inventados termina en 429, igual que GET', async () => {
    let ultimo = 0
    for (let i = 0; i < 601; i++) ultimo = (await e.app.inject({ method: 'HEAD', url: `/api/mesas/HZAAA${i}-1` })).statusCode
    expect(ultimo).toBe(429)
    // HEAD y GET comparten el cupo: el GET siguiente desde la misma IP tampoco pasa.
    const r = await e.app.inject('/api/mesas/HZBBB-1')
    expect([r.statusCode, r.json().error.codigo]).toEqual([429, 'DEMASIADAS_PETICIONES'])
  }, 30_000)
})

describe('M-1b: el tablero no deja enumerar salas', () => {
  const cuerpo401 = { error: { codigo: 'TOKEN_TABLERO_INVALIDO', mensaje: 'El enlace del tablero no es válido. Pide el enlace actualizado al facilitador.' } }

  it('sin sesión ni token válido responde el mismo 401 exista o no la sala (por id o por código)', async () => {
    const s = await crearSala(e, 1)
    for (const url of [
      `/api/tablero/${s.id}`,
      `/api/tablero/${s.id}?t=malo`,
      `/api/tablero/${s.codigo}`,
      '/api/tablero/s_noexiste',
      '/api/tablero/s_noexiste?t=malo',
      `/api/tablero/s_noexiste?t=${s.token_tablero}`,
      '/api/tablero/HZZZZ',
    ]) {
      const r = await e.app.inject(url)
      expect([url, r.statusCode, r.json()]).toEqual([url, 401, cuerpo401])
    }
  })

  it('con token válido responde 200; con sesión admin y sala inexistente, 404', async () => {
    const s = await crearSala(e, 1)
    expect((await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).statusCode).toBe(200)
    expect((await e.app.inject({ url: `/api/tablero/${s.id}`, headers: { cookie: e.cookie } })).statusCode).toBe(200)
    const r = await e.app.inject({ url: '/api/tablero/s_noexiste', headers: { cookie: e.cookie } })
    expect([r.statusCode, r.json().error.codigo]).toEqual([404, 'SALA_NO_EXISTE'])
  })
})

describe('M-3: los topes por IP no dejan al salón sin entrar ni votar', () => {
  const login = (usuario: string, clave: string) => e.app.inject({ method: 'POST', url: '/api/admin/login', payload: { usuario, clave } })

  it('2100 PUT /api/votos sin token desde la misma IP no impiden que un participante válido vote', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    const token = (await inscribir(e, s.mesas[0].codigo, 'votante@estratek.com.co')).json().token
    const sinToken = { method: 'PUT' as const, url: '/api/votos', payload: { proyecto_id: 'insumex', ronda: 1, respuestas: {} } }
    let ultimo = 0
    for (let i = 0; i < 2100; i++) ultimo = (await e.app.inject(sinToken)).statusCode
    expect(ultimo).toBe(401)
    expect((await votar(e, token, 'insumex', 1)).statusCode).toBe(200)
  }, 60_000)

  it('muchos códigos de mesa inválidos dan 429, pero un código válido desde la misma IP sigue respondiendo 200', async () => {
    const s = await crearSala(e, 1)
    let ultimo = 0
    for (let i = 0; i < 601; i++) ultimo = (await e.app.inject(`/api/mesas/HZAAA${i}-1`)).statusCode
    expect(ultimo).toBe(429)
    expect((await e.app.inject(`/api/mesas/${s.mesas[0].codigo}`)).statusCode).toBe(200)
    expect((await e.app.inject({ method: 'HEAD', url: `/api/mesas/${s.mesas[0].codigo}` })).statusCode).toBe(200)
    // Las consultas válidas no gastan el cupo: 700 seguidas responden todas.
    e.reloj.ms += 61_000
    for (let i = 0; i < 700; i++) expect((await e.app.inject(`/api/mesas/${s.mesas[0].codigo}`)).statusCode).toBe(200)
    expect((await e.app.inject('/api/mesas/HZAAA-1')).statusCode).toBe(404)
  }, 60_000)

  it('muchos enlaces de acceso inválidos dan 429, pero uno válido desde la misma IP sigue sirviendo', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const p = (await inscribir(e, s.mesas[0].codigo, 'acceso@estratek.com.co')).json()
    const enlace = (await e.app.inject({ method: 'POST', url: `/api/admin/participantes/${p.participante.id}/acceso`, headers: { cookie: e.cookie } })).json().url
    const acceso = new URL(enlace).searchParams.get('acceso')
    let ultimo = 0
    for (let i = 0; i < 61; i++) ultimo = (await e.app.inject({ method: 'POST', url: '/api/acceso', payload: { acceso: `malo-${i}` } })).statusCode
    expect(ultimo).toBe(429)
    expect((await e.app.inject({ method: 'POST', url: '/api/acceso', payload: { acceso } })).statusCode).toBe(200)
    // Gastado, vuelve a contar como fallo y sigue en 429.
    expect((await e.app.inject({ method: 'POST', url: '/api/acceso', payload: { acceso } })).statusCode).toBe(429)
  })

  it('los fallos de login de un usuario no bloquean a otro usuario desde la misma IP', async () => {
    asegurarSuperadmin(e.db, 'facilitador', 'claveFacilitador1', e.reloj.ms)
    let ultimo = 0
    for (let i = 0; i < 21; i++) ultimo = (await login('Paola', `mala-${i}`)).statusCode
    expect(ultimo).toBe(429)
    // El mismo usuario, escrito distinto o con la clave correcta, sigue bloqueado durante el minuto.
    expect((await login(' PAOLA ', 'superclave123')).statusCode).toBe(429)
    // Otro usuario desde la misma IP entra.
    expect((await login('facilitador', 'claveFacilitador1')).statusCode).toBe(200)
    // Pasado el minuto, el primero vuelve a entrar.
    e.reloj.ms += 61_000
    expect((await login('paola', 'superclave123')).statusCode).toBe(200)
  }, 30_000)

  it('un login correcto no gasta el cupo de fallos', async () => {
    for (let i = 0; i < 25; i++) expect((await login('paola', 'superclave123')).statusCode).toBe(200)
  }, 30_000)
})
