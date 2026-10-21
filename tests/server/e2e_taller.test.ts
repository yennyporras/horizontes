// E2E del taller por API (SPEC §3, §4, §5, §6, §9 y §11): matriz completa de la máquina de estados,
// precierre con resultado preliminar, cierres programados de ronda y de sala, hojas reveladas en R2
// y permisos superadmin / admin / participante.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ACCIONES } from '../../server/dominio/estados'
import { type Entorno, RESPUESTAS_5, T0, VISTA_MESA_REGISTRADO, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeAll(async () => {
  e = await crearEntorno()
})
afterAll(() => e.app.close())

const iso = (ms: number) => new Date(ms).toISOString()
const detalle = async (id: string, cookie = e.cookie) => (await e.app.inject({ url: `/api/admin/salas/${id}`, headers: { cookie } })).json()
const config = (id: string, payload: object) => e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${id}/config`, headers: { cookie: e.cookie }, payload })
const yo = (token: string, etag?: string) => e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token, ...(etag ? { 'if-none-match': etag } : {}) } })
const tablero = async (s: { id: string; token_tablero: string }, q = '') => (await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}${q}`)).json()
const resultados = (token: string) => e.app.inject({ url: '/api/resultados', headers: { 'x-participante-token': token } })

type Estado = 'preparada' | 'inscripcion' | 'r1_abierta' | 'r1_cerrada' | 'r2_abierta' | 'r2_cerrada' | 'cerrada'
const CAMINO: Record<Estado, string[]> = {
  preparada: [],
  inscripcion: ['abrir_inscripcion'],
  r1_abierta: ['abrir_inscripcion', 'abrir_ronda_1'],
  r1_cerrada: ['abrir_inscripcion', 'abrir_ronda_1', 'cerrar_ronda_1'],
  r2_abierta: ['abrir_inscripcion', 'abrir_ronda_1', 'cerrar_ronda_1', 'abrir_ronda_2'],
  r2_cerrada: ['abrir_inscripcion', 'abrir_ronda_1', 'cerrar_ronda_1', 'abrir_ronda_2', 'cerrar_ronda_2'],
  cerrada: ['abrir_inscripcion', 'abrir_ronda_1', 'cerrar_ronda_1', 'cerrar_sala'],
}

// Estado al que lleva cada acción permitida (SPEC §3). Lo que no aparece debe responder 409 TRANSICION_INVALIDA.
const PERMITIDAS: Record<Estado, Partial<Record<(typeof ACCIONES)[number], Estado>>> = {
  preparada: { abrir_inscripcion: 'inscripcion', abrir_ronda_1: 'r1_abierta', cerrar_sala: 'cerrada' },
  inscripcion: { abrir_ronda_1: 'r1_abierta', cerrar_sala: 'cerrada', reiniciar_sala: 'inscripcion' },
  r1_abierta: {
    cerrar_ronda_1: 'r1_cerrada',
    reiniciar_ronda: 'r1_abierta',
    cerrar_sala: 'cerrada',
    volver_ronda_anterior: 'inscripcion',
    reiniciar_desde_ronda: 'r1_abierta',
    reiniciar_sala: 'inscripcion',
  },
  r1_cerrada: {
    abrir_ronda_2: 'r2_abierta',
    reabrir_ronda: 'r1_abierta',
    reiniciar_ronda: 'r1_cerrada',
    cerrar_sala: 'cerrada',
    volver_ronda_anterior: 'inscripcion',
    reiniciar_desde_ronda: 'r1_abierta',
    reiniciar_sala: 'inscripcion',
  },
  r2_abierta: {
    cerrar_ronda_2: 'r2_cerrada',
    reiniciar_ronda: 'r2_abierta',
    cerrar_sala: 'cerrada',
    volver_ronda_anterior: 'r1_abierta',
    reiniciar_desde_ronda: 'r1_abierta',
    reiniciar_sala: 'inscripcion',
  },
  r2_cerrada: {
    reabrir_ronda: 'r2_abierta',
    reiniciar_ronda: 'r2_cerrada',
    cerrar_sala: 'cerrada',
    volver_ronda_anterior: 'r1_abierta',
    reiniciar_desde_ronda: 'r1_abierta',
    reiniciar_sala: 'inscripcion',
  },
  cerrada: { reabrir_sala: 'r1_cerrada', reiniciar_sala: 'inscripcion' },
}

