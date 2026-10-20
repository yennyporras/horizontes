// Textos sin rayas en la semilla, duplicar sala, health y archivos estáticos.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { semilla, sinRayas } from '../../server/dominio/semilla'
import { type Entorno, accion, crearEntorno, crearSala, inscribir } from './ayuda'

let e: Entorno
beforeAll(async () => {
  e = await crearEntorno()
})
afterAll(() => e.app.close())

describe('textos sin rayas', () => {
  it('un inciso entre rayas pasa a ir entre comas', () => {
    expect(sinRayas('una tecnología desarrollada —y aún sin tracción— que')).toBe('una tecnología desarrollada, y aún sin tracción, que')
    expect(sinRayas('fin del inciso —.')).toBe('fin del inciso.')
    expect(sinRayas('sin cambios')).toBe('sin cambios')
    expect(sinRayas('Intro:\n— uno\n— dos')).toBe('Intro:\n- uno\n- dos')
    expect(sinRayas('fin —')).toBe('fin')
    expect(sinRayas('a —b— c. Otra, frase.')).toBe('a, b, c. Otra, frase.')
  })

  it('la semilla cargada no trae rayas en ningún texto', () => {
    expect(JSON.stringify(semilla())).not.toContain('—')
  })

  it('las hojas que ve el participante no traen rayas', async () => {
    const sala = await crearSala(e, 1, 'Rayas')
    await accion(e, sala.id, 'abrir_inscripcion')
    const { token } = (await inscribir(e, sala.mesas[0].codigo, 'rayas@prueba.co')).json()
    await accion(e, sala.id, 'abrir_ronda_1')
    await accion(e, sala.id, 'cerrar_ronda_1')
    await accion(e, sala.id, 'abrir_ronda_2')
    const r = await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })
    expect(r.statusCode).toBe(200)
    expect(r.body).not.toContain('—')
  })
})

describe('POST /api/admin/salas/:id/duplicar', () => {
  it('crea una sala nueva con las mismas mesas y el mismo país, visibilidad por defecto y sin inscritos', async () => {
    const orig = await crearSala(e, 3, 'Taller real')
    const cfg = { alcance_resultados: 'mesa', vista_participante: 'registrado', pais: 'PE' }
    await e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${orig.id}/config`, headers: { cookie: e.cookie }, payload: cfg })
    await accion(e, orig.id, 'abrir_inscripcion')
    await inscribir(e, orig.mesas[0].codigo, 'orig@prueba.co')

    const r = await e.app.inject({ method: 'POST', url: `/api/admin/salas/${orig.id}/duplicar`, headers: { cookie: e.cookie }, payload: {} })
    expect(r.statusCode, r.body).toBe(201)
    const copia = r.json()
    expect(copia.id).not.toBe(orig.id)
    expect(copia.nombre).toBe('Taller real (copia)')
    expect(copia.estado).toBe('preparada')
    expect(copia.mesas).toHaveLength(3)
    expect(copia.config).toMatchObject({ alcance_resultados: 'sala', vista_participante: 'en_vivo', pais: 'PE', zona_horaria: 'America/Lima' })
    const d = (await e.app.inject({ url: `/api/admin/salas/${copia.id}`, headers: { cookie: e.cookie } })).json()
    expect(d.participantes).toHaveLength(0)
  })

  it('acepta un nombre propio y exige sesión', async () => {
    const orig = await crearSala(e, 1, 'Base')
    const r = await e.app.inject({ method: 'POST', url: `/api/admin/salas/${orig.id}/duplicar`, headers: { cookie: e.cookie }, payload: { nombre: 'Ensayo martes' } })
    expect(r.json().nombre).toBe('Ensayo martes')
    expect((await e.app.inject({ method: 'POST', url: `/api/admin/salas/${orig.id}/duplicar`, payload: {} })).statusCode).toBe(401)
    expect((await e.app.inject({ method: 'POST', url: `/api/admin/salas/${orig.id}/duplicar`, headers: { cookie: e.cookie }, payload: { nombre: 123 } })).statusCode).toBe(422)
    expect((await e.app.inject({ method: 'POST', url: '/api/admin/salas/s_noexiste/duplicar', headers: { cookie: e.cookie }, payload: {} })).statusCode).toBe(404)
  })
})

describe('GET /api/health', () => {
  it('responde ok y modo api (version solo si el despliegue la pasa)', async () => {
    const r = await e.app.inject('/api/health')
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ ok: true, modo: 'api' })
  })
})
