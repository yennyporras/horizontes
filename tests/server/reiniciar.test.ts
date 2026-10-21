// Reiniciar a elección del administrador (decisión 3 de Paola, 21-oct): volver a la ronda anterior, reiniciar la ronda 2,
// reiniciar la ronda 1 (con la 2) y reiniciar la sala completa, por POST /api/admin/salas/{id}/acciones.
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { construirApp } from '../../server/app'
import { abrirDb } from '../../server/db/index'
import { asegurarSuperadmin } from '../../server/dominio/admins'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const cuenta = (tabla: string, donde: string, ...p: unknown[]) =>
  Number((e.db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${donde}`).get(...(p as never[])) as { n: number }).n)
const votosDe = (salaId: string, ronda: number) => cuenta('votos', 'sala_id = ? AND ronda = ?', salaId, ronda)
const fila = (salaId: string) => e.db.prepare('SELECT estado, ronda_actual, revelar_hojas, version, token_tablero FROM salas WHERE id = ?').get(salaId) as {
  estado: string
  ronda_actual: number
  revelar_hojas: number
  version: number
  token_tablero: string
}
const ultimoEvento = (salaId: string) => {
  const ev = e.db.prepare('SELECT tipo, por, detalle_json FROM eventos WHERE sala_id = ? ORDER BY id DESC LIMIT 1').get(salaId) as { tipo: string; por: string; detalle_json: string }
  return { tipo: ev.tipo, por: ev.por, detalle: JSON.parse(ev.detalle_json) }
}
const tablero = async (s: { id: string; token_tablero: string }) => (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)).json()
const nVotos = (t: any, ronda: number) => t.proyectos_vivos.map((p: any) => p.rondas.find((r: any) => r.ronda === ronda)?.n_votos ?? 0)

/** Sala de 2 mesas con 3 personas que votaron la R1 y, si se pide, la R2. Deja la sala en el estado pedido. */
async function sala(estado: 'r1_abierta' | 'r1_cerrada' | 'r2_abierta' | 'r2_cerrada' | 'cerrada', nombre = 'Taller Reinicio') {
  const s = await crearSala(e, 2, nombre)
  await accion(e, s.id, 'abrir_inscripcion')
  const tokens: string[] = []
  for (const correo of ['a@x.co', 'b@x.co', 'c@x.co']) tokens.push((await inscribir(e, s.mesas[0].codigo, correo)).json().token)
  await accion(e, s.id, 'abrir_ronda_1')
  for (const t of tokens) for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, t, p, 1)).statusCode).toBe(200)
  if (estado === 'r1_abierta') return { s, tokens }
  await accion(e, s.id, 'cerrar_ronda_1')
  if (estado === 'r1_cerrada') return { s, tokens }
  await accion(e, s.id, 'abrir_ronda_2')
  for (const t of tokens.slice(0, 2)) for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, t, p, 2)).statusCode).toBe(200)
  await tablero(s) // foto del consolidado de la R2
  if (estado === 'r2_abierta') return { s, tokens }
  await accion(e, s.id, 'cerrar_ronda_2')
  if (estado === 'r2_cerrada') return { s, tokens }
  await accion(e, s.id, 'cerrar_sala')
  return { s, tokens }
}

describe('volver_ronda_anterior', () => {
  it.each(['r2_abierta', 'r2_cerrada'] as const)('desde %s vuelve a la ronda 1 abierta y conserva todos los votos', async (estado) => {
    const { s } = await sala(estado)
    const antes = fila(s.id)
    expect(antes.revelar_hojas).toBe(1)
    const r = await accion(e, s.id, 'volver_ronda_anterior')
    expect(r.statusCode).toBe(200)
    expect(r.json().sala).toMatchObject({ estado: 'r1_abierta', ronda_actual: 1 })
    const f = fila(s.id)
    expect(f).toMatchObject({ estado: 'r1_abierta', ronda_actual: 1, revelar_hojas: 0 })
    expect(f.version).toBeGreaterThan(antes.version)
    expect([votosDe(s.id, 1), votosDe(s.id, 2)]).toEqual([6, 4])
    expect(ultimoEvento(s.id)).toEqual({ tipo: 'ronda_anterior', por: 'admin:paola', detalle: { accion: 'volver_ronda_anterior', desde: estado, hacia: 'r1_abierta', ronda: 1 } })
    // La ronda 1 vuelve a recibir votos (y a estar oculta en el tablero público hasta que todos voten o se cierre).
    const t = await tablero(s)
    expect(t.sala.estado).toBe('r1_abierta')
    expect(t.progreso.precierre).toBe(true)
  })

  it.each(['r1_abierta', 'r1_cerrada'] as const)('desde %s vuelve a la inscripción abierta conservando los votos; abrir la ronda 1 los recupera', async (estado) => {
    const { s, tokens } = await sala(estado)
    const r = await accion(e, s.id, 'volver_ronda_anterior')
    expect(r.statusCode).toBe(200)
    expect(fila(s.id)).toMatchObject({ estado: 'inscripcion', ronda_actual: 0 })
    expect(votosDe(s.id, 1)).toBe(6)
    expect(ultimoEvento(s.id).detalle).toEqual({ accion: 'volver_ronda_anterior', desde: estado, hacia: 'inscripcion' })
    // Con la inscripción abierta, nadie vota: la ronda 1 no está abierta.
    expect((await votar(e, tokens[0], 'insumex', 1)).statusCode).toBe(409)
    expect((await inscribir(e, s.mesas[1].codigo, 'nueva@x.co')).statusCode).toBe(201)
    expect((await accion(e, s.id, 'abrir_ronda_1')).statusCode).toBe(200)
    await accion(e, s.id, 'cerrar_ronda_1')
    expect(nVotos(await tablero(s), 1)).toEqual([3, 3])
  })

  it.each(['preparada', 'inscripcion', 'cerrada'] as const)('desde %s responde 409 TRANSICION_INVALIDA', async (estado) => {
    const s = estado === 'cerrada' ? (await sala('cerrada')).s : await crearSala(e, 1)
    if (estado === 'inscripcion') await accion(e, s.id, 'abrir_inscripcion')
    const r = await accion(e, s.id, 'volver_ronda_anterior')
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('TRANSICION_INVALIDA')
    expect(r.json().error.mensaje).toMatch(/^No se puede volver a la ronda anterior: la sala está /)
  })
})

describe('reiniciar_desde_ronda', () => {
  it.each(['r2_abierta', 'r2_cerrada'] as const)('ronda 2 desde %s: borra solo los votos y las fotos de la ronda 2 y la deja abierta', async (estado) => {
    const { s } = await sala(estado)
    expect(cuenta('fotos_agregado', 'sala_id = ? AND ronda = 2', s.id)).toBeGreaterThan(0)
    const r = await accion(e, s.id, 'reiniciar_desde_ronda', { ronda: 2 })
    expect(r.statusCode).toBe(200)
    expect(fila(s.id)).toMatchObject({ estado: 'r2_abierta', ronda_actual: 2, revelar_hojas: 1 })
    expect([votosDe(s.id, 1), votosDe(s.id, 2)]).toEqual([6, 0])
    expect(cuenta('fotos_agregado', 'sala_id = ? AND ronda = 2', s.id)).toBe(0)
    expect(ultimoEvento(s.id)).toMatchObject({ tipo: 'reinicio_ronda', detalle: { accion: 'reiniciar_desde_ronda', desde: estado, hacia: 'r2_abierta', ronda: 2, rondas_borradas: [2], votos_borrados: 4 } })
    const t = await tablero(s)
    expect(nVotos(t, 2)).toEqual([0, 0])
    expect(nVotos(t, 1)).toEqual([3, 3])
  })

  it.each(['r1_abierta', 'r1_cerrada', 'r2_abierta', 'r2_cerrada'] as const)('ronda 1 desde %s: borra las dos rondas y deja la ronda 1 abierta', async (estado) => {
    const { s, tokens } = await sala(estado)
    const r = await accion(e, s.id, 'reiniciar_desde_ronda', { ronda: 1 })
    expect(r.statusCode).toBe(200)
    expect(fila(s.id)).toMatchObject({ estado: 'r1_abierta', ronda_actual: 1, revelar_hojas: 0 })
    expect([votosDe(s.id, 1), votosDe(s.id, 2)]).toEqual([0, 0])
    expect(cuenta('fotos_agregado', 'sala_id = ?', s.id)).toBe(0)
    expect(ultimoEvento(s.id).detalle).toMatchObject({ rondas_borradas: [1, 2], hacia: 'r1_abierta', ronda: 1 })
    expect(nVotos(await tablero(s), 1)).toEqual([0, 0])
    // Los inscritos siguen y vuelven a votar la ronda 1.
    expect((await votar(e, tokens[0], 'insumex', 1)).statusCode).toBe(200)
  })

  it('valida la ronda (422) y el estado (409); con la sala cerrada no aplica', async () => {
    const { s } = await sala('r1_cerrada')
    for (const ronda of [undefined, 0, 3, '1']) {
      const r = await accion(e, s.id, 'reiniciar_desde_ronda', ronda === undefined ? {} : { ronda })
      expect(r.statusCode).toBe(422)
      expect(r.json().error.codigo).toBe('RONDA_INVALIDA')
    }
    const r2 = await accion(e, s.id, 'reiniciar_desde_ronda', { ronda: 2 })
    expect(r2.statusCode).toBe(409)
    expect(r2.json().error.mensaje).toBe('No se puede reiniciar la ronda 2: la sala está con la ronda 1 cerrada.')
    expect(votosDe(s.id, 1)).toBe(6)
    const cerrada = (await sala('cerrada', 'Otra')).s
    expect((await accion(e, cerrada.id, 'reiniciar_desde_ronda', { ronda: 1 })).statusCode).toBe(409)
  })

  it('reiniciar_ronda (el de antes) sigue igual: borra la ronda pedida sin cambiar el estado', async () => {
    const { s } = await sala('r2_cerrada')
    expect((await accion(e, s.id, 'reiniciar_ronda', { ronda: 1 })).statusCode).toBe(200)
    expect(fila(s.id).estado).toBe('r2_cerrada')
    expect([votosDe(s.id, 1), votosDe(s.id, 2)]).toEqual([0, 4])
  })
})

describe('reiniciar_sala', () => {
  it('con el nombre exacto borra los votos de las dos rondas y vuelve a inscripción, con mesas, inscritos y enlace del tablero', async () => {
    const { s, tokens } = await sala('r2_cerrada')
    const antes = fila(s.id)
    const inscritos = cuenta('participantes', 'sala_id = ?', s.id)
    const consentimientos = cuenta('consentimientos', `participante_id IN (SELECT id FROM participantes WHERE sala_id = ?)`, s.id)
    const r = await accion(e, s.id, 'reiniciar_sala', { confirmar: ' Taller Reinicio ' })
    expect(r.statusCode).toBe(200)
    expect(r.json().sala).toMatchObject({ estado: 'inscripcion', ronda_actual: 0 })
    expect(fila(s.id)).toMatchObject({ estado: 'inscripcion', ronda_actual: 0, revelar_hojas: 0, token_tablero: antes.token_tablero })
    expect(cuenta('votos', 'sala_id = ?', s.id)).toBe(0)
    expect(cuenta('fotos_agregado', 'sala_id = ?', s.id)).toBe(0)
    expect(cuenta('participantes', 'sala_id = ?', s.id)).toBe(inscritos)
    expect(cuenta('mesas', 'sala_id = ?', s.id)).toBe(2)
    expect(cuenta('consentimientos', `participante_id IN (SELECT id FROM participantes WHERE sala_id = ?)`, s.id)).toBe(consentimientos)
    expect(ultimoEvento(s.id)).toEqual({ tipo: 'reinicio_sala', por: 'admin:paola', detalle: { accion: 'reiniciar_sala', desde: 'r2_cerrada', hacia: 'inscripcion', votos_borrados: 10 } })
    // El tablero, con la versión nueva, ya no trae lo borrado; los inscritos siguen con su sesión.
    const t = await tablero(s)
    expect(t.version).toBe(`v-${fila(s.id).version}-sala`)
    expect(nVotos(t, 1)).toEqual([0, 0])
    expect((await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': tokens[0] } })).statusCode).toBe(200)
  })

  it('sin el nombre exacto responde 422 CONFIRMACION_INVALIDA y no borra nada; desde preparada, 409', async () => {
    const { s } = await sala('r1_cerrada')
    for (const confirmar of [undefined, '', 'taller reinicio', 'Otra']) {
      const r = await accion(e, s.id, 'reiniciar_sala', confirmar === undefined ? {} : { confirmar })
      expect(r.statusCode).toBe(422)
      expect(r.json().error).toMatchObject({ codigo: 'CONFIRMACION_INVALIDA', mensaje: 'Para reiniciar la sala escribe su nombre exacto: «Taller Reinicio».' })
    }
    expect(votosDe(s.id, 1)).toBe(6)
    expect(fila(s.id).estado).toBe('r1_cerrada')
    const nueva = await crearSala(e, 1, 'Nueva')
    expect((await accion(e, nueva.id, 'reiniciar_sala', { confirmar: 'Nueva' })).statusCode).toBe(409)
  })

  it('también se puede con la sala cerrada o en inscripción, y la usa cualquier admin (no solo el superadmin)', async () => {
    const { s } = await sala('cerrada')
    const creado = await e.app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie: e.cookie }, payload: { usuario: 'nico', nombre: 'Nico', clave_temporal: 'temporal123' } })
    expect(creado.statusCode).toBe(201)
    let cookie = await loginCookie(e.app, 'nico', 'temporal123')
    await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie }, payload: { actual: 'temporal123', nueva: 'definitiva123' } })
    cookie = await loginCookie(e.app, 'nico', 'definitiva123')
    const r = await e.app.inject({ method: 'POST', url: `/api/admin/salas/${s.id}/acciones`, headers: { cookie }, payload: { accion: 'reiniciar_sala', confirmar: 'Taller Reinicio' } })
    expect(r.statusCode).toBe(200)
    expect(fila(s.id).estado).toBe('inscripcion')
    expect(ultimoEvento(s.id).por).toBe('admin:nico')
    expect((await accion(e, s.id, 'reiniciar_sala', { confirmar: 'Taller Reinicio' })).statusCode).toBe(200)
  })
})

describe('respaldo antes de reiniciar', () => {
  async function conArchivo(prueba: (app: Awaited<ReturnType<typeof construirApp>>, cookie: string, dir: string, db: ReturnType<typeof abrirDb>) => Promise<void>, romper = false) {
    const dir = mkdtempSync(join(tmpdir(), 'hz-reinicio-'))
    const dbPath = join(dir, 'h.sqlite')
    if (romper) writeFileSync(join(dir, 'respaldos'), 'no soy una carpeta')
    const db = abrirDb(dbPath)
    asegurarSuperadmin(db, 'paola', 'superclave123', T0)
    const app = await construirApp({ db, dbPath, ahora: () => T0, intervaloCierresMs: 0, baseUrl: 'https://horizontes.test' })
    try {
      await prueba(app, await loginCookie(app, 'paola', 'superclave123'), dir, db)
    } finally {
      await app.close()
      db.close()
      rmSync(dir, { recursive: true, force: true })
    }
  }
  const crear = async (app: Awaited<ReturnType<typeof construirApp>>, cookie: string, nombre: string) => {
    const s = (await app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie }, payload: { nombre, plantilla: 'foodsume_2026', mesas: 1 } })).json()
    const acc = (accion: string, extra: object = {}) => app.inject({ method: 'POST', url: `/api/admin/salas/${s.id}/acciones`, headers: { cookie }, payload: { accion, ...extra } })
    return { s, acc }
  }

  it('reiniciar la sala deja un respaldo «antes_reinicio_sala»; un nombre mal escrito o un 409 no gastan respaldos', async () => {
    await conArchivo(async (app, cookie, dir) => {
      const { s, acc } = await crear(app, cookie, 'Respaldada')
      expect((await acc('reiniciar_sala', { confirmar: 'Respaldada' })).statusCode).toBe(409) // preparada
      expect((await acc('abrir_ronda_1')).statusCode).toBe(200)
      const respaldos = () => readdirSync(join(dir, 'respaldos')).filter((f) => f.includes(s.id))
      const iniciales = respaldos().length
      expect((await acc('reiniciar_sala', { confirmar: 'Mal' })).statusCode).toBe(422)
      expect((await acc('volver_ronda_anterior')).statusCode).toBe(200)
      expect(respaldos()).toHaveLength(iniciales)
      expect((await acc('reiniciar_sala', { confirmar: 'Respaldada' })).statusCode).toBe(200)
      expect(respaldos().filter((f) => f.includes('_antes_reinicio_sala'))).toHaveLength(1)
      expect((await acc('abrir_ronda_1')).statusCode).toBe(200)
      expect((await acc('reiniciar_desde_ronda', { ronda: 1 })).statusCode).toBe(200)
      expect(respaldos().filter((f) => f.includes('_antes_reinicio') && !f.includes('_sala'))).toHaveLength(1)
    })
  })

  it('si el respaldo falla, reiniciar la sala responde 500 RESPALDO_FALLIDO y no borra nada', async () => {
    await conArchivo(async (app, cookie, _dir, db) => {
      const { s, acc } = await crear(app, cookie, 'Sin respaldo')
      expect((await acc('abrir_inscripcion')).statusCode).toBe(200)
      const tok = (
        await app.inject({
          method: 'POST',
          url: '/api/inscripcion',
          payload: { codigoMesa: s.mesas[0].codigo, nombre: 'Ana', correo: 'ana@x.co', consentimiento: { aceptado: true, version: (await app.inject(`/api/mesas/${s.mesas[0].codigo}`)).json().consentimiento.version } },
        })
      ).json().token
      expect((await acc('abrir_ronda_1')).statusCode).toBe(200)
      expect((await app.inject({ method: 'PUT', url: '/api/votos', headers: { 'x-participante-token': tok }, payload: { proyecto_id: 'insumex', ronda: 1, respuestas: { alistamiento_tecnico: 5, conocimiento_cliente: 5, regulacion: 5, capacidades_organizacionales: 5, alineacion_core: 5, inversion_requerida: 5 } } })).statusCode).toBe(200)
      const r = await acc('reiniciar_sala', { confirmar: 'Sin respaldo' })
      expect(r.statusCode).toBe(500)
      expect(r.json().error.codigo).toBe('RESPALDO_FALLIDO')
      expect(db.prepare('SELECT COUNT(*) AS n FROM votos WHERE sala_id = ?').get(s.id)).toEqual({ n: 1 })
      expect((db.prepare('SELECT estado FROM salas WHERE id = ?').get(s.id) as { estado: string }).estado).toBe('r1_abierta')
      expect(existsSync(join(_dir, 'respaldos'))).toBe(true)
    }, true)
  })
})
