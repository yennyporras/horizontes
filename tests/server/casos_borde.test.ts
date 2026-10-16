// Casos borde del taller (R3): inscripción tardía en R2, participante desactivado, doble pestaña,
// reloj del cliente desfasado y reinicio de ronda. Todo por la API pública con el reloj simulado.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Entorno, RESPUESTAS_5, T0, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeAll(async () => {
  e = await crearEntorno()
})
afterAll(() => e.app.close())

const RESPUESTAS_9 = Object.fromEntries(Object.keys(RESPUESTAS_5).map((k) => [k, 9]))
const detalle = async (id: string) => (await e.app.inject({ url: `/api/admin/salas/${id}`, headers: { cookie: e.cookie } })).json()
const config = (id: string, payload: object) => e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${id}/config`, headers: { cookie: e.cookie }, payload })
const yo = (token: string, etag?: string) => e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token, ...(etag ? { 'if-none-match': etag } : {}) } })
const tablero = async (s: { id: string; token_tablero: string }, q = '') => (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}${q}`)).json()
const editar = (id: string, payload: object) => e.app.inject({ method: 'PATCH', url: `/api/admin/participantes/${id}`, headers: { cookie: e.cookie }, payload })
const inscrito = async (codigo: string, correo: string) => (await inscribir(e, codigo, correo)).json() as { token: string; participante: { id: string; perfil: { id: string } } }
const votarAmbos = async (token: string, ronda: number, r: object = RESPUESTAS_5) => {
  expect((await votar(e, token, 'insumex', ronda, r)).statusCode).toBe(200)
  expect((await votar(e, token, 'nutriwhat', ronda, r)).statusCode).toBe(200)
}
const nVotos = (t: any, ronda: number) => t.proyectos_vivos.map((p: any) => p.rondas.find((r: any) => r.ronda === ronda)?.n_votos)

async function sala(estado: 'r1_abierta' | 'r2_abierta', mesas = 1) {
  const s = await crearSala(e, mesas)
  await accion(e, s.id, 'abrir_inscripcion')
  await accion(e, s.id, 'abrir_ronda_1')
  if (estado === 'r2_abierta') {
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
  }
  return s
}

describe('inscripción tardía en R2', () => {
  it('entra con perfil balanceado, ve las 12 hojas, solo vota R2 y no altera la R1', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const b = await inscrito(s.mesas[0].codigo, 'b@correo.co')
    await votarAmbos(a.token, 1)
    await votarAmbos(b.token, 1, RESPUESTAS_9)
    await accion(e, s.id, 'cerrar_ronda_1')
    const r1Antes = (await tablero(s)).proyectos_vivos
    await accion(e, s.id, 'abrir_ronda_2')
    await votarAmbos(a.token, 2)
    await votarAmbos(b.token, 2)
    expect((await tablero(s)).progreso.precierre).toBe(true)

    // Llega tarde: tercer perfil del catálogo, sala en precierre se deshace.
    const tarde = await inscribir(e, s.mesas[0].codigo, 'tarde@correo.co')
    expect(tarde.statusCode).toBe(201)
    const t = tarde.json()
    expect(t.participante.perfil.id).not.toBe(a.participante.perfil.id)
    expect(t.participante.perfil.id).not.toBe(b.participante.perfil.id)
    const tab = await tablero(s)
    expect(tab.progreso).toMatchObject({ inscritos: 3, completos: 2, precierre: false })

    const y = (await yo(t.token)).json()
    expect(y.sala.estado).toBe('r2_abierta')
    expect(y.contenido.hojas).toHaveLength(12)
    expect(y.contenido.hojas[0].perfil_id).toBe(t.participante.perfil.id)
    expect(y.pendientes).toEqual(['insumex', 'nutriwhat'])

    // No puede votar la R1 cerrada; sí la R2.
    const r1 = await votar(e, t.token, 'insumex', 1)
    expect(r1.statusCode).toBe(409)
    expect(r1.json().error.codigo).toBe('RONDA_CERRADA')
    await votarAmbos(t.token, 2, RESPUESTAS_9)

    const fin = await tablero(s)
    expect(fin.progreso.precierre).toBe(true)
    expect(nVotos(fin, 2)).toEqual([3, 3])
    // La R1 queda igual: 2 votos y los mismos puntos.
    expect(nVotos(fin, 1)).toEqual([2, 2])
    expect(fin.proyectos_vivos.map((p: any) => p.rondas[0])).toEqual(r1Antes.map((p: any) => p.rondas[0]))
    // Ve la comparación R1 → R2 en su resultado preliminar (alcance mesa en precierre).
    const res = (await e.app.inject({ url: '/api/resultados', headers: { 'x-participante-token': t.token } })).json()
    expect(res.preliminar).toBe(true)
    expect(res.proyectos_vivos[0].rondas.map((r: any) => r.ronda)).toEqual([1, 2])
  })

  it('con la R2 cerrada ya no se inscribe nadie nuevo, pero quien estaba recupera su sesión', async () => {
    const s = await sala('r2_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await accion(e, s.id, 'cerrar_ronda_2')
    const nuevo = await inscribir(e, s.mesas[0].codigo, 'nuevo@correo.co')
    expect(nuevo.statusCode).toBe(409)
    expect(nuevo.json().error.codigo).toBe('INSCRIPCION_CERRADA')
    const rec = await inscribir(e, s.mesas[0].codigo, 'a@correo.co')
    expect(rec.statusCode).toBe(409)
    expect(rec.json().participante.id).toBe(a.participante.id)
  })
})

