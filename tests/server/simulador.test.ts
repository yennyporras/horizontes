// El simulador de taller (tools/simulador) corre en verde contra la API real en proceso,
// en modo realista y en modo --golden (prueba sintética del golden). El p95 no se exige aquí: servidor y
// clientes comparten event loop y la compuerta de Windows puede estar cargada; se mide con `npm run simular`.
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { generadorRealista, aEscala, ESCALA } from '../../tools/simulador/distribuciones'
import { cargarGolden } from '../../tools/simulador/index'
import { simularTaller } from '../../tools/simulador/simular'
import { type Entorno, crearEntorno } from './ayuda'

let e: Entorno
let base: string
beforeAll(async () => {
  e = await crearEntorno()
  await e.app.listen({ port: 0, host: '127.0.0.1' })
  base = `http://127.0.0.1:${(e.app.server.address() as AddressInfo).port}`
})
afterAll(() => e.app.close())

const comun = { usuario: 'paola', clave: 'superclave123', pollMs: 25, semilla: 7 }

describe('simulador de taller', () => {
  it('modo realista: 12 personas en 3 mesas, 2 rondas, todo verificado', async () => {
    const inf = await simularTaller({ ...comun, base, personas: 12, mesas: 3, generador: generadorRealista(7, 3) })
    expect(inf.errores).toEqual([])
    expect(inf.verificaciones.filter((v) => !v.ok)).toEqual([])
    expect(inf.verificaciones.length).toBeGreaterThan(12)
  }, 60_000)

  it('modo golden: reproduce la prueba sintética dentro de la tolerancia', async () => {
    const inf = await simularTaller({ ...comun, base, personas: 20, mesas: 4, generador: generadorRealista(7, 4), golden: cargarGolden() })
    const g = inf.verificaciones.find((v) => v.nombre.startsWith('golden'))
    expect(g?.ok, g?.detalle).toBe(true)
    expect(inf.errores).toEqual([])
    expect(inf.verificaciones.filter((v) => !v.ok)).toEqual([])
  }, 60_000)

  it('con más mesas que personas no da falsos rojos', async () => {
    const inf = await simularTaller({ ...comun, base, personas: 3, mesas: 5, generador: generadorRealista(3, 5) })
    expect(inf.errores).toEqual([])
    expect(inf.verificaciones.filter((v) => !v.ok)).toEqual([])
  }, 60_000)

  it('las respuestas generadas son de la escala y deterministas por semilla', () => {
    const a = generadorRealista(11, 2).respuestas(1, 0, 'insumex', 1)
    const b = generadorRealista(11, 2).respuestas(1, 0, 'insumex', 1)
    expect(a).toEqual(b)
    for (const v of Object.values(a)) expect(ESCALA).toContain(v)
    expect([aEscala(-3), aEscala(4.1), aEscala(5.9), aEscala(12)]).toEqual([1, 5, 5, 9])
  })
})
