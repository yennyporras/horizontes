// Endurecimiento: cabeceras de seguridad, errores 4xx de Fastify con forma de contrato,
// validación estricta de inscripción y votos, límite de votos por participante y logs sin datos personales.
import { Writable } from 'node:stream'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'
import { VERSION_CONSENTIMIENTO } from '../../server/dominio/consentimiento'
import { CABECERAS, limpiarTexto } from '../../server/seguridad'
import { type Entorno, RESPUESTAS_5, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
let s: Awaited<ReturnType<typeof crearSala>>
let token: string
beforeAll(async () => {
  e = await crearEntorno()
  s = await crearSala(e, 1)
  await accion(e, s.id, 'abrir_inscripcion')
  await accion(e, s.id, 'abrir_ronda_1')
  token = (await inscribir(e, s.mesas[0].codigo, 'segura@estratek.com.co')).json().token
})
afterAll(() => e.app.close())

const inscripcion = (payload: object) =>
  e.app.inject({ method: 'POST', url: '/api/inscripcion', payload: { codigoMesa: s.mesas[0].codigo, consentimiento: { aceptado: true, version: VERSION_CONSENTIMIENTO }, ...payload } })

describe('cabeceras de seguridad', () => {
  it('salen en la API y en los errores; la API no se guarda en cachés compartidas', async () => {
    for (const url of ['/api/mesas/' + s.mesas[0].codigo, '/api/mesas/NOEXISTE']) {
      const r = await e.app.inject(url)
      for (const [k, v] of Object.entries(CABECERAS)) expect(r.headers[k.toLowerCase()]).toBe(v)
      expect(r.headers['cache-control']).toBe('no-store')
    }
    expect(CABECERAS['Content-Security-Policy']).toContain("frame-ancestors 'none'")
  })

  it('el polling conserva su no-cache para revalidar con ETag', async () => {
    const r = await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })
    expect(r.headers['cache-control']).toBe('no-cache')
    expect(r.headers.etag).toBeTruthy()
  })

  it('solo la landing se indexa: el resto lleva noindex y robots.txt lo dice', async () => {
    for (const url of ['/', '/?utm=qr']) expect((await e.app.inject(url)).headers['x-robots-tag']).toBeUndefined()
    for (const url of ['/m/' + s.mesas[0].codigo, '/admin', '/tablero/x', '/api/mesas/' + s.mesas[0].codigo]) {
      expect((await e.app.inject(url)).headers['x-robots-tag']).toBe('noindex, nofollow')
    }
    expect((await e.app.inject({ method: 'POST', url: '/' })).headers['x-robots-tag']).toBe('noindex, nofollow')
    const robots = await e.app.inject('/robots.txt')
    expect(robots.statusCode).toBe(200)
    expect(robots.body).toBe('User-agent: *\nAllow: /$\nDisallow: /\n')
  })

  it('HSTS solo detrás de HTTPS', async () => {
    const http = await e.app.inject('/api/mesas/' + s.mesas[0].codigo)
    expect(http.headers['strict-transport-security']).toBeUndefined()
    const https = await e.app.inject({ url: '/api/mesas/' + s.mesas[0].codigo, headers: { 'x-forwarded-proto': 'https' } })
    expect(https.headers['strict-transport-security']).toContain('max-age=')
  })
})

describe('errores de Fastify con forma de contrato (nunca 500)', () => {
  it('JSON mal formado → 400 PETICION_INVALIDA', async () => {
    const r = await e.app.inject({ method: 'POST', url: '/api/inscripcion', headers: { 'content-type': 'application/json' }, payload: '{"nombre": ' })
    expect(r.statusCode).toBe(400)
    expect(r.json().error.codigo).toBe('PETICION_INVALIDA')
  })

  it('cuerpo enorme → 413 CUERPO_DEMASIADO_GRANDE', async () => {
    const r = await inscripcion({ nombre: 'x'.repeat(40_000), correo: 'grande@estratek.com.co' })
    expect(r.statusCode).toBe(413)
    expect(r.json().error.codigo).toBe('CUERPO_DEMASIADO_GRANDE')
  })

  it('content-type no soportado → 415 TIPO_NO_SOPORTADO', async () => {
    const r = await e.app.inject({ method: 'PUT', url: '/api/votos', headers: { 'content-type': 'application/xml', 'x-participante-token': token }, payload: '<voto/>' })
    expect(r.statusCode).toBe(415)
    expect(r.json().error.codigo).toBe('TIPO_NO_SOPORTADO')
  })
})