describe('participante desactivado', () => {
  it('no vota, no ve resultados, sale del progreso y de los promedios; al reactivarlo vuelve todo', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const b = await inscrito(s.mesas[0].codigo, 'b@correo.co')
    await votarAmbos(a.token, 1)
    await votarAmbos(b.token, 1, RESPUESTAS_9)
    const etag = (await yo(b.token)).headers.etag as string

    expect((await editar(b.participante.id, { activo: false })).statusCode).toBe(200)
    // Su celular se entera en el siguiente polling.
    const y = await yo(b.token, etag)
    expect(y.statusCode).toBe(200)
    expect(y.json().participante.activo).toBe(false)
    expect(y.json().resultados).toBeNull()
    expect((await e.app.inject({ url: '/api/resultados', headers: { 'x-participante-token': b.token } })).statusCode).toBe(403)
    const v = await votar(e, b.token, 'insumex', 1)
    expect(v.statusCode).toBe(403)
    expect(v.json().error.codigo).toBe('PARTICIPANTE_INACTIVO')

    let t = await tablero(s)
    expect(t.progreso).toMatchObject({ inscritos: 1, completos: 1, precierre: true })
    expect(nVotos(t, 1)).toEqual([1, 1])
    expect(t.proyectos_vivos[0].rondas[0].promedios.alineacion_core).toBe(5)

    // Recuperar sesión con el mismo correo no lo reactiva: eso solo lo hace el admin.
    const rec = await inscribir(e, s.mesas[0].codigo, 'b@correo.co')
    expect(rec.statusCode).toBe(409)
    expect((await yo(rec.json().token)).json().participante.activo).toBe(false)

    await editar(b.participante.id, { activo: true })
    t = await tablero(s)
    expect(nVotos(t, 1)).toEqual([2, 2])
    expect(t.proyectos_vivos[0].rondas[0].promedios.alineacion_core).toBe(7)
    // Export: votos.csv conserva los votos del desactivado marcados con activo = no (filtrando, Excel cuadra con el tablero).
    await editar(b.participante.id, { activo: false })
    const votos = (await e.app.inject({ url: `/api/admin/salas/${s.id}/export/votos.csv`, headers: { cookie: e.cookie } })).body
    const filas = votos.slice(1).trim().split('\r\n').map((l) => l.split(';'))
    expect(filas[0].at(-1)).toBe('activo')
    expect(filas.slice(1).map((f) => f.at(-1)).sort()).toEqual(['no', 'no', 'si', 'si'])
  })
})

describe('doble pestaña', () => {
  it('dos pestañas con el mismo token votan a la vez: un voto por proyecto, el último gana', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const rs = await Promise.all([
      votar(e, a.token, 'insumex', 1, RESPUESTAS_5),
      votar(e, a.token, 'insumex', 1, RESPUESTAS_9),
      votar(e, a.token, 'nutriwhat', 1, RESPUESTAS_5),
    ])
    expect(rs.map((r) => r.statusCode)).toEqual([200, 200, 200])
    const y = (await yo(a.token)).json()
    expect(y.mis_votos).toHaveLength(2)
    expect(y.completo_ronda).toBe(true)
    const t = await tablero(s)
    expect(nVotos(t, 1)).toEqual([1, 1])
    expect([5, 9]).toContain(t.proyectos_vivos[0].rondas[0].promedios.alineacion_core)
  })

  it('las dos pestañas comparten ETag: la segunda recibe 304 y ambas ven el cambio a la vez', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    const p1 = await yo(a.token)
    const etag = p1.headers.etag as string
    expect((await yo(a.token, etag)).statusCode).toBe(304)
    await votar(e, a.token, 'insumex', 1)
    const [x, z] = await Promise.all([yo(a.token, etag), yo(a.token, etag)])
    expect([x.statusCode, z.statusCode]).toEqual([200, 200])
    expect(x.json().mis_votos).toEqual(z.json().mis_votos)
  })

  it('inscribirse dos veces a la vez con el mismo correo deja un solo participante', async () => {
    const s = await sala('r1_abierta')
    const rs = await Promise.all([inscribir(e, s.mesas[0].codigo, 'doble@correo.co'), inscribir(e, s.mesas[0].codigo, 'DOBLE@correo.co')])
    expect(rs.map((r) => r.statusCode).sort()).toEqual([201, 409])
    expect(rs[0].json().participante.id).toBe(rs[1].json().participante.id)
    expect((await detalle(s.id)).participantes).toHaveLength(1)
    // Solo el último token sirve: la otra pestaña queda con sesión vencida y debe recuperarla.
    const ultimo = rs.find((r) => r.statusCode === 409)!.json().token
    const primero = rs.find((r) => r.statusCode === 201)!.json().token
    expect((await yo(ultimo)).statusCode).toBe(200)
    expect((await yo(primero)).statusCode).toBe(401)
  })
})

