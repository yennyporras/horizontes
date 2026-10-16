import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { construirApp } from '../../server/app'

let app: FastifyInstance
beforeAll(async () => {
  app = await construirApp({ mocks: true })
})
afterAll(() => app.close())

describe('servidor de mocks', () => {
  it('health responde en modo mocks', async () => {
    const r = await app.inject('/api/health')
    expect(r.json()).toEqual({ ok: true, modo: 'mocks' })
  })

  it.each([
    ['/api/yo', 'participante'],
    ['/api/tablero/s_demo?alcance=sala&t=x', 'proyectos_vivos'],
    ['/api/admin/salas/s_demo', 'mesas'],
  ])('GET %s sirve el mock con ETag y 304', async (url, llave) => {
    const r = await app.inject(url)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toHaveProperty(llave)
    const etag = r.headers.etag as string
    expect(etag).toBe(`"${r.json().version}"`)
    const r2 = await app.inject({ url, headers: { 'if-none-match': etag } })
    expect(r2.statusCode).toBe(304)
    expect(r2.body).toBe('')
  })

  it('inscripción sin consentimiento responde 422', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/inscripcion', payload: { codigoMesa: 'HZ7K2-1', nombre: 'A', correo: 'a@b.co' } })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('CONSENTIMIENTO_REQUERIDO')
  })

  it('mesa inexistente responde 404 MESA_NO_EXISTE', async () => {
    const r = await app.inject('/api/mesas/NOEXISTE')
    expect(r.statusCode).toBe(404)
    expect(r.json().error.codigo).toBe('MESA_NO_EXISTE')
  })
})

describe('servidor sin mocks', () => {
  it('rutas no implementadas responden 501 con forma de error del contrato', async () => {
    const real = await construirApp({ mocks: false })
    const r = await real.inject('/api/yo')
    expect(r.statusCode).toBe(501)
    expect(r.json().error.codigo).toBe('NO_IMPLEMENTADO')
    await real.close()
  })
})
