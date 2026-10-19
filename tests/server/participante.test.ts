// Integración del flujo del participante y del tablero contra la API real.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { VERSION_CONSENTIMIENTO } from '../../server/dominio/consentimiento'
import { type Entorno, RESPUESTAS_5, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

type Sala = Awaited<ReturnType<typeof crearSala>>

const yo = (token?: string, headers: Record<string, string> = {}) =>
  e.app.inject({ url: '/api/yo', headers: { ...(token ? { 'x-participante-token': token } : {}), ...headers } })
const resultados = (token: string, ronda?: number) =>
  e.app.inject({ url: `/api/resultados${ronda ? `?ronda=${ronda}` : ''}`, headers: { 'x-participante-token': token } })
const config = (salaId: string, cuerpo: object) =>
  e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${salaId}/config`, headers: { cookie: e.cookie }, payload: cuerpo })
const editarParticipante = (id: string, cuerpo: object) =>
  e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${id}`, headers: { cookie: e.cookie }, payload: cuerpo })

async function salaAbierta(mesas = 2, estado: 'inscripcion' | 'r1_abierta' = 'inscripcion'): Promise<Sala> {
  const s = await crearSala(e, mesas)
  expect((await accion(e, s.id, 'abrir_inscripcion')).statusCode).toBe(200)
  if (estado === 'r1_abierta') expect((await accion(e, s.id, 'abrir_ronda_1')).statusCode).toBe(200)
  return s
}

async function inscrito(codigoMesa: string, correo: string, nombre = 'Persona Prueba') {
  const r = await inscribir(e, codigoMesa, correo, nombre)
  expect(r.statusCode).toBe(201)
  return r.json() as { token: string; participante: { id: string; nombre: string; mesa: { id: string }; perfil: { id: string } } }
}

async function votarAmbos(token: string, ronda = 1) {
  for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, token, p, ronda)).statusCode).toBe(200)
}