// Cuerpo de las acciones que lo piden (21-oct): la ronda a reiniciar y el nombre de la sala.
const CUERPO: Partial<Record<(typeof ACCIONES)[number], object>> = {
  reiniciar_desde_ronda: { ronda: 1 },
  reiniciar_sala: { confirmar: 'Sala de prueba' },
}

describe('máquina de estados: matriz completa estado × acción', () => {
  for (const estado of Object.keys(CAMINO) as Estado[]) {
    for (const a of ACCIONES) {
      const hacia = PERMITIDAS[estado][a]
      it(`${estado} + ${a} → ${hacia ?? '409'}`, async () => {
        const s = await crearSala(e, 1)
        for (const paso of CAMINO[estado]) expect((await accion(e, s.id, paso)).statusCode).toBe(200)
        const antes = await detalle(s.id)
        const r = await accion(e, s.id, a, CUERPO[a])
        const despues = await detalle(s.id)
        if (hacia) {
          expect(r.statusCode, r.body).toBe(200)
          expect(despues.sala.estado).toBe(hacia)
          expect(despues.eventos.length).toBe(antes.eventos.length + 1)
        } else {
          expect(r.statusCode).toBe(409)
          expect(r.json().error.codigo).toBe('TRANSICION_INVALIDA')
          expect(despues.sala.estado).toBe(estado)
          expect(despues.version).toBe(antes.version)
        }
      })
    }
  }

  it('inscripción y votos solo en los estados que dice la SPEC', async () => {
    const inscribe: Record<Estado, boolean> = { preparada: false, inscripcion: true, r1_abierta: true, r1_cerrada: true, r2_abierta: true, r2_cerrada: false, cerrada: false }
    const votaRonda: Record<Estado, number | null> = { preparada: null, inscripcion: null, r1_abierta: 1, r1_cerrada: null, r2_abierta: 2, r2_cerrada: null, cerrada: null }
    for (const estado of Object.keys(CAMINO) as Estado[]) {
      const s = await crearSala(e, 1)
      await accion(e, s.id, 'abrir_inscripcion')
      const { token } = (await inscribir(e, s.mesas[0].codigo, `base-${estado}@prueba.co`)).json()
      for (const paso of CAMINO[estado].slice(1)) await accion(e, s.id, paso)
      if (estado === 'preparada') {
        // No hay forma de volver a preparada: se prueba con una sala nueva.
        const p = await crearSala(e, 1)
        expect((await inscribir(e, p.mesas[0].codigo, 'nadie@prueba.co')).statusCode).toBe(409)
        continue
      }
      expect((await inscribir(e, s.mesas[0].codigo, `nuevo-${estado}@prueba.co`)).statusCode, estado).toBe(inscribe[estado] ? 201 : 409)
      for (const ronda of [1, 2]) {
        const r = await votar(e, token, 'insumex', ronda)
        expect(r.statusCode, `${estado} ronda ${ronda}`).toBe(votaRonda[estado] === ronda ? 200 : 409)
      }
    }
  })
})