describe('validación estricta', () => {
  it('inscripción: rechaza nombres con marcado o caracteres de control y correos con símbolos raros', async () => {
    for (const nombre of ['<script>alert(1)</script>', 'Ana\u0000Pérez', 'Ana {{x}}']) {
      const r = await inscripcion({ nombre, correo: 'nombre@estratek.com.co' })
      expect(r.statusCode, nombre).toBe(422)
      expect(r.json().error.codigo).toBe('DATOS_INVALIDOS')
    }
    for (const correo of ['a<b>@x.co', 'a@x', 'ana"@x.co', 'a,b@x.co', 'a(b)@x.co']) {
      expect((await inscripcion({ nombre: 'Ana Pérez', correo })).statusCode, correo).toBe(422)
    }
    expect((await inscripcion({ nombre: 123, correo: 'num@x.co' })).statusCode).toBe(422)
    // Nombres reales con tildes, eñes, apóstrofos y guiones sí pasan.
    expect((await inscripcion({ nombre: "María José O'Neill-Núñez", correo: 'maria.jose+taller@estratek.com.co' })).statusCode).toBe(201)
    expect((await inscripcion({ nombre: "Sean O'Brien", correo: "o'brien@estratek.com.co" })).statusCode).toBe(201)
  })

  it('votos: ronda y proyecto con el tipo exacto, respuestas como objeto con los 6 criterios y nada más', async () => {
    const malos: object[] = [
      { proyecto_id: 'insumex', ronda: '1', respuestas: RESPUESTAS_5 },
      { proyecto_id: 'insumex', ronda: 1.0001, respuestas: RESPUESTAS_5 },
      { proyecto_id: ['insumex'], ronda: 1, respuestas: RESPUESTAS_5 },
      { proyecto_id: 'insumex', ronda: 1, respuestas: Object.values(RESPUESTAS_5) },
      { proyecto_id: 'insumex', ronda: 1, respuestas: { ...RESPUESTAS_5, extra: 5 } },
      { proyecto_id: 'insumex', ronda: 1, respuestas: { ...RESPUESTAS_5, regulacion: '5' } },
      { proyecto_id: 'insumex', ronda: 1, respuestas: { ...RESPUESTAS_5, regulacion: 4 } },
    ]
    for (const p of malos) {
      const r = await e.app.inject({ method: 'PUT', url: '/api/votos', headers: { 'x-participante-token': token }, payload: p })
      expect(r.statusCode, JSON.stringify(p)).toBe(422)
    }
    expect((await votar(e, token, 'insumex', 1)).statusCode).toBe(200)
  })
})

describe('límite de votos por participante', () => {
  it('un celular en bucle recibe 429 sin afectar a los demás', async () => {
    const otro = (await inscribir(e, s.mesas[0].codigo, 'bucle@estratek.com.co')).json().token
    const vecino = (await inscribir(e, s.mesas[0].codigo, 'vecino@estratek.com.co')).json().token
    let ultimo = 0
    for (let i = 0; i < 125; i++) ultimo = (await votar(e, otro, 'insumex', 1)).statusCode
    expect(ultimo).toBe(429)
    expect((await votar(e, vecino, 'insumex', 1)).statusCode).toBe(200)
    // Pasado el minuto vuelve a poder votar.
    e.reloj.ms += 61_000
    expect((await votar(e, otro, 'insumex', 1)).statusCode).toBe(200)
  })
})

describe('logs sin datos personales', () => {
  it('redacta nombre, correo y tokens; limpia correos y tokens del mensaje de error', async () => {
    let salida = ''
    const stream = new Writable({
      write(chunk, _enc, cb) {
        salida += chunk.toString()
        cb()
      },
    })
    const app = await construirApp({ db: abrirDb(':memory:'), logStream: stream, intervaloCierresMs: 0, baseUrl: 'https://horizontes.test' })
    const tokenLargo = 'a'.repeat(43)
    app.log.error({ err: new Error(`falló para ana@estratek.com.co con ${tokenLargo}`) }, 'error no controlado')
    app.log.info({ datos: { nombre: 'Ana Pérez', correo: 'ana@estratek.com.co', token: tokenLargo } }, 'prueba')
    app.log.info({ req: { method: 'GET', url: `/api/tablero/s1?t=${tokenLargo}` } }, 'petición')
    await app.close()
    expect(salida).not.toContain('ana@estratek.com.co')
    expect(salida).not.toContain('Ana Pérez')
    expect(salida).not.toContain(tokenLargo)
    expect(salida).toContain('[correo]')
    expect(salida).toContain('[oculto]')
    expect(salida).toContain('/api/tablero/s1')
  })

  it('limpiarTexto deja el resto intacto', () => {
    expect(limpiarTexto('sala s_ab12 cerrada')).toBe('sala s_ab12 cerrada')
  })
})
