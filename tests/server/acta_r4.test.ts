// Cambios del acta del 16-oct (R4): visibilidad por defecto, país y zona horaria por sala, aviso de datos por país,
// IP de inscripción y voto (solo para el admin) y migración aditiva sobre una BD de R3.
import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { DatabaseSync } from 'node:sqlite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { migrar, uno } from '../../server/db/index'
import { MIGRACIONES } from '../../server/db/esquema'
import { TEXTOS_AUTORIZACION, VERSION_CONSENTIMIENTO } from '../../server/dominio/consentimiento'
import { reiniciarSalaLimpia } from '../../server/dominio/mantenimiento'
import { sha256 } from '../../server/dominio/util'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeAll(async () => {
  e = await crearEntorno()
})
afterAll(() => e.app.close())

const config = (id: string, payload: object) => e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${id}/config`, headers: { cookie: e.cookie }, payload })
const detalle = async (id: string) => (await e.app.inject({ url: `/api/admin/salas/${id}`, headers: { cookie: e.cookie } })).json()
const IP_CLIENTE = '198.51.100.7'
const desdeProxy = { 'x-forwarded-for': IP_CLIENTE }

describe('visibilidad por defecto (acta A2)', () => {
  it('una sala nueva nace con alcance sala y vista en vivo, en Colombia', async () => {
    const s = await crearSala(e, 1)
    expect((await detalle(s.id)).sala.config).toMatchObject({ alcance_resultados: 'sala', vista_participante: 'en_vivo', pais: 'CO', zona_horaria: 'America/Bogota' })
  })

  it('el reinicio limpio vuelve a la visibilidad por defecto y conserva el país', async () => {
    const s = await crearSala(e, 1)
    await config(s.id, { alcance_resultados: 'mesa', vista_participante: 'registrado', pais: 'GT' })
    const r = reiniciarSalaLimpia(e.db, s.id, e.reloj.ms)
    expect(r.sala).toMatchObject({ alcance_resultados: 'sala', vista_participante: 'en_vivo', pais: 'GT', zona_horaria: 'America/Guatemala' })
  })

  it('quien termina de votar ve el consolidado de la sala sin que el facilitador lo active', async () => {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_inscripcion')
    const tokens = [] as string[]
    for (const [i, correo] of ['a@x.co', 'b@x.co', 'c@x.co'].entries()) tokens.push((await inscribir(e, s.mesas[i % 2].codigo, correo)).json().token)
    await accion(e, s.id, 'abrir_ronda_1')
    for (const t of tokens) for (const p of ['insumex', 'nutriwhat']) await votar(e, t, p, 1)
    const y = (await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': tokens[0] } })).json()
    expect(y.resultados).toMatchObject({ alcance: { tipo: 'sala' }, preliminar: true })
    expect(y.resultados.proyectos_vivos[0].rondas[0]).toMatchObject({ n_votos: 3, total: 10 })
  })
})

describe('migración aditiva sobre una BD de R3', () => {
  it('las salas existentes conservan su visibilidad y quedan en Colombia; participantes y votos sin IP', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(MIGRACIONES[0])
    db.exec('PRAGMA user_version = 1')
    db.exec(`INSERT INTO salas (id, codigo, nombre, plantilla, estado, token_tablero_hash, token_tablero, creada_at)
             VALUES ('s_vieja', 'HZOLD', 'Vieja', 'foodsume_2026', 'preparada', 'h', 't', '2026-10-16T12:00:00.000Z')`)
    migrar(db)
    expect(uno(db, 'PRAGMA user_version')).toEqual({ user_version: MIGRACIONES.length })
    expect(uno(db, "SELECT alcance_resultados, vista_participante, pais, zona_horaria FROM salas WHERE id = 's_vieja'")).toEqual({
      alcance_resultados: 'mesa',
      vista_participante: 'registrado',
      pais: 'CO',
      zona_horaria: 'America/Bogota',
    })
    const columnas = (t: string) => (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name)
    expect(columnas('participantes')).toContain('ip')
    expect(columnas('votos')).toContain('ip')
    expect(columnas('consentimientos')).toContain('pais')
    db.close()
  })
})

describe('país y zona horaria por sala (acta P4)', () => {
  it('cambiar el país pone su zona; las horas de la sala salen con el desfase de esa zona', async () => {
    const s = await crearSala(e, 1)
    let r = await config(s.id, { pais: 'PE' })
    expect(r.json()).toMatchObject({ pais: 'PE', zona_horaria: 'America/Lima' })
    r = await config(s.id, { pais: 'GT', cierre_programado_ronda_at: '2026-10-20T16:00:00-05:00' })
    expect(r.json()).toMatchObject({ pais: 'GT', zona_horaria: 'America/Guatemala', cierre_programado_ronda_at: '2026-10-20T15:00:00-06:00' })
    const d = await detalle(s.id)
    expect(d.servidor_at).toBe('2026-10-20T13:00:00-06:00')
    expect(d.eventos[0].at.endsWith('-06:00')).toBe(true)
    // La hora del servidor del error HORA_PASADA también va en la zona de la sala.
    r = await config(s.id, { cierre_programado_sala_at: new Date(T0 - 60_000).toISOString() })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.mensaje).toContain('13:00:00')
  })

  it('el país y la zona se pueden fijar juntos y llegan al tablero y al celular', async () => {
    const s = await crearSala(e, 1)
    expect((await config(s.id, { pais: 'CO', zona_horaria: 'America/Lima' })).json()).toMatchObject({ pais: 'CO', zona_horaria: 'America/Lima' })
    await accion(e, s.id, 'abrir_inscripcion')
    const t = (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).json()
    expect(t.config).toMatchObject({ pais: 'CO', zona_horaria: 'America/Lima' })
    const token = (await inscribir(e, s.mesas[0].codigo, 'zona@x.co')).json().token
    const y = (await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })).json()
    expect(y.config).toMatchObject({ pais: 'CO', zona_horaria: 'America/Lima' })
  })

  it.each([[{ pais: 'MX' }], [{ pais: 'co' }], [{ zona_horaria: 'America/Mexico_City' }], [{ zona_horaria: 'toString' }], [{ zona_horaria: ['America/Bogota'] }]])('PATCH config %j → 422 CONFIG_INVALIDA', async (cuerpo) => {
    const s = await crearSala(e, 1)
    const r = await config(s.id, cuerpo)
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('CONFIG_INVALIDA')
  })
})

describe('aviso de datos según el país (C6)', () => {
  it.each([
    ['CO', 'Ley 1581 de 2012'],
    ['PE', 'Ley 29733'],
    ['GT', 'Guatemala'],
  ])('%s: GET /api/mesas trae país, versión hz-1.1 y el texto que cita %s; el consentimiento guarda el hash de ese texto', async (pais, cita) => {
    const s = await crearSala(e, 1)
    await config(s.id, { pais })
    await accion(e, s.id, 'abrir_inscripcion')
    const m = (await e.app.inject(`/api/mesas/${s.mesas[0].codigo}`)).json()
    expect(m.sala.pais).toBe(pais)
    expect(m.consentimiento.version).toBe('hz-1.1')
    expect(m.consentimiento.texto_autorizacion).toContain(cita)
    expect(m.consentimiento.texto_autorizacion).not.toContain('—')
    const r = await inscribir(e, s.mesas[0].codigo, `aviso-${pais}@x.co`)
    const c = uno<{ texto_hash: string; version_aviso: string }>(e.db, 'SELECT texto_hash, version_aviso FROM consentimientos WHERE participante_id = ?', r.json().participante.id)!
    expect(c).toEqual({ texto_hash: sha256(TEXTOS_AUTORIZACION[pais as 'CO']), version_aviso: VERSION_CONSENTIMIENTO })
  })

  it('una versión vieja del aviso se rechaza con 422 CONSENTIMIENTO_REQUERIDO', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const r = await e.app.inject({
      method: 'POST',
      url: '/api/inscripcion',
      payload: { codigoMesa: s.mesas[0].codigo, nombre: 'Viejo', correo: 'viejo@x.co', consentimiento: { aceptado: true, version: 'estratek-v1' } },
    })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('CONSENTIMIENTO_REQUERIDO')
  })
})

describe('IP real de inscripción y voto (C7, C8)', () => {
  it('se guarda la IP detrás del proxy, sale solo en el panel y el export, nunca en vistas públicas ni en logs', async () => {
    let log = ''
    const logStream = new Writable({
      write(chunk, _enc, cb) {
        log += chunk.toString()
        cb()
      },
    })
    const app = await construirApp({ db: e.db, ahora: () => e.reloj.ms, intervaloCierresMs: 0, baseUrl: 'https://horizontes.test', logStream })
    try {
      const s = await crearSala(e, 1)
      await config(s.id, { pais: 'PE' })
      await accion(e, s.id, 'abrir_inscripcion')
      // Un X-Forwarded-For inventado por el cliente no cambia la IP: manda el último salto, el que agrega el proxy.
      const ins = await app.inject({
        method: 'POST',
        url: '/api/inscripcion',
        headers: { 'x-forwarded-for': `203.0.113.99, ${IP_CLIENTE}` },
        payload: { codigoMesa: s.mesas[0].codigo, nombre: 'Ana Ip', correo: 'ip@x.co', consentimiento: { aceptado: true, version: VERSION_CONSENTIMIENTO } },
      })
      expect(ins.statusCode).toBe(201)
      const { token, participante } = ins.json()
      await accion(e, s.id, 'abrir_ronda_1')
      const v = await app.inject({ method: 'PUT', url: '/api/votos', headers: { ...desdeProxy, 'x-participante-token': token }, payload: { proyecto_id: 'insumex', ronda: 1, respuestas: { alistamiento_tecnico: 1, conocimiento_cliente: 1, regulacion: 1, capacidades_organizacionales: 1, alineacion_core: 1, inversion_requerida: 1 } } })
      expect(v.statusCode).toBe(200)

      expect(uno(e.db, 'SELECT ip FROM participantes WHERE id = ?', participante.id)).toEqual({ ip: IP_CLIENTE })
      expect(uno(e.db, 'SELECT ip FROM votos WHERE participante_id = ?', participante.id)).toEqual({ ip: IP_CLIENTE })
      expect(uno(e.db, 'SELECT ip FROM consentimientos WHERE participante_id = ?', participante.id)).toEqual({ ip: IP_CLIENTE })

      const p = (await detalle(s.id)).participantes[0]
      expect(p).toMatchObject({ ip: IP_CLIENTE, pais: 'PE' })
      // El país del export es el del aviso que la persona aceptó, aunque después cambie el de la sala.
      await config(s.id, { pais: 'GT' })
      const inscritos = (await e.app.inject({ url: `/api/admin/salas/${s.id}/export/inscritos.csv`, headers: { cookie: e.cookie } })).body
      expect(inscritos.trim().split('\r\n')[1].endsWith(`;${IP_CLIENTE};PE`)).toBe(true)
      const votos = (await e.app.inject({ url: `/api/admin/salas/${s.id}/export/votos.csv`, headers: { cookie: e.cookie } })).body
      expect(votos.trim().split('\r\n')[1].endsWith(`;${IP_CLIENTE};PE`)).toBe(true)

      const publicas = [
        ins.body,
        v.body,
        (await app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })).body,
        (await app.inject(`/api/mesas/${s.mesas[0].codigo}`)).body,
        (await app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).body,
      ]
      for (const cuerpo of publicas) expect(cuerpo).not.toContain(IP_CLIENTE)
      app.log.warn({ req: { method: 'GET', url: '/api/yo', ip: IP_CLIENTE }, datos: { ip: IP_CLIENTE } }, 'petición')
      expect(log).not.toContain(IP_CLIENTE)
    } finally {
      await app.close()
    }
  })
})

describe('aviso de datos hz-1.1', () => {
  it('el texto que sirve el servidor es el de docs/CONSENTIMIENTO.md §5.1, por país', () => {
    const doc = readFileSync(new URL('../../docs/CONSENTIMIENTO.md', import.meta.url), 'utf8')
    for (const texto of Object.values(TEXTOS_AUTORIZACION)) {
      expect(doc).toContain(texto)
      expect(texto).toContain('mayor de edad')
      expect(texto).toContain('info@estratek.com.co')
    }
    expect(TEXTOS_AUTORIZACION.PE).toContain('acceso, rectificación, cancelación y oposición')
  })
})
