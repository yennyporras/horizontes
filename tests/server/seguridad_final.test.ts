// Hallazgos M-1, M-3 y B-2 de la auditoría de seguridad (20-oct). Cada prueba reproduce el caso del informe.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Entorno, crearEntorno, crearSala } from './ayuda'

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
