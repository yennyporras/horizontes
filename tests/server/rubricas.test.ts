// Rúbricas editables por el admin: GET y PUT /api/admin/salas/{id}/rubricas, solo sin votos, y salas nuevas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reiniciarSalaLimpia } from '../../server/dominio/mantenimiento'
import { semilla } from '../../server/dominio/semilla'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

type Nivel = { valor: number; texto: string }
type Rubricas = { criterios: { id: string; nombre: string; pregunta: string; rubrica: Nivel[] }[]; editable: boolean; motivo_no_editable?: string }

const NUEVA: Nivel[] = [
  { valor: 9, texto: 'Inversión muy alta (> USD 2MM)' },
  { valor: 7, texto: 'Inversión alta (USD 500k - 2MM)' },
  { valor: 5, texto: 'Inversión moderada (USD 150k - 500k)' },
  { valor: 3, texto: 'Inversión media-baja (USD 50k - 150k)' },
  { valor: 1, texto: 'Inversión baja (< USD 50k)' },
]

const leer = (salaId: string, cookie: string | null = e.cookie) =>
  e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}/rubricas`, headers: cookie ? { cookie } : {} })
const guardar = (salaId: string, cuerpo: object, criterio = 'inversion_requerida', cookie: string | null = e.cookie) =>
  e.app.inject({ method: 'PUT', url: `/api/admin/salas/${salaId}/rubricas/${criterio}`, payload: cuerpo, headers: cookie ? { cookie } : {} })
const rubricaDe = (r: Rubricas, criterio = 'inversion_requerida') => r.criterios.find((c) => c.id === criterio)!.rubrica
const version = (salaId: string) => (e.db.prepare('SELECT version FROM salas WHERE id = ?').get(salaId) as { version: number }).version
const semillaDe = (criterio: string) => semilla().motor.criterios.find((c) => c.id === criterio)!.rubrica

describe('GET /api/admin/salas/{id}/rubricas', () => {
  it('trae los 6 criterios con la rúbrica de la semilla y la sala sin votos es editable', async () => {
    const s = await crearSala(e)
    const r = await leer(s.id)
    expect(r.statusCode).toBe(200)
    const b = r.json() as Rubricas
    expect(b.editable).toBe(true)
    expect(b).not.toHaveProperty('motivo_no_editable')
    expect(b.criterios.map((c) => c.id)).toEqual(semilla().motor.criterios.map((c) => c.id))
    expect(rubricaDe(b)).toEqual(semillaDe('inversion_requerida'))
  })

  it('sala inexistente responde 404 SALA_NO_EXISTE', async () => {
    const r = await leer('s_nada')
    expect(r.statusCode).toBe(404)
    expect(r.json().error.codigo).toBe('SALA_NO_EXISTE')
  })
})

describe('PUT /api/admin/salas/{id}/rubricas/{criterio}', () => {
  it('cambia solo los textos, conserva orden y valores y el participante ve la rúbrica nueva', async () => {
    const s = await crearSala(e)
    await accion(e, s.id, 'abrir_inscripcion')
    const token = (await inscribir(e, s.mesas[0].codigo, 'ana@x.co')).json().token as string
    const antes = await e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': token } })
    const etag = String(antes.headers.etag)
    const v0 = version(s.id)

    // Desordenada a propósito: se guarda en el orden que ya tenía el criterio (9 a 1).
    const r = await guardar(s.id, { rubrica: [...NUEVA].reverse() })
    expect(r.statusCode).toBe(200)
    expect(rubricaDe(r.json())).toEqual(NUEVA)
    expect(version(s.id)).toBe(v0 + 1)

    const despues = await e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': token, 'if-none-match': etag } })
    expect(despues.statusCode).toBe(200)
    const criterios = despues.json().criterios as { id: string; rubrica: Nivel[] }[]
    expect(criterios.find((c) => c.id === 'inversion_requerida')!.rubrica).toEqual(NUEVA)
    // Los demás criterios, los pesos y el motor no cambian.
    for (const c of criterios.filter((x) => x.id !== 'inversion_requerida')) expect(c.rubrica).toEqual(semillaDe(c.id))
    const pesos = (e.db.prepare('SELECT pesos_json FROM contenido_sala WHERE sala_id = ?').get(s.id) as { pesos_json: string }).pesos_json
    expect(JSON.parse(pesos)).toEqual(semilla().motor.pesos)
  })

  it('recorta los textos y quita las rayas', async () => {
    const s = await crearSala(e)
    const conRaya = NUEVA.map((n, i) => (i === 0 ? { ...n, texto: '  Inversión muy alta — largo plazo  ' } : n))
    const r = await guardar(s.id, { rubrica: conRaya })
    expect(r.statusCode).toBe(200)
    expect(rubricaDe(r.json())[0].texto).toBe('Inversión muy alta, largo plazo')
  })

  it('registra el evento rubrica_editada con el criterio, si se aplicó a salas nuevas y quién lo hizo', async () => {
    const s = await crearSala(e)
    expect((await guardar(s.id, { rubrica: NUEVA, usar_en_salas_nuevas: true })).statusCode).toBe(200)
    const d = (await e.app.inject({ method: 'GET', url: `/api/admin/salas/${s.id}`, headers: { cookie: e.cookie } })).json()
    expect(d.eventos[0]).toMatchObject({ tipo: 'rubrica_editada', por: 'admin:paola', detalle: { criterio_id: 'inversion_requerida', usar_en_salas_nuevas: true } })
  })

  const niveles = (cambio: (n: Nivel[]) => unknown[]) => cambio(NUEVA.map((n) => ({ ...n })))
  it.each([
    ['falta un valor', niveles((n) => n.slice(0, 4))],
    ['valor repetido', niveles((n) => [...n.slice(0, 4), { valor: 7, texto: 'Otra' }])],
    ['valor fuera de la escala', niveles((n) => [...n.slice(0, 4), { valor: 2, texto: 'Otra' }])],
    ['un nivel sin objeto', niveles((n) => [...n.slice(0, 4), null])],
    ['texto vacío', niveles((n) => [{ valor: 9, texto: '   ' }, ...n.slice(1)])],
    ['texto que no es texto', niveles((n) => [{ valor: 9, texto: 9 }, ...n.slice(1)])],
    ['texto de más de 300 caracteres', niveles((n) => [{ valor: 9, texto: 'a'.repeat(301) }, ...n.slice(1)])],
    ['etiqueta HTML', niveles((n) => [{ valor: 9, texto: 'Alta <b>muy</b>' }, ...n.slice(1)])],
    ['llaves', niveles((n) => [{ valor: 9, texto: 'Alta {x}' }, ...n.slice(1)])],
    ['salto de línea', niveles((n) => [{ valor: 9, texto: 'Alta\nmuy alta' }, ...n.slice(1)])],
    ['carácter de control', niveles((n) => [{ valor: 9, texto: 'Alta\u0007' }, ...n.slice(1)])],
    ['rúbrica que no es lista', 'nueve'],
  ])('%s responde 422 RUBRICA_INVALIDA', async (_caso, rubrica) => {
    const s = await crearSala(e)
    const v0 = version(s.id)
    const r = await guardar(s.id, { rubrica })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('RUBRICA_INVALIDA')
    expect(r.json().error.mensaje).toMatch(/\S/)
    expect(version(s.id)).toBe(v0)
    expect(rubricaDe((await leer(s.id)).json())).toEqual(semillaDe('inversion_requerida'))
  })

  it('300 caracteres justos sí se aceptan', async () => {
    const s = await crearSala(e)
    expect((await guardar(s.id, { rubrica: [{ valor: 9, texto: 'a'.repeat(300) }, ...NUEVA.slice(1)] })).statusCode).toBe(200)
  })

  it('usar_en_salas_nuevas que no es booleano responde 422', async () => {
    const s = await crearSala(e)
    const r = await guardar(s.id, { rubrica: NUEVA, usar_en_salas_nuevas: 'si' })
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('RUBRICA_INVALIDA')
  })

  it('criterio que no existe en la sala responde 422 CRITERIO_NO_EXISTE', async () => {
    const s = await crearSala(e)
    const r = await guardar(s.id, { rubrica: NUEVA }, 'tam')
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('CRITERIO_NO_EXISTE')
  })

  it('con votos responde 409 RUBRICA_CON_VOTOS y la rúbrica no cambia; sin votos vuelve a ser editable', async () => {
    const s = await crearSala(e)
    await accion(e, s.id, 'abrir_ronda_1')
    const token = (await inscribir(e, s.mesas[0].codigo, 'ana@x.co')).json().token as string
    expect((await votar(e, token, 'insumex', 1)).statusCode).toBe(200)

    const r = await guardar(s.id, { rubrica: NUEVA })
    expect(r.statusCode).toBe(409)
    expect(r.json().error).toMatchObject({ codigo: 'RUBRICA_CON_VOTOS', mensaje: expect.stringContaining('ya tiene votos') })
    const b = (await leer(s.id)).json() as Rubricas
    expect(b.editable).toBe(false)
    expect(b.motivo_no_editable).toBe(r.json().error.mensaje)
    expect(rubricaDe(b)).toEqual(semillaDe('inversion_requerida'))

    // Reiniciar la ronda borra sus votos: la sala vuelve a quedar sin votos.
    expect((await accion(e, s.id, 'reiniciar_ronda')).statusCode).toBe(200)
    expect((await leer(s.id)).json().editable).toBe(true)
    expect((await guardar(s.id, { rubrica: NUEVA })).statusCode).toBe(200)
  })

  it('sin sesión responde 401 SESION_REQUERIDA', async () => {
    const s = await crearSala(e)
    for (const r of [await leer(s.id, null), await guardar(s.id, { rubrica: NUEVA }, 'inversion_requerida', null)]) {
      expect(r.statusCode).toBe(401)
      expect(r.json().error.codigo).toBe('SESION_REQUERIDA')
    }
  })

  it('un admin (no superadmin) también puede editar', async () => {
    const s = await crearSala(e)
    const alta = await e.app.inject({
      method: 'POST',
      url: '/api/admin/admins',
      headers: { cookie: e.cookie },
      payload: { usuario: 'jorge', nombre: 'Jorge Puentes', correo: 'jorge@estratek.com.co', clave_temporal: 'temporal123' },
    })
    expect(alta.statusCode).toBe(201)
    const cookie = await loginCookie(e.app, 'jorge', 'temporal123')
    await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie }, payload: { actual: 'temporal123', nueva: 'definitiva456' } })
    expect((await guardar(s.id, { rubrica: NUEVA }, 'inversion_requerida', cookie)).statusCode).toBe(200)
  })
})

describe('salas nuevas, duplicadas y reiniciadas', () => {
  it('usar_en_salas_nuevas aplica a las salas creadas después y no a las existentes', async () => {
    const a = await crearSala(e, 1, 'A')
    const existente = await crearSala(e, 1, 'Existente')
    expect((await guardar(a.id, { rubrica: NUEVA, usar_en_salas_nuevas: true })).statusCode).toBe(200)
    // Otra edición sin la casilla no cambia el valor por defecto de la plantilla.
    const otra = NUEVA.map((n) => ({ ...n, texto: `${n.texto} (solo sala A)` }))
    expect((await guardar(a.id, { rubrica: otra })).statusCode).toBe(200)

    const nueva = await crearSala(e, 1, 'Nueva')
    expect(rubricaDe((await leer(nueva.id)).json())).toEqual(NUEVA)
    expect(rubricaDe((await leer(existente.id)).json())).toEqual(semillaDe('inversion_requerida'))
    expect(rubricaDe((await leer(nueva.id)).json(), 'regulacion')).toEqual(semillaDe('regulacion'))
  })

  it('sin la casilla las salas nuevas siguen con la rúbrica de la semilla', async () => {
    const a = await crearSala(e, 1, 'A')
    expect((await guardar(a.id, { rubrica: NUEVA, usar_en_salas_nuevas: false })).statusCode).toBe(200)
    const nueva = await crearSala(e, 1, 'Nueva')
    expect(rubricaDe((await leer(nueva.id)).json())).toEqual(semillaDe('inversion_requerida'))
  })

  it('duplicar copia las rúbricas de la sala original', async () => {
    const a = await crearSala(e, 1, 'Original')
    expect((await guardar(a.id, { rubrica: NUEVA })).statusCode).toBe(200)
    const d = await e.app.inject({ method: 'POST', url: `/api/admin/salas/${a.id}/duplicar`, headers: { cookie: e.cookie }, payload: {} })
    expect(d.statusCode).toBe(201)
    expect(rubricaDe((await leer(d.json().id)).json())).toEqual(NUEVA)
  })

  it('el reinicio limpio de la sala conserva sus rúbricas', async () => {
    const a = await crearSala(e, 1, 'Taller')
    expect((await guardar(a.id, { rubrica: NUEVA })).statusCode).toBe(200)
    reiniciarSalaLimpia(e.db, a.id, e.reloj.ms)
    expect(rubricaDe((await leer(a.id)).json())).toEqual(NUEVA)
  })
})
