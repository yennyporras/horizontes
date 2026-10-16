// Ensayo general (tools/simulador/ensayo.ts) contra la API real en proceso, con el reloj real: precierre por mesa,
// llegada tarde, cambios de alcance y vista en vivo, cierres programados reales (a pocos segundos) y golden.
// La corrida completa de 40 personas con cierre a 10 min se documenta en docs/ENSAYO.md (`npm run ensayo`).
import type { AddressInfo } from 'node:net'
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { generadorRealista } from '../../tools/simulador/distribuciones'
import { ensayarTaller } from '../../tools/simulador/ensayo'
import { cargarGolden } from '../../tools/simulador/index'

let app: FastifyInstance
let base: string
beforeAll(async () => {
  const db = abrirDb(':memory:')
  asegurarSuperadmin(db, 'paola', 'superclave123', Date.now())
  app = await construirApp({ db, intervaloCierresMs: 1000, baseUrl: 'https://horizontes.test' })
  await app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`
})
afterAll(() => app.close())

const comun = { usuario: 'paola', clave: 'superclave123', pollMs: 100, semilla: 5, cierreMin: 3 / 60, cierreSalaSeg: 2 }

describe('ensayo general del taller', () => {
  it('9 personas en 3 mesas: precierre por mesa, cambios en vivo y cierres programados sin errores', async () => {
    const inf = await ensayarTaller({ ...comun, base, personas: 9, mesas: 3, generador: generadorRealista(5, 3) })
    expect(inf.errores).toEqual([])
    expect(inf.errores5xx).toBe(0)
    expect(inf.verificaciones.filter((v) => !v.ok)).toEqual([])
    expect(inf.verificaciones.some((v) => v.nombre.includes('llegada tarde'))).toBe(true)
    expect(inf.propagacion.map((p) => p.cambio)).toEqual(['alcance mesa → sala', 'vista registrado → en vivo'])
    expect(inf.cierres).toHaveLength(2)
    for (const c of inf.cierres) expect(c.desfaseMs).toBeLessThanOrEqual(15_000)
  }, 90_000)

  it('modo --golden: la sala reproduce tests/golden dentro de la tolerancia', async () => {
    const inf = await ensayarTaller({ ...comun, base, personas: 20, mesas: 4, generador: generadorRealista(5, 4), golden: cargarGolden() })
    expect(inf.verificaciones.find((v) => v.nombre.startsWith('golden'))?.ok).toBe(true)
    expect(inf.errores).toEqual([])
    expect(inf.verificaciones.filter((v) => !v.ok)).toEqual([])
  }, 90_000)
})