describe('GET /api/mesas/:codigo', () => {
  it('trae sala, mesa y consentimiento; no distingue mayúsculas', async () => {
    const s = await crearSala(e, 2)
    const r = await e.app.inject(`/api/mesas/${s.mesas[1].codigo.toLowerCase()}`)
    expect(r.statusCode).toBe(200)
    const b = r.json()
    expect(b.sala).toMatchObject({ id: s.id, estado: 'preparada' })
    expect(b.mesa).toMatchObject({ id: s.mesas[1].id, nombre: 'Mesa 2' })
    expect(b.consentimiento.version).toBe(VERSION_CONSENTIMIENTO)
    expect(typeof b.consentimiento.texto_autorizacion).toBe('string')
    expect(b.consentimiento.texto_autorizacion.length).toBeGreaterThan(20)
    expect(b.consentimiento.politica_url).toMatch(/^https?:\/\//)
  })

  it('inscripcion_abierta sigue el estado de la sala', async () => {
    const s = await crearSala(e, 1)
    const abierta = async () => (await e.app.inject(`/api/mesas/${s.mesas[0].codigo}`)).json().inscripcion_abierta
    expect(await abierta()).toBe(false)
    await accion(e, s.id, 'abrir_inscripcion')
    expect(await abierta()).toBe(true)
    await accion(e, s.id, 'abrir_ronda_1')
    expect(await abierta()).toBe(true)
    await accion(e, s.id, 'cerrar_sala')
    expect(await abierta()).toBe(false)
  })

  it('mesa inexistente responde 404 MESA_NO_EXISTE', async () => {
    const r = await e.app.inject('/api/mesas/HZZZZ-9')
    expect(r.statusCode).toBe(404)
    expect(r.json().error.codigo).toBe('MESA_NO_EXISTE')
  })
})

describe('POST /api/inscripcion', () => {
  const inscribirCon = (cuerpo: object) => e.app.inject({ method: 'POST', url: '/api/inscripcion', payload: cuerpo })

  it('sin consentimiento aceptado responde 422 CONSENTIMIENTO_REQUERIDO', async () => {
    const s = await salaAbierta(1)
    for (const consentimiento of [undefined, { aceptado: false, version: VERSION_CONSENTIMIENTO }, { aceptado: 'true', version: VERSION_CONSENTIMIENTO }]) {
      const r = await inscribirCon({ codigoMesa: s.mesas[0].codigo, nombre: 'Ana', correo: 'ana@correo.co', consentimiento })
      expect(r.statusCode).toBe(422)
      expect(r.json().error.codigo).toBe('CONSENTIMIENTO_REQUERIDO')
    }
    expect(Number((e.db.prepare('SELECT COUNT(*) AS n FROM participantes').get() as { n: number }).n)).toBe(0)
  })

  it('con una versión del aviso distinta responde 422', async () => {
    const s = await salaAbierta(1)
    const r = await inscribirCon({ codigoMesa: s.mesas[0].codigo, nombre: 'Ana', correo: 'ana@correo.co', consentimiento: { aceptado: true, version: 'estratek-v0' } })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('CONSENTIMIENTO_REQUERIDO')
  })

  it.each(['no-es-correo', 'ana@', 'ana @correo.co', ''])('correo inválido %j responde 422 DATOS_INVALIDOS', async (correo) => {
    const s = await salaAbierta(1)
    const r = await inscribir(e, s.mesas[0].codigo, correo, 'Ana')
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('DATOS_INVALIDOS')
  })

  it('nombre vacío responde 422 DATOS_INVALIDOS', async () => {
    const s = await salaAbierta(1)
    const r = await inscribir(e, s.mesas[0].codigo, 'ana@correo.co', ' ')
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('DATOS_INVALIDOS')
  })

  it('en sala preparada responde 409 INSCRIPCION_CERRADA', async () => {
    const s = await crearSala(e, 1)
    const r = await inscribir(e, s.mesas[0].codigo, 'ana@correo.co')
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('INSCRIPCION_CERRADA')
  })

  it('en mesa inexistente responde 404', async () => {
    const r = await inscribir(e, 'HZZZZ-1', 'ana@correo.co')
    expect(r.statusCode).toBe(404)
  })

  it('responde 201 con token y participante, sin correo', async () => {
    const s = await salaAbierta(2)
    const r = await inscribir(e, s.mesas[1].codigo, 'Ana@Correo.co', 'Ana Gómez')
    expect(r.statusCode).toBe(201)
    const b = r.json()
    expect(typeof b.token).toBe('string')
    expect(b.token.length).toBeGreaterThan(20)
    expect(b.participante).toMatchObject({ nombre: 'Ana Gómez', mesa: { id: s.mesas[1].id, nombre: 'Mesa 2' }, perfil: { id: 'cliente' } })
    expect(r.body.toLowerCase()).not.toContain('ana@correo.co')
    expect(b.participante).not.toHaveProperty('correo')
    // El servidor guarda solo el hash del token.
    const fila = e.db.prepare('SELECT token_hash FROM participantes WHERE id = ?').get(b.participante.id) as { token_hash: string }
    expect(fila.token_hash).not.toBe(b.token)
    expect(fila.token_hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('mismo correo responde 409 CORREO_YA_INSCRITO con el mismo participante y token nuevo; el viejo deja de servir', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'ana@correo.co', 'Ana Gómez')
    const r = await inscribir(e, s.mesas[0].codigo, ' ANA@correo.co ', 'Ana G')
    expect(r.statusCode).toBe(409)
    const b = r.json()
    expect(b.error.codigo).toBe('CORREO_YA_INSCRITO')
    expect(b.participante.id).toBe(a.participante.id)
    expect(b.token).not.toBe(a.token)
    expect(r.body.toLowerCase()).not.toContain('ana@correo.co')

    expect((await yo(a.token)).statusCode).toBe(401)
    expect((await yo(b.token)).statusCode).toBe(200)
    expect(Number((e.db.prepare('SELECT COUNT(*) AS n FROM participantes').get() as { n: number }).n)).toBe(1)
  })

  it('el mismo correo puede inscribirse en salas distintas', async () => {
    const s1 = await salaAbierta(1)
    const s2 = await salaAbierta(1)
    const a = await inscrito(s1.mesas[0].codigo, 'ana@correo.co')
    const b = await inscrito(s2.mesas[0].codigo, 'ana@correo.co')
    expect(a.participante.id).not.toBe(b.participante.id)
  })

  it('guarda el consentimiento con versión, política, hash del texto, IP y user agent', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'ana@correo.co')
    const filas = e.db.prepare('SELECT * FROM consentimientos WHERE participante_id = ?').all(a.participante.id) as Record<string, string>[]
    expect(filas).toHaveLength(1)
    const c = filas[0]
    expect(c.version_aviso).toBe(VERSION_CONSENTIMIENTO)
    expect(c.politica_url).toMatch(/^https?:\/\//)
    expect(c.texto_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(c.ip).toBeTruthy()
    expect(c.user_agent).toBe('vitest')
    expect(Number.isNaN(Date.parse(c.aceptado_at))).toBe(false)
  })
})

describe('asignación balanceada de perfiles', () => {
  it('los 6 primeros de una mesa reciben los 6 perfiles en orden del catálogo y el 7º cliente', async () => {
    const s = await salaAbierta(2)
    const perfiles: string[] = []
    for (let i = 1; i <= 7; i++) perfiles.push((await inscrito(s.mesas[0].codigo, `p${i}@correo.co`)).participante.perfil.id)
    expect(perfiles).toEqual(['cliente', 'regulacion', 'financiero', 'tecnica_operaciones', 'estrategica', 'produccion', 'cliente'])
    // Otra mesa empieza su propio reparto.
    expect((await inscrito(s.mesas[1].codigo, 'otra@correo.co')).participante.perfil.id).toBe('cliente')
  })

  it('un participante desactivado libera su perfil para el siguiente', async () => {
    const s = await salaAbierta(1)
    await inscrito(s.mesas[0].codigo, 'p1@correo.co')
    const p2 = await inscrito(s.mesas[0].codigo, 'p2@correo.co')
    expect(p2.participante.perfil.id).toBe('regulacion')
    await editarParticipante(p2.participante.id, { activo: false })
    expect((await inscrito(s.mesas[0].codigo, 'p3@correo.co')).participante.perfil.id).toBe('regulacion')
  })
})

describe('GET /api/yo', () => {
  it('sin token responde 401 y con token inventado también', async () => {
    expect((await yo()).statusCode).toBe(401)
    const r = await yo('inventado')
    expect(r.statusCode).toBe(401)
    expect(r.json().error.codigo).toBe('TOKEN_INVALIDO')
  })

  it('trae caso, portafolio de 10, criterios con rúbrica y solo las hojas del propio perfil', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'ana@correo.co')
    const r = await yo(a.token)
    expect(r.statusCode).toBe(200)
    const b = r.json()
    expect(b.contenido.caso.titulo).toBeTruthy()
    expect(b.contenido.portafolio).toHaveLength(10)
    expect(b.config.revelar_hojas).toBe(false)
    expect(b.contenido.hojas).toHaveLength(2)
    expect(b.contenido.hojas.every((h: { perfil_id: string }) => h.perfil_id === 'cliente')).toBe(true)
    expect(b.criterios).toHaveLength(6)
    for (const c of b.criterios) {
      expect(c.rubrica.map((x: { valor: number }) => x.valor).sort()).toEqual([1, 3, 5, 7, 9])
    }
    expect(b.resultados).toBeNull()
    expect(b.pendientes.sort()).toEqual(['insumex', 'nutriwhat'])
  })

  it('tras abrir la ronda 2 trae las 12 hojas, con las propias primero', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    await inscrito(s.mesas[0].codigo, 'p1@correo.co')
    const a = await inscrito(s.mesas[0].codigo, 'p2@correo.co')
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    const b = (await yo(a.token)).json()
    expect(b.config.revelar_hojas).toBe(true)
    expect(b.contenido.hojas).toHaveLength(12)
    expect(b.contenido.hojas.slice(0, 2).map((h: { perfil_id: string }) => h.perfil_id)).toEqual(['regulacion', 'regulacion'])
  })

  it('responde con ETag y 304; la ETag cambia cuando la sala cambia', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'ana@correo.co')
    const r = await yo(a.token)
    const etag = r.headers.etag as string
    expect(etag).toBe(`"${r.json().version}"`)
    const r2 = await yo(a.token, { 'if-none-match': etag })
    expect(r2.statusCode).toBe(304)
    expect(r2.body).toBe('')
    await accion(e, s.id, 'abrir_ronda_1')
    const r3 = await yo(a.token, { 'if-none-match': etag })
    expect(r3.statusCode).toBe(200)
    expect(r3.json().pendientes.sort()).toEqual(['insumex', 'nutriwhat'])
  })

  it('ni /api/yo, ni /api/tablero, ni /api/resultados exponen correos o nombres de otros', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    await config(s.id, { vista_participante: 'en_vivo', alcance_resultados: 'mesa' })
    const ana = await inscrito(s.mesas[0].codigo, 'ana.secreta@correo.co', 'Ana Secreta')
    const beto = await inscrito(s.mesas[0].codigo, 'beto.oculto@correo.co', 'Beto Oculto')
    await votarAmbos(ana.token)
    await votarAmbos(beto.token)

    const cuerpos = [
      (await yo(ana.token)).body,
      (await resultados(ana.token)).body,
      (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).body,
      (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}&alcance=mesa&mesa=${s.mesas[0].id}`)).body,
    ]
    expect((await resultados(ana.token)).statusCode).toBe(200)
    for (const c of cuerpos) {
      expect(c).not.toContain('@correo.co')
      expect(c).not.toContain('Beto')
    }
    // El tablero no muestra ni siquiera el nombre de quien consulta.
    for (const c of cuerpos.slice(1)) expect(c).not.toContain('Ana Secreta')
  })
})

describe('PUT /api/votos', () => {
  async function listo() {
    const s = await salaAbierta(1, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'ana@correo.co')
    return { s, a }
  }

  it.each([
    [{ ...RESPUESTAS_5, regulacion: 2 }],
    [{ ...RESPUESTAS_5, regulacion: 0 }],
    [{ ...RESPUESTAS_5, regulacion: 10 }],
    [{ ...RESPUESTAS_5, regulacion: '5' }],
    [{ ...RESPUESTAS_5, regulacion: 5.5 }],
  ])('valores fuera de 1/3/5/7/9 responden 422 RESPUESTA_INVALIDA (%j)', async (respuestas) => {
    const { a } = await listo()
    const r = await votar(e, a.token, 'insumex', 1, respuestas)
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('RESPUESTA_INVALIDA')
  })

  it('faltan criterios o sobran claves → 422 RESPUESTA_INVALIDA', async () => {
    const { a } = await listo()
    const { regulacion: _, ...sinUno } = RESPUESTAS_5
    expect((await votar(e, a.token, 'insumex', 1, sinUno)).json().error.codigo).toBe('RESPUESTA_INVALIDA')
    expect((await votar(e, a.token, 'insumex', 1, {})).statusCode).toBe(422)
    const { regulacion: __, ...cinco } = RESPUESTAS_5
    expect((await votar(e, a.token, 'insumex', 1, { ...cinco, otro: 5 })).statusCode).toBe(422)
  })

  it('ronda distinta de 1 o 2 responde 422', async () => {
    const { a } = await listo()
    expect((await votar(e, a.token, 'insumex', 3)).statusCode).toBe(422)
  })

  it('un proyecto fijo o inexistente responde 422 PROYECTO_INVALIDO', async () => {
    const { a } = await listo()
    for (const p of ['bioskin', 'no_existe']) {
      const r = await votar(e, a.token, p, 1)
      expect(r.statusCode).toBe(422)
      expect(r.json().error.codigo).toBe('PROYECTO_INVALIDO')
    }
  })

  it('sin token responde 401', async () => {
    const r = await e.app.inject({ method: 'PUT', url: '/api/votos', payload: { proyecto_id: 'insumex', ronda: 1, respuestas: RESPUESTAS_5 } })
    expect(r.statusCode).toBe(401)
  })

  it('ronda no abierta responde 409 RONDA_NO_ACTIVA', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'ana@correo.co')
    const r = await votar(e, a.token, 'insumex', 1)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('RONDA_NO_ACTIVA')
    await accion(e, s.id, 'abrir_ronda_1')
    const r2 = await votar(e, a.token, 'insumex', 2)
    expect(r2.statusCode).toBe(409)
    expect(r2.json().error.codigo).toBe('RONDA_NO_ACTIVA')
  })

  it('ronda cerrada responde 409 RONDA_CERRADA', async () => {
    const { s, a } = await listo()
    await accion(e, s.id, 'cerrar_ronda_1')
    const r = await votar(e, a.token, 'insumex', 1)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('RONDA_CERRADA')
    // Con la ronda 2 abierta, la 1 sigue cerrada.
    await accion(e, s.id, 'abrir_ronda_2')
    expect((await votar(e, a.token, 'insumex', 1)).json().error.codigo).toBe('RONDA_CERRADA')
    expect((await votar(e, a.token, 'insumex', 2)).statusCode).toBe(200)
  })

  it('votar dos veces el mismo proyecto deja un solo voto con los valores nuevos', async () => {
    const { s, a } = await listo()
    const r1 = await votar(e, a.token, 'insumex', 1)
    expect(r1.statusCode).toBe(200)
    expect(r1.json().voto).toMatchObject({ proyecto_id: 'insumex', ronda: 1, respuestas: RESPUESTAS_5 })
    const nuevas = { ...RESPUESTAS_5, regulacion: 9, alineacion_core: 1 }
    const r2 = await votar(e, a.token, 'insumex', 1, nuevas)
    expect(r2.statusCode).toBe(200)
    expect(r2.json().voto.respuestas).toEqual(nuevas)
    const filas = e.db.prepare('SELECT regulacion, alineacion_core FROM votos WHERE participante_id = ?').all(a.participante.id) as { regulacion: number; alineacion_core: number }[]
    expect(filas).toHaveLength(1)
    expect(filas[0]).toEqual({ regulacion: 9, alineacion_core: 1 })
    const t = (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).json()
    const ins = t.proyectos_vivos.find((p: { id: string }) => p.id === 'insumex').rondas[0]
    expect(ins.n_votos).toBe(1)
    // Con un solo voto el tablero no lo muestra (sería la respuesta individual); el valor nuevo ya se verificó en la BD.
    expect(ins).toMatchObject({ bajo_minimo: true, promedios: null })
  })

  it('completo_ronda se vuelve true tras votar los 2 vivos y progreso_mesa lo refleja', async () => {
    const { a } = await listo()
    const r1 = await votar(e, a.token, 'insumex', 1)
    expect(r1.json().completo_ronda).toBe(false)
    expect(r1.json().progreso_mesa).toEqual({ inscritos: 1, completos: 0, precierre: false })
    const r2 = await votar(e, a.token, 'nutriwhat', 1)
    expect(r2.json().completo_ronda).toBe(true)
    expect(r2.json().progreso_mesa).toEqual({ inscritos: 1, completos: 1, precierre: true })
    const b = (await yo(a.token)).json()
    expect(b.completo_ronda).toBe(true)
    expect(b.mis_votos).toHaveLength(2)
    expect(b.pendientes).toEqual([])
  })

  it('un participante desactivado recibe 403', async () => {
    const { a } = await listo()
    await editarParticipante(a.participante.id, { activo: false })
    const r = await votar(e, a.token, 'insumex', 1)
    expect(r.statusCode).toBe(403)
    expect(r.json().error.codigo).toBe('PARTICIPANTE_INACTIVO')
  })
})

describe('GET /api/resultados', () => {
  it('con vista registrado y sin precierre responde 403 RESULTADOS_NO_DISPONIBLES', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await inscrito(s.mesas[0].codigo, 'b@correo.co')
    await votarAmbos(a.token)
    const r = await resultados(a.token)
    expect(r.statusCode).toBe(403)
    expect(r.json().error.codigo).toBe('RESULTADOS_NO_DISPONIBLES')
    expect((await yo(a.token)).json().resultados).toBeNull()
  })

  it('antes de abrir la ronda 1 responde 403', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    expect((await resultados(a.token)).statusCode).toBe(403)
  })

  it('con alcance mesa y la mesa completa se ve preliminar con alcance.tipo mesa', async () => {
    const s = await salaAbierta(2, 'r1_abierta')
    await config(s.id, { alcance_resultados: 'mesa' })
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const b = await inscrito(s.mesas[0].codigo, 'b@correo.co')
    await inscrito(s.mesas[1].codigo, 'c@correo.co') // la otra mesa no vota
    await votarAmbos(a.token)
    expect((await resultados(a.token)).statusCode).toBe(403)
    await votarAmbos(b.token)
    const r = await resultados(a.token)
    expect(r.statusCode).toBe(200)
    const t = r.json()
    expect(t.preliminar).toBe(true)
    expect(t.alcance).toMatchObject({ tipo: 'mesa', mesa_id: s.mesas[0].id })
    expect(t.proyectos_vivos[0].rondas[0].n_votos).toBe(2)
    expect((await yo(a.token)).json().resultados).not.toBeNull()
  })

  it('con alcance sala solo se ve cuando todas las mesas con inscritos están completas', async () => {
    const s = await salaAbierta(3, 'r1_abierta') // la mesa 3 queda vacía
    await config(s.id, { alcance_resultados: 'sala' })
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const c = await inscrito(s.mesas[1].codigo, 'c@correo.co')
    await votarAmbos(a.token)
    expect((await resultados(a.token)).statusCode).toBe(403)
    await votarAmbos(c.token)
    const r = await resultados(a.token)
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ preliminar: true, alcance: { tipo: 'sala' } })
    expect(r.json().proyectos_vivos[0].rondas[0].n_votos).toBe(2)
  })

  it('tras cerrar la ronda se ve con preliminar false', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await inscrito(s.mesas[0].codigo, 'b@correo.co')
    await votar(e, a.token, 'insumex', 1)
    await accion(e, s.id, 'cerrar_ronda_1')
    const r = await resultados(a.token)
    expect(r.statusCode).toBe(200)
    expect(r.json().preliminar).toBe(false)
    expect(r.json().proyectos_vivos.find((p: { id: string }) => p.id === 'nutriwhat').rondas[0]).toMatchObject({ n_votos: 0, promedios: null, eje_x: null })
  })

  it('en ronda 2 trae las rondas 1 y 2; ?ronda=1 sigue disponible porque está cerrada', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await votarAmbos(a.token)
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    expect((await resultados(a.token)).statusCode).toBe(403)
    const r1 = await resultados(a.token, 1)
    expect(r1.statusCode).toBe(200)
    expect(r1.json().proyectos_vivos[0].rondas.map((x: { ronda: number }) => x.ronda)).toEqual([1])
    await votarAmbos(a.token, 2)
    const r2 = await resultados(a.token)
    expect(r2.statusCode).toBe(200)
    expect(r2.json().proyectos_vivos[0].rondas.map((x: { ronda: number }) => x.ronda)).toEqual([1, 2])
  })

  it('con vista en_vivo se ve después de votar los 2 proyectos, aunque la mesa no esté completa', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    await config(s.id, { vista_participante: 'en_vivo' })
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await inscrito(s.mesas[0].codigo, 'b@correo.co')
    await votar(e, a.token, 'insumex', 1)
    expect((await resultados(a.token)).statusCode).toBe(403)
    await votar(e, a.token, 'nutriwhat', 1)
    const r = await resultados(a.token)
    expect(r.statusCode).toBe(200)
    expect(r.json().preliminar).toBe(true)
  })

  it('los votos de participantes desactivados no cuentan en n_votos ni bloquean el precierre', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const b = await inscrito(s.mesas[0].codigo, 'b@correo.co')
    const c = await inscrito(s.mesas[0].codigo, 'c@correo.co')
    await votarAmbos(a.token)
    await votarAmbos(b.token, 1)
    // c no vota: sin precierre.
    expect((await resultados(a.token)).statusCode).toBe(403)
    // Desactivar a b (que votó) y a c (que no votó).
    await editarParticipante(b.participante.id, { activo: false })
    await editarParticipante(c.participante.id, { activo: false })
    const r = await resultados(a.token)
    expect(r.statusCode).toBe(200)
    const t = r.json()
    expect(t.progreso.inscritos).toBe(1)
    expect(t.progreso.precierre).toBe(true)
    for (const p of t.proyectos_vivos) expect(p.rondas[0].n_votos).toBe(1)
    const tab = (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).json()
    for (const p of tab.proyectos_vivos) expect(p.rondas[0].n_votos).toBe(1)
  })
})

describe('GET /api/tablero/:salaId', () => {
  it('sin t responde 401 y con t incorrecto también', async () => {
    const s = await crearSala(e, 1)
    const r = await e.app.inject(`/api/tablero/${s.id}`)
    expect(r.statusCode).toBe(401)
    expect(r.json().error.codigo).toBe('TOKEN_TABLERO_INVALIDO')
    expect((await e.app.inject(`/api/tablero/${s.id}?t=malo`)).statusCode).toBe(401)
  })

  it('el token de otra sala no abre este tablero', async () => {
    const s1 = await crearSala(e, 1)
    const s2 = await crearSala(e, 1)
    expect((await e.app.inject(`/api/tablero/${s1.id}?t=${s2.token_tablero}`)).statusCode).toBe(401)
  })

  it('con t correcto responde 200 con 8 fijos y 2 vivos', async () => {
    const s = await crearSala(e, 1)
    const r = await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)
    expect(r.statusCode).toBe(200)
    const t = r.json()
    expect(t.proyectos_fijos).toHaveLength(8)
    expect(t.proyectos_vivos).toHaveLength(2)
    expect(t.alcance.tipo).toBe('sala')
    for (const f of t.proyectos_fijos) {
      expect(typeof f.eje_x).toBe('number')
      expect(typeof f.eje_y).toBe('number')
    }
  })

  it('con cookie admin y sin t responde 200', async () => {
    const s = await crearSala(e, 1)
    const r = await e.app.inject({ url: `/api/tablero/${s.id}`, headers: { cookie: e.cookie } })
    expect(r.statusCode).toBe(200)
  })

  it('un token de participante no abre el tablero', async () => {
    const s = await salaAbierta(1)
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const r = await e.app.inject({ url: `/api/tablero/${s.id}`, headers: { 'x-participante-token': a.token } })
    expect(r.statusCode).toBe(401)
    expect((await e.app.inject(`/api/tablero/${s.id}?t=${a.token}`)).statusCode).toBe(401)
  })

  it('alcance=mesa&mesa=<id> filtra n_votos a esa mesa', async () => {
    const s = await salaAbierta(2, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const b = await inscrito(s.mesas[0].codigo, 'b@correo.co')
    const c = await inscrito(s.mesas[1].codigo, 'c@correo.co')
    for (const x of [a, b, c]) await votarAmbos(x.token)
    const n = async (q: string) =>
      ((await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}${q}`)).json().proyectos_vivos as { rondas: { n_votos: number }[] }[]).map((p) => p.rondas[0].n_votos)
    expect(await n('')).toEqual([3, 3])
    expect(await n(`&alcance=mesa&mesa=${s.mesas[0].id}`)).toEqual([2, 2])
    expect(await n(`&alcance=mesa&mesa=${s.mesas[1].id}`)).toEqual([1, 1])
    const m = (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}&alcance=mesa&mesa=${s.mesas[1].id}`)).json()
    expect(m.alcance).toMatchObject({ tipo: 'mesa', mesa_id: s.mesas[1].id })
  })

  it('alcance=mesa con una mesa de otra sala responde 404', async () => {
    const s = await crearSala(e, 1)
    const otra = await crearSala(e, 1)
    const r = await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}&alcance=mesa&mesa=${otra.mesas[0].id}`)
    expect(r.statusCode).toBe(404)
  })

  it('responde ETag y 304; la ETag cambia con un voto nuevo', async () => {
    const s = await salaAbierta(1, 'r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const url = `/api/tablero/${s.id}?t=${s.token_tablero}`
    const r = await e.app.inject(url)
    const etag = r.headers.etag as string
    expect(etag).toBe(`"${r.json().version}"`)
    const r2 = await e.app.inject({ url, headers: { 'if-none-match': etag } })
    expect(r2.statusCode).toBe(304)
    expect(r2.body).toBe('')
    await votar(e, a.token, 'insumex', 1)
    const r3 = await e.app.inject({ url, headers: { 'if-none-match': etag } })
    expect(r3.statusCode).toBe(200)
    expect(r3.headers.etag).not.toBe(etag)
  })

  it('la ETag del alcance mesa difiere de la del alcance sala', async () => {
    const s = await crearSala(e, 1)
    const sala = await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)
    const mesa = await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}&alcance=mesa&mesa=${s.mesas[0].id}`)
    expect(sala.headers.etag).not.toBe(mesa.headers.etag)
  })
})