describe('reloj del cliente desfasado', () => {
  it('el servidor decide con su hora: un cierre programado vencido cierra aunque el celular crea que falta', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    expect((await config(s.id, { cierre_programado_ronda_at: new Date(T0 + 60_000).toISOString() })).statusCode).toBe(200)
    e.reloj.ms = T0 + 60_000
    // El cliente no manda hora: el voto llega después del cierre según el servidor.
    const v = await votar(e, a.token, 'insumex', 1)
    expect(v.statusCode).toBe(409)
    expect(v.json().error.codigo).toBe('RONDA_CERRADA')
    e.reloj.ms = T0
  })

  it('una hora de cierre en el pasado del servidor se rechaza con 422 HORA_PASADA (admin con el reloj adelantado)', async () => {
    const s = await sala('r1_abierta')
    e.reloj.ms = T0 + 10 * 60_000
    for (const campo of ['cierre_programado_ronda_at', 'cierre_programado_sala_at']) {
      // El computador del admin cree que son las 14:00 y programa las 14:05; el servidor ya va en 14:10.
      const r = await config(s.id, { [campo]: '2026-10-20T14:05:00-05:00' })
      expect(r.statusCode).toBe(422)
      expect(r.json().error.codigo).toBe('HORA_PASADA')
      expect(r.json().error.mensaje).toContain('14:10:00')
    }
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
    expect((await config(s.id, { cierre_programado_ronda_at: '2026-10-20T14:15:00-05:00' })).statusCode).toBe(200)
    e.reloj.ms = T0
  })

  it('el detalle de sala trae servidor_at para que el panel calcule el desfase', async () => {
    const s = await sala('r1_abierta')
    e.reloj.ms = T0 + 90_000
    expect((await detalle(s.id)).servidor_at).toBe('2026-10-20T14:01:30-05:00')
    e.reloj.ms = T0
  })
})

describe('reinicio de ronda', () => {
  it('en R1 abierta borra los votos, quita el precierre y los celulares lo ven en el siguiente polling', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await votarAmbos(a.token, 1)
    const etag = (await yo(a.token)).headers.etag as string
    expect((await tablero(s)).progreso.precierre).toBe(true)

    expect((await accion(e, s.id, 'reiniciar_ronda')).statusCode).toBe(200)
    const y = await yo(a.token, etag)
    expect(y.statusCode).toBe(200)
    expect(y.json()).toMatchObject({ mis_votos: [], pendientes: ['insumex', 'nutriwhat'], completo_ronda: false, resultados: null })
    const t = await tablero(s)
    expect(t.progreso).toMatchObject({ completos: 0, precierre: false })
    expect(t.proyectos_vivos[0].rondas[0]).toMatchObject({ n_votos: 0, eje_x: null, eje_y: null })
    const ev = (await detalle(s.id)).eventos[0]
    expect(ev).toMatchObject({ tipo: 'reinicio', detalle: { ronda: 1, votos_borrados: 2 } })
    // Se vuelve a votar y el precierre vuelve.
    await votarAmbos(a.token, 1, RESPUESTAS_9)
    expect((await tablero(s)).progreso.precierre).toBe(true)
  })

  it('reiniciar la R1 con la R2 abierta borra solo la R1; la R2 sigue intacta', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await votarAmbos(a.token, 1)
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    await votarAmbos(a.token, 2)
    expect((await accion(e, s.id, 'reiniciar_ronda', { ronda: 1 })).statusCode).toBe(200)
    const t = await tablero(s)
    expect(nVotos(t, 1)).toEqual([0, 0])
    expect(nVotos(t, 2)).toEqual([1, 1])
    expect((await detalle(s.id)).sala.estado).toBe('r2_abierta')
  })

  it('reiniciar una ronda que no existe o con un valor que no es 1 ni 2 responde error sin borrar nada', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await votarAmbos(a.token, 1)
    for (const ronda of [2, 0, 'uno', 1.5]) {
      const r = await accion(e, s.id, 'reiniciar_ronda', { ronda })
      expect(r.statusCode, String(ronda)).toBeGreaterThanOrEqual(400)
      expect(r.statusCode).toBeLessThan(500)
    }
    expect(nVotos(await tablero(s), 1)).toEqual([1, 1])
  })

  it('reiniciar y reabrir la R1 ya cerrada permite repetirla', async () => {
    const s = await sala('r1_abierta')
    const a = await inscrito(s.mesas[0].codigo, 'a@correo.co')
    await votarAmbos(a.token, 1)
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'reiniciar_ronda')
    expect((await detalle(s.id)).sala.estado).toBe('r1_cerrada')
    await accion(e, s.id, 'reabrir_ronda')
    await votarAmbos(a.token, 1, RESPUESTAS_9)
    await accion(e, s.id, 'cerrar_ronda_1')
    expect((await tablero(s)).proyectos_vivos[0].rondas[0].promedios.alineacion_core).toBe(9)
  })
})
