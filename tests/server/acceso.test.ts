// D1 (20-oct): el facilitador da acceso de nuevo con un enlace personal de un solo uso; la recuperación con solo el
// correo desaparece (S-1 de la auditoría: con el correo de otra persona se le robaba la sesión y se veían sus votos).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const yo = (token: string) => e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })
const darAcceso = (id: string, cookie = e.cookie) => e.app.inject({ method: 'POST', url: `/api/admin/participantes/${id}/acceso`, headers: { cookie }, payload: {} })
const canjear = (acceso: unknown) => e.app.inject({ method: 'POST', url: '/api/acceso', payload: { acceso } })
const codigoDe = (url: string) => new URL(url).searchParams.get('acceso')!

async function salaConPersona(mesas = 2) {
  const s = await crearSala(e, mesas)
  await accion(e, s.id, 'abrir_inscripcion')
  await accion(e, s.id, 'abrir_ronda_1')
  const r = await inscribir(e, s.mesas[0].codigo, 'victima@correo.co', 'Víctima Real')
  expect(r.statusCode).toBe(201)
  return { s, p: r.json() as { token: string; participante: { id: string; nombre: string; mesa: { id: string; nombre: string } } } }
}

describe('S-1: el correo ya no recupera la sesión', () => {
  it('reproduce la auditoría: con el correo de otra persona, desde otra mesa, no se obtiene su sesión ni sus votos', async () => {
    const { s, p } = await salaConPersona()
    expect((await votar(e, p.token, 'insumex', 1)).statusCode).toBe(200)
    const atacante = await inscribir(e, s.mesas[1].codigo, 'victima@correo.co', 'Atacante')
    expect(atacante.statusCode).toBe(409)
    expect(atacante.json()).toEqual({
      error: { codigo: 'CORREO_YA_INSCRITO', mensaje: 'Ese correo ya está inscrito en esta sala. Pide al facilitador que te dé acceso de nuevo.' },
    })
    // La víctima sigue con su sesión y nadie más tiene una.
    const y = await yo(p.token)
    expect(y.statusCode).toBe(200)
    expect(y.json().mis_votos.map((v: { proyecto_id: string }) => v.proyecto_id)).toEqual(['insumex'])
  })

  it('con la sala cerrada tampoco hay recuperación ni pista de quién estaba inscrito', async () => {
    const { s } = await salaConPersona()
    await accion(e, s.id, 'cerrar_sala')
    const r = await inscribir(e, s.mesas[0].codigo, 'victima@correo.co', 'Otro')
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('INSCRIPCION_CERRADA')
    expect(r.json()).not.toHaveProperty('token')
  })
})

describe('POST /api/admin/participantes/{id}/acceso', () => {
  it('devuelve la URL de la mesa con el acceso y su vencimiento a los 15 min; guarda solo el hash y deja el evento', async () => {
    const { s, p } = await salaConPersona()
    const r = await darAcceso(p.participante.id)
    expect(r.statusCode).toBe(200)
    const b = r.json()
    expect(Object.keys(b).sort()).toEqual(['url', 'vence_at'])
    expect(b.url).toMatch(new RegExp(`^https://horizontes\\.test/m/${s.mesas[0].codigo}\\?acceso=[A-Za-z0-9_-]{32}$`))
    expect(Date.parse(b.vence_at) - e.reloj.ms).toBe(15 * 60_000)
    expect(b.vence_at).toMatch(/-05:00$/)
    const filas = e.db.prepare('SELECT * FROM accesos_participante').all() as Record<string, string>[]
    expect(filas).toHaveLength(1)
    expect(filas[0].token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(filas)).not.toContain(codigoDe(b.url))
    expect(filas[0].por).toBe('admin:paola')
    const d = (await e.app.inject({ url: `/api/admin/salas/${s.id}`, headers: { cookie: e.cookie } })).json()
    expect(d.eventos[0]).toMatchObject({ tipo: 'acceso_reemitido', por: 'admin:paola', detalle: { participante_id: p.participante.id, vence_at: b.vence_at } })
  })

  it('un admin (no solo el superadmin) puede darlo; sin sesión responde 401', async () => {
    const { p } = await salaConPersona()
    await e.app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie: e.cookie }, payload: { usuario: 'jorge', nombre: 'Jorge', clave_temporal: 'temporal-123' } })
    const cj = await loginCookie(e.app, 'jorge', 'temporal-123')
    await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie: cj }, payload: { actual: 'temporal-123', nueva: 'definitiva-456' } })
    expect((await darAcceso(p.participante.id, cj)).statusCode).toBe(200)
    expect((await darAcceso(p.participante.id, '')).statusCode).toBe(401)
  })

  it('se rechaza con la sala cerrada (409 SALA_CERRADA), con el participante inactivo (409) y si no existe (404)', async () => {
    const { s, p } = await salaConPersona()
    await e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${p.participante.id}`, headers: { cookie: e.cookie }, payload: { activo: false } })
    const inactivo = await darAcceso(p.participante.id)
    expect([inactivo.statusCode, inactivo.json().error.codigo]).toEqual([409, 'PARTICIPANTE_INACTIVO'])
    await e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${p.participante.id}`, headers: { cookie: e.cookie }, payload: { activo: true } })
    await accion(e, s.id, 'cerrar_sala')
    const cerrada = await darAcceso(p.participante.id)
    expect([cerrada.statusCode, cerrada.json().error.codigo]).toEqual([409, 'SALA_CERRADA'])
    expect((await darAcceso('p_noexiste')).json().error.codigo).toBe('PARTICIPANTE_NO_EXISTE')
  })
})

