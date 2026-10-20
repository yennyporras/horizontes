import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'

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

  it('rúbricas: la sala del mock tiene votos, se leen pero el PUT responde 409 RUBRICA_CON_VOTOS', async () => {
    const r = await app.inject('/api/admin/salas/s_demo/rubricas')
    expect(r.json()).toMatchObject({ editable: false, motivo_no_editable: expect.any(String) })
    expect(r.json().criterios).toHaveLength(6)
    const p = await app.inject({ method: 'PUT', url: '/api/admin/salas/s_demo/rubricas/inversion_requerida', payload: { rubrica: [] } })
    expect(p.statusCode).toBe(409)
    expect(p.json().error.codigo).toBe('RUBRICA_CON_VOTOS')
  })

  it('hojas: las 6 de cada proyecto vivo con su perfil', async () => {
    const hojas = (await app.inject('/api/admin/salas/s_demo/hojas')).json().hojas as { proyecto: string; perfil: string }[]
    expect(hojas).toHaveLength(12)
    expect(new Set(hojas.map((h) => h.proyecto))).toEqual(new Set(['INSUMEX', 'NUTRIWHAT']))
    expect(new Set(hojas.map((h) => h.perfil)).size).toBe(6)
  })

  it('cambios del 19-oct: respuestas por persona, pregunta guiada, base_url y campos nuevos de config', async () => {
    const r = (await app.inject('/api/admin/salas/s_demo/respuestas')).json().respuestas
    expect(r[0]).toMatchObject({ participante_id: 'p_8f2a', nombre: 'Ana Pérez', mesa: 'Mesa 1', ronda: 1, proyecto_id: 'insumex' })
    const p = await app.inject({ method: 'PUT', url: '/api/admin/salas/s_demo/pregunta-guiada', payload: { proyecto_id: 'insumex', criterio_id: 'regulacion' } })
    expect(p.json().pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'regulacion' })
    const d = (await app.inject('/api/admin/salas/s_demo')).json()
    expect(d.base_url).toMatch(/^https:\/\//)
    expect(d.sala.config).toHaveProperty('apertura_programada_r2_at')
    expect((await app.inject('/api/yo')).json().config.modo_preguntas).toBe('automatico')
    // El tablero de `npm run dev` queda en automático (muestra la matriz); el ejemplo guiado vive en el mock del admin.
    const tb = (await app.inject('/api/tablero/s_demo?t=x')).json()
    expect(tb.sala.pregunta_guiada).toBeNull()
    expect(tb.config.modo_preguntas).toBe('automatico')
    expect(d.sala.pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'regulacion' })
  })

  it('mesa inexistente responde 404 MESA_NO_EXISTE', async () => {
    const r = await app.inject('/api/mesas/NOEXISTE')
    expect(r.statusCode).toBe(404)
    expect(r.json().error.codigo).toBe('MESA_NO_EXISTE')
  })
})

describe('servidor sin mocks', () => {
  it('health responde en modo api y /api/yo sin token da 401 con forma de error del contrato', async () => {
    const real = await construirApp({ mocks: false, db: abrirDb(':memory:'), intervaloCierresMs: 0 })
    expect((await real.inject('/api/health')).json()).toEqual({ ok: true, modo: 'api' })
    const r = await real.inject('/api/yo')
    expect(r.statusCode).toBe(401)
    expect(r.json().error.codigo).toBe('TOKEN_REQUERIDO')
    const r2 = await real.inject('/api/no-existe')
    expect(r2.statusCode).toBe(404)
    await real.close()
  })
})

describe('servidor de mocks: contrato del 20-oct (D1 y D2)', () => {
  let m: FastifyInstance
  beforeAll(async () => {
    m = await construirApp({ mocks: true })
  })
  afterAll(() => m.close())

  it('inscripción con correo ya inscrito: 409 sin token ni participante', async () => {
    const r = await m.inject({ method: 'POST', url: '/api/inscripcion', payload: { codigoMesa: 'HZ7K2-1', nombre: 'Ana', correo: 'ya@inscrito.co', consentimiento: { aceptado: true, version: 'hz-1.1' } } })
    expect(r.statusCode).toBe(409)
    expect(r.json()).toEqual({ error: { codigo: 'CORREO_YA_INSCRITO', mensaje: 'Ese correo ya está inscrito en esta sala. Pide al facilitador que te dé acceso de nuevo.' } })
  })

  it('acceso: canje, vencido e inválido', async () => {
    const ok = await m.inject({ method: 'POST', url: '/api/acceso', payload: { acceso: 'cualquiera' } })
    expect(ok.statusCode).toBe(200)
    expect(ok.json()).toMatchObject({ token: expect.any(String), participante: { id: expect.any(String), mesa: { id: expect.any(String) } } })
    expect((await m.inject({ method: 'POST', url: '/api/acceso', payload: { acceso: 'vencido' } })).json().error.codigo).toBe('ACCESO_VENCIDO')
    expect((await m.inject({ method: 'POST', url: '/api/acceso', payload: { acceso: 'invalido' } })).statusCode).toBe(404)
  })

  it('dar acceso de nuevo devuelve url y vence_at; borrar la rúbrica de plantilla devuelve la de la semilla', async () => {
    const a = (await m.inject({ method: 'POST', url: '/api/admin/participantes/p_8f2a/acceso', payload: {} })).json()
    expect(a.url).toMatch(/\/m\/[A-Z0-9-]+\?acceso=/)
    expect(Number.isNaN(Date.parse(a.vence_at))).toBe(false)
    const d = (await m.inject({ method: 'DELETE', url: '/api/admin/rubricas-plantilla/regulacion' })).json()
    expect(d).toMatchObject({ criterio_id: 'regulacion', borrada: true })
    expect(d.rubrica).toHaveLength(5)
  })

  it('resultados del participante sin progreso.por_mesa; el tablero sí lo trae', async () => {
    const r = (await m.inject('/api/resultados')).json()
    expect(r.progreso).not.toHaveProperty('por_mesa')
    expect(r.votos_por_actualizacion).toBe(3)
    expect((await m.inject('/api/tablero/s_demo?t=x')).json().progreso.por_mesa.length).toBeGreaterThan(0)
  })
})
