// Hojas de los perfiles en el panel (R63): GET /api/admin/salas/{id}/hojas, solo lectura para el facilitador.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { semilla } from '../../server/dominio/semilla'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, loginCookie } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

type Hoja = { proyecto_id: string; proyecto: string; perfil_id: string; perfil: string; texto: string }
const leer = (salaId: string, cookie: string | null = e.cookie, headers: Record<string, string> = {}) =>
  e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}/hojas`, headers: { ...headers, ...(cookie ? { cookie } : {}) } })

describe('GET /api/admin/salas/{id}/hojas', () => {
  it('trae las 6 hojas de cada proyecto vivo, en el orden del catálogo de perfiles, aunque la sala no las revele', async () => {
    const s = await crearSala(e)
    const r = await leer(s.id)
    expect(r.statusCode).toBe(200)
    const hojas = r.json().hojas as Hoja[]
    const sem = semilla()
    expect(hojas).toHaveLength(sem.plantilla.hojas.length)
    const perfiles = sem.perfiles.map((p) => p.id)
    for (const pid of ['insumex', 'nutriwhat']) {
      expect(hojas.filter((h) => h.proyecto_id === pid).map((h) => h.perfil_id)).toEqual(perfiles)
    }
    const h = hojas.find((x) => x.proyecto_id === 'nutriwhat' && x.perfil_id === 'regulacion')!
    expect(h).toMatchObject({ proyecto: 'NUTRIWHAT', perfil: 'Regulación' })
    expect(h.texto).toBe(sem.plantilla.hojas.find((x) => x.proyecto_id === 'nutriwhat' && x.perfil_id === 'regulacion')!.texto)
    // Leerlas no cambia nada de la sala (no revela las hojas a los celulares).
    expect((await e.app.inject({ url: `/api/admin/salas/${s.id}`, headers: { cookie: e.cookie } })).json().sala.config.revelar_hojas).toBe(false)
  })

  it('sala inexistente responde 404 SALA_NO_EXISTE', async () => {
    const r = await leer('s_nada')
    expect(r.statusCode).toBe(404)
    expect(r.json().error.codigo).toBe('SALA_NO_EXISTE')
  })

  it('sin sesión de admin responde 401, también con el token de un participante', async () => {
    const s = await crearSala(e)
    await accion(e, s.id, 'abrir_inscripcion')
    const token = (await inscribir(e, s.mesas[0].codigo, 'ana@x.co')).json().token as string
    for (const r of [await leer(s.id, null), await leer(s.id, null, { 'x-participante-token': token })]) {
      expect(r.statusCode).toBe(401)
      expect(r.json().error.codigo).toBe('SESION_REQUERIDA')
    }
  })

  it('un admin con clave temporal recibe 403 hasta cambiarla; después puede leerlas', async () => {
    const s = await crearSala(e)
    const alta = await e.app.inject({
      method: 'POST',
      url: '/api/admin/admins',
      headers: { cookie: e.cookie },
      payload: { usuario: 'jorge', nombre: 'Jorge Puentes', correo: 'jorge@estratek.com.co', clave_temporal: 'temporal123' },
    })
    expect(alta.statusCode).toBe(201)
    const cookie = await loginCookie(e.app, 'jorge', 'temporal123')
    const bloqueada = await leer(s.id, cookie)
    expect(bloqueada.statusCode).toBe(403)
    expect(bloqueada.json().error.codigo).toBe('CAMBIO_CLAVE_REQUERIDO')
    await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie }, payload: { actual: 'temporal123', nueva: 'definitiva456' } })
    expect((await leer(s.id, cookie)).statusCode).toBe(200)
  })
})
