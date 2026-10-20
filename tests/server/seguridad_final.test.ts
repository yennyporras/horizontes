// Hallazgos M-1, M-3 y B-2 de la auditoría de seguridad (20-oct). Cada prueba reproduce el caso del informe.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Entorno, crearEntorno } from './ayuda'

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