describe('POST /api/acceso', () => {
  it('canjea por un token nuevo con la forma de la inscripción, cierra las demás sesiones y conserva votos, mesa y perfil', async () => {
    const { p } = await salaConPersona()
    expect((await votar(e, p.token, 'insumex', 1)).statusCode).toBe(200)
    const url = (await darAcceso(p.participante.id)).json().url
    const r = await canjear(codigoDe(url))
    expect(r.statusCode).toBe(200)
    const b = r.json()
    expect(Object.keys(b).sort()).toEqual(['participante', 'token'])
    expect(b.participante).toEqual(p.participante)
    expect(b.token).not.toBe(p.token)
    expect((await yo(p.token)).statusCode).toBe(401)
    const y = await yo(b.token)
    expect(y.statusCode).toBe(200)
    expect(y.json().mis_votos).toHaveLength(1)
    const d = (await e.app.inject({ url: `/api/admin/salas/${(await yo(b.token)).json().sala.id}`, headers: { cookie: e.cookie } })).json()
    expect(d.eventos[0]).toMatchObject({ tipo: 'acceso_canjeado', por: 'sistema', detalle: { participante_id: p.participante.id } })
  })

  it('es de un solo uso: el segundo canje responde 410 ACCESO_VENCIDO', async () => {
    const { p } = await salaConPersona()
    const codigo = codigoDe((await darAcceso(p.participante.id)).json().url)
    expect((await canjear(codigo)).statusCode).toBe(200)
    const otra = await canjear(codigo)
    expect([otra.statusCode, otra.json().error.codigo]).toEqual([410, 'ACCESO_VENCIDO'])
  })

  it('vence a los 15 minutos', async () => {
    const { p } = await salaConPersona()
    const codigo = codigoDe((await darAcceso(p.participante.id)).json().url)
    e.reloj.ms += 15 * 60_000
    const r = await canjear(codigo)
    expect([r.statusCode, r.json().error.codigo]).toEqual([410, 'ACCESO_VENCIDO'])
    expect(r.json().error.mensaje).toBe('Este enlace de acceso ya se usó o venció. Pide al facilitador que te dé acceso de nuevo.')
  })

  it('un enlace nuevo vence el anterior sin usar', async () => {
    const { p } = await salaConPersona()
    const viejo = codigoDe((await darAcceso(p.participante.id)).json().url)
    const nuevo = codigoDe((await darAcceso(p.participante.id)).json().url)
    expect((await canjear(viejo)).statusCode).toBe(410)
    expect((await canjear(nuevo)).statusCode).toBe(200)
  })

  it('un código inventado responde 404 ACCESO_INVALIDO; sin código, 422', async () => {
    const r = await canjear('inventado-inventado-inventado-123')
    expect([r.statusCode, r.json().error.codigo]).toEqual([404, 'ACCESO_INVALIDO'])
    expect((await canjear(undefined)).statusCode).toBe(422)
    expect((await canjear(['a'])).statusCode).toBe(422)
  })

  it('con la sala cerrada después de darlo no se canjea (409 SALA_CERRADA) y el participante desactivado tampoco (403)', async () => {
    const { s, p } = await salaConPersona()
    const codigo = codigoDe((await darAcceso(p.participante.id)).json().url)
    await e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${p.participante.id}`, headers: { cookie: e.cookie }, payload: { activo: false } })
    expect((await canjear(codigo)).json().error.codigo).toBe('PARTICIPANTE_INACTIVO')
    await e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${p.participante.id}`, headers: { cookie: e.cookie }, payload: { activo: true } })
    await accion(e, s.id, 'cerrar_sala')
    const r = await canjear(codigo)
    expect([r.statusCode, r.json().error.codigo]).toEqual([409, 'SALA_CERRADA'])
    // El rechazo no gasta el enlace: si se reabre la sala dentro de los 15 min, sirve.
    await accion(e, s.id, 'reabrir_sala')
    expect((await canjear(codigo)).statusCode).toBe(200)
  })

  it('tiene límite de peticiones por IP (429)', async () => {
    let ultimo = 0
    for (let i = 0; i < 61; i++) ultimo = (await canjear(`intento-${i}`)).statusCode
    expect(ultimo).toBe(429)
  })

  it('el reinicio limpio de la sala borra los accesos', async () => {
    const { s, p } = await salaConPersona()
    await darAcceso(p.participante.id)
    const { reiniciarSalaLimpia } = await import('../../server/dominio/mantenimiento')
    const r = reiniciarSalaLimpia(e.db, s.id, e.reloj.ms)
    expect(r.borrados.accesos).toBe(1)
    expect(e.db.prepare('SELECT COUNT(*) AS n FROM accesos_participante').get()).toEqual({ n: 0 })
  })
})