describe('taller con precierre, hojas en R2 y cierres programados (reloj simulado)', () => {
  it('recorre el taller completo como lo viviría la sala', async () => {
    e.reloj.ms = T0
    const s = await crearSala(e, 2, 'Taller programado')
    await accion(e, s.id, 'abrir_inscripcion')
    const tokens: string[][] = [[], []]
    for (let i = 0; i < 6; i++) tokens[i % 2].push((await inscribir(e, s.mesas[i % 2].codigo, `t${i}@prueba.co`)).json().token)

    // R1 con cierre programado a los 20 minutos.
    await accion(e, s.id, 'abrir_ronda_1')
    const cierreR1 = T0 + 20 * 60_000
    expect((await config(s.id, { cierre_programado_ronda_at: iso(cierreR1) })).statusCode).toBe(200)
    const r1 = (await yo(tokens[0][0])).json()
    const hojasPropias = r1.contenido.hojas.length
    expect(r1.config.revelar_hojas).toBe(false)
    expect(hojasPropias).toBeGreaterThan(0)
    expect(hojasPropias).toBeLessThan(12)
    expect(r1.contenido.hojas.every((h: { perfil_id: string }) => h.perfil_id === r1.participante.perfil.id)).toBe(true)

    // Mesa 1 completa → precierre de mesa con resultado preliminar; la sala aún no.
    for (const t of tokens[0]) for (const p of ['insumex', 'nutriwhat']) await votar(e, t, p, 1)
    let tb = await tablero(s)
    expect(tb.progreso.por_mesa.find((m: { mesa_id: string }) => m.mesa_id === s.mesas[0].id).precierre).toBe(true)
    expect(tb.progreso.precierre).toBe(false)
    const pre = await resultados(tokens[0][0])
    expect(pre.statusCode).toBe(200)
    expect(pre.json().preliminar).toBe(true)
    expect((await resultados(tokens[1][0])).statusCode).toBe(403)
    expect((await yo(tokens[0][0])).json().progreso_mesa.precierre).toBe(true)

    // Mesa 2 completa → precierre de sala. El precierre nunca cierra la ronda y se puede seguir editando.
    for (const t of tokens[1]) for (const p of ['insumex', 'nutriwhat']) await votar(e, t, p, 1)
    tb = await tablero(s)
    expect(tb.progreso.precierre).toBe(true)
    expect(tb.preliminar).toBe(true)
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
    expect((await votar(e, tokens[1][0], 'insumex', 1, { ...RESPUESTAS_5, regulacion: 9 })).statusCode).toBe(200)

    // Alguien llega tarde: el precierre de su mesa y el de la sala desaparecen.
    const tarde = (await inscribir(e, s.mesas[1].codigo, 'tarde@prueba.co')).json().token
    tb = await tablero(s)
    expect(tb.progreso.precierre).toBe(false)
    expect(tb.progreso.por_mesa.find((m: { mesa_id: string }) => m.mesa_id === s.mesas[1].id).precierre).toBe(false)
    for (const p of ['insumex', 'nutriwhat']) await votar(e, tarde, p, 1)
    expect((await tablero(s)).progreso.precierre).toBe(true)

    // A la hora exacta el programado cierra R1 (chequeo perezoso) y el resultado deja de ser preliminar.
    e.reloj.ms = cierreR1 - 1
    expect((await detalle(s.id)).sala.estado).toBe('r1_abierta')
    e.reloj.ms = cierreR1
    const d1 = await detalle(s.id)
    expect(d1.sala.estado).toBe('r1_cerrada')
    expect(d1.eventos.some((ev: { tipo: string; por: string }) => ev.tipo === 'cierre_programado' && ev.por === 'programado')).toBe(true)
    expect((await tablero(s)).preliminar).toBe(false)
    expect((await resultados(tokens[0][0])).json().preliminar).toBe(false)
    expect((await votar(e, tokens[0][0], 'insumex', 1)).statusCode).toBe(409)

    // Abrir R2 revela las 6 hojas (12 con los 2 vivos) en el celular, con las propias primero.
    const etag = (await yo(tokens[0][0])).headers.etag as string
    await accion(e, s.id, 'abrir_ronda_2')
    const r2 = await yo(tokens[0][0], etag)
    expect(r2.statusCode).toBe(200)
    const v2 = r2.json()
    expect(v2.config.revelar_hojas).toBe(true)
    expect(v2.contenido.hojas).toHaveLength(12)
    expect(v2.contenido.hojas.slice(0, hojasPropias).every((h: { perfil_id: string }) => h.perfil_id === v2.participante.perfil.id)).toBe(true)

    // R2 con cierre programado de ronda y de sala; el de sala llega después.
    const cierreR2 = e.reloj.ms + 15 * 60_000
    const cierreSala = cierreR2 + 10 * 60_000
    await config(s.id, { cierre_programado_ronda_at: iso(cierreR2), cierre_programado_sala_at: iso(cierreSala) })
    for (const t of tokens.flat()) await votar(e, t, 'insumex', 2)
    e.reloj.ms = cierreR2
    expect((await detalle(s.id)).sala.estado).toBe('r2_cerrada')
    tb = await tablero(s)
    const insumex = tb.proyectos_vivos.find((p: { id: string }) => p.id === 'insumex')
    expect(insumex.rondas.map((r: { ronda: number; n_votos: number }) => [r.ronda, r.n_votos])).toEqual([[1, 7], [2, 6]])

    e.reloj.ms = cierreSala
    const d3 = await detalle(s.id)
    expect(d3.sala.estado).toBe('cerrada')
    const programados = d3.eventos.filter((ev: { por: string }) => ev.por === 'programado').map((ev: { tipo: string }) => ev.tipo)
    // Cada cierre programado deja su aviso y la transición, ambos por "programado".
    expect(programados.filter((t: string) => t === 'cierre_programado')).toHaveLength(3)
    expect(programados.filter((t: string) => t !== 'cierre_programado').sort()).toEqual(['ronda_cerrada', 'ronda_cerrada', 'sala_cerrada'])
    expect(d3.sala.config).toMatchObject({ cierre_programado_ronda_at: null, cierre_programado_sala_at: null })
    expect((await inscribir(e, s.mesas[0].codigo, 'despues@prueba.co')).statusCode).toBe(409)
    // El celular sigue viendo el resultado final.
    expect((await resultados(tokens[0][0])).statusCode).toBe(200)
  })

  it('cambiar alcance o vista se refleja en el siguiente polling del celular (ETag nueva)', async () => {
    const s = await crearSala(e, 1, 'Sala de prueba', VISTA_MESA_REGISTRADO)
    await accion(e, s.id, 'abrir_inscripcion')
    const { token } = (await inscribir(e, s.mesas[0].codigo, 'vista@prueba.co')).json()
    await inscribir(e, s.mesas[0].codigo, 'otra@prueba.co')
    await accion(e, s.id, 'abrir_ronda_1')
    for (const p of ['insumex', 'nutriwhat']) await votar(e, token, p, 1)
    const a = await yo(token)
    expect(a.json().resultados).toBeNull()
    await config(s.id, { vista_participante: 'en_vivo', alcance_resultados: 'sala' })
    const b = await yo(token, a.headers.etag as string)
    expect(b.statusCode).toBe(200)
    expect(b.json().config).toMatchObject({ vista_participante: 'en_vivo', alcance_resultados: 'sala' })
    expect(b.json().resultados).not.toBeNull()
    expect((await yo(token, b.headers.etag as string)).statusCode).toBe(304)
  })
})

describe('permisos superadmin, admin y participante', () => {
  it('un admin opera salas igual que el superadmin, pero no gestiona administradores', async () => {
    const r = await e.app.inject({ method: 'POST', url: '/api/admin/admins', headers: { cookie: e.cookie }, payload: { usuario: 'operador', nombre: 'Operador', correo: 'op@estratek.com.co', clave_temporal: 'temporal123' } })
    expect(r.statusCode).toBe(201)
    const temp = await loginCookie(e.app, 'operador', 'temporal123')
    // Antes de cambiar la clave no opera nada.
    const bloqueada = await e.app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie: temp }, payload: { nombre: 'X', plantilla: 'foodsume_2026', mesas: 1 } })
    expect(bloqueada.statusCode).toBe(403)
    expect(bloqueada.json().error.codigo).toBe('CAMBIO_CLAVE_REQUERIDO')
    await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie: temp }, payload: { actual: 'temporal123', nueva: 'operadora456' } })
    const c = await loginCookie(e.app, 'operador', 'operadora456')

    const creada = await e.app.inject({ method: 'POST', url: '/api/admin/salas', headers: { cookie: c }, payload: { nombre: 'Sala del operador', plantilla: 'foodsume_2026', mesas: 2 } })
    expect(creada.statusCode).toBe(201)
    const s = creada.json()
    const ops = [
      e.app.inject({ method: 'POST', url: `/api/admin/salas/${s.id}/acciones`, headers: { cookie: c }, payload: { accion: 'abrir_inscripcion' } }),
      e.app.inject({ method: 'PATCH', url: `/api/admin/salas/${s.id}/config`, headers: { cookie: c }, payload: { alcance_resultados: 'sala' } }),
      e.app.inject({ method: 'POST', url: `/api/admin/salas/${s.id}/mesas`, headers: { cookie: c }, payload: { cantidad: 1 } }),
      e.app.inject({ url: `/api/admin/salas/${s.id}`, headers: { cookie: c } }),
      e.app.inject({ url: `/api/admin/salas/${s.id}/export/votos.csv`, headers: { cookie: c } }),
      e.app.inject({ url: `/api/admin/mesas/${s.mesas[0].id}/qr.svg`, headers: { cookie: c } }),
      e.app.inject({ url: `/api/tablero/${s.id}`, headers: { cookie: c } }),
    ]
    for (const o of await Promise.all(ops)) expect(o.statusCode, o.body.slice(0, 120)).toBe(200)
    const ev = (await detalle(s.id)).eventos as { por: string }[]
    expect(ev.some((x) => x.por === 'admin:operador')).toBe(true)

    for (const [metodo, url, payload] of [
      ['GET', '/api/admin/admins', undefined],
      ['POST', '/api/admin/admins', { usuario: 'otro', nombre: 'Otro', clave_temporal: 'temporal123' }],
      ['PATCH', '/api/admin/admins/1', { activo: false }],
    ] as const) {
      const x = await e.app.inject({ method: metodo, url, headers: { cookie: c }, payload })
      expect(x.statusCode).toBe(403)
      expect(x.json().error.codigo).toBe('SOLO_SUPERADMIN')
    }
    expect((await e.app.inject({ url: '/api/admin/yo', headers: { cookie: c } })).json().rol).toBe('admin')
    expect((await e.app.inject({ url: '/api/admin/yo', headers: { cookie: e.cookie } })).json().rol).toBe('superadmin')
  })

  it('un participante no entra a ninguna ruta admin ni al tablero sin token', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const { token } = (await inscribir(e, s.mesas[0].codigo, 'curioso@prueba.co')).json()
    const h = { 'x-participante-token': token, cookie: `hz_admin=${token}` }
    for (const [metodo, url] of [
      ['GET', '/api/admin/salas'],
      ['GET', `/api/admin/salas/${s.id}`],
      ['POST', `/api/admin/salas/${s.id}/acciones`],
      ['GET', '/api/admin/admins'],
      ['GET', `/api/admin/salas/${s.id}/export/inscritos.csv`],
      ['GET', `/api/tablero/${s.id}`],
    ] as const) {
      const r = await e.app.inject({ method: metodo, url, headers: h, payload: metodo === 'POST' ? { accion: 'cerrar_sala' } : undefined })
      expect(r.statusCode, `${metodo} ${url}`).toBe(401)
    }
    expect((await detalle(s.id)).sala.estado).toBe('inscripcion')
  })
})
