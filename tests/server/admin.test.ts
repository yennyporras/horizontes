// Integración del panel admin contra la API real (BD en memoria, reloj simulado).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Entorno, T0, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const pedir = (method: 'GET' | 'POST' | 'PATCH' | 'PUT', url: string, cookie?: string, payload?: object, headers: Record<string, string> = {}) =>
  e.app.inject({ method, url, payload, headers: { ...(cookie ? { cookie } : {}), ...headers } })

async function crearAdminNuevo(usuario = 'carlos', clave = 'temporal123') {
  const r = await pedir('POST', '/api/admin/admins', e.cookie, { usuario, nombre: 'Carlos Pérez', correo: 'carlos@estratek.com.co', clave_temporal: clave })
  expect(r.statusCode).toBe(201)
  return r.json() as { id: number; usuario: string; rol: string; debe_cambiar_clave: boolean }
}

/** Crea un admin, cambia su clave y devuelve su cookie ya habilitada. */
async function adminListo(usuario = 'carlos') {
  const a = await crearAdminNuevo(usuario, 'temporal123')
  const c = await loginCookie(e.app, usuario, 'temporal123')
  const r = await pedir('POST', '/api/admin/cambiar-clave', c, { actual: 'temporal123', nueva: 'definitiva456' })
  expect(r.statusCode).toBe(200)
  return { admin: a, cookie: c }
}

describe('sesión admin', () => {
  it('login correcto responde 200 y pone cookie hz_admin httpOnly y SameSite=Lax', async () => {
    const r = await pedir('POST', '/api/admin/login', undefined, { usuario: 'paola', clave: 'superclave123' })
    expect(r.statusCode).toBe(200)
    expect(r.json().admin).toMatchObject({ usuario: 'paola', rol: 'superadmin' })
    expect(r.json().admin).not.toHaveProperty('clave_hash')
    const c = r.cookies.find((x) => x.name === 'hz_admin')!
    expect(c).toBeDefined()
    expect(c.httpOnly).toBe(true)
    expect(String(c.sameSite).toLowerCase()).toBe('lax')
  })

  it('login con clave incorrecta o usuario inexistente responde 401 CREDENCIALES_INVALIDAS sin cookie', async () => {
    for (const payload of [{ usuario: 'paola', clave: 'mala-clave' }, { usuario: 'nadie', clave: 'superclave123' }, {}]) {
      const r = await pedir('POST', '/api/admin/login', undefined, payload)
      expect(r.statusCode).toBe(401)
      expect(r.json().error.codigo).toBe('CREDENCIALES_INVALIDAS')
      expect(r.cookies.find((x) => x.name === 'hz_admin')).toBeUndefined()
    }
  })

  it('el usuario del login no distingue mayúsculas', async () => {
    const r = await pedir('POST', '/api/admin/login', undefined, { usuario: ' PAOLA ', clave: 'superclave123' })
    expect(r.statusCode).toBe(200)
  })

  it('logout invalida la sesión en el servidor', async () => {
    expect((await pedir('GET', '/api/admin/yo', e.cookie)).statusCode).toBe(200)
    const r = await pedir('POST', '/api/admin/logout', e.cookie)
    expect(r.statusCode).toBe(200)
    const r2 = await pedir('GET', '/api/admin/yo', e.cookie)
    expect(r2.statusCode).toBe(401)
    expect(r2.json().error.codigo).toBe('SESION_REQUERIDA')
  })

  it('la sesión expira a las 12 horas', async () => {
    e.reloj.ms = T0 + 12 * 3600_000 + 1
    const r = await pedir('GET', '/api/admin/yo', e.cookie)
    expect(r.statusCode).toBe(401)
  })

  it.each([
    ['GET', '/api/admin/yo'],
    ['GET', '/api/admin/salas'],
    ['POST', '/api/admin/salas'],
    ['GET', '/api/admin/salas/s_x'],
    ['PATCH', '/api/admin/salas/s_x/config'],
    ['POST', '/api/admin/salas/s_x/acciones'],
    ['POST', '/api/admin/salas/s_x/mesas'],
    ['GET', '/api/admin/mesas/m_x/qr.svg'],
    ['PATCH', '/api/admin/participantes/p_x'],
    ['GET', '/api/admin/admins'],
    ['POST', '/api/admin/admins'],
    ['PATCH', '/api/admin/admins/1'],
    ['POST', '/api/admin/cambiar-clave'],
    ['GET', '/api/admin/salas/s_x/export/votos.csv'],
  ] as const)('%s %s sin cookie responde 401 SESION_REQUERIDA', async (method, url) => {
    const r = await pedir(method, url, undefined, method === 'GET' ? undefined : {})
    expect(r.statusCode).toBe(401)
    expect(r.json().error.codigo).toBe('SESION_REQUERIDA')
  })

  it('una cookie inventada no abre sesión', async () => {
    const r = await pedir('GET', '/api/admin/salas', 'hz_admin=inventada')
    expect(r.statusCode).toBe(401)
  })
})

describe('gestión de administradores', () => {
  it('el superadmin crea un admin con rol admin aunque pida superadmin', async () => {
    const r = await pedir('POST', '/api/admin/admins', e.cookie, { usuario: 'intruso', nombre: 'Intruso', clave_temporal: 'temporal123', rol: 'superadmin' })
    expect(r.statusCode).toBe(201)
    expect(r.json()).toMatchObject({ usuario: 'intruso', rol: 'admin', activo: true, debe_cambiar_clave: true })
    expect(r.json()).not.toHaveProperty('clave_hash')
    const c = await loginCookie(e.app, 'intruso', 'temporal123')
    expect((await pedir('GET', '/api/admin/yo', c)).json().rol).toBe('admin')
  })

  it('usuario duplicado responde 409', async () => {
    await crearAdminNuevo('carlos')
    const r = await pedir('POST', '/api/admin/admins', e.cookie, { usuario: 'CARLOS', nombre: 'Otro', clave_temporal: 'temporal123' })
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('USUARIO_EXISTE')
  })

  it('no se puede crear un admin con el usuario del superadmin', async () => {
    const r = await pedir('POST', '/api/admin/admins', e.cookie, { usuario: 'paola', nombre: 'Clon', clave_temporal: 'temporal123' })
    expect(r.statusCode).toBe(409)
  })

  it('datos inválidos al crear admin responden 422', async () => {
    const corta = await pedir('POST', '/api/admin/admins', e.cookie, { usuario: 'ana', nombre: 'Ana', clave_temporal: 'corta' })
    expect(corta.statusCode).toBe(422)
    const sinUsuario = await pedir('POST', '/api/admin/admins', e.cookie, { nombre: 'Ana', clave_temporal: 'temporal123' })
    expect(sinUsuario.statusCode).toBe(422)
  })

  it('con debe_cambiar_clave solo funcionan yo y cambiar-clave; tras cambiarla puede listar salas', async () => {
    const a = await crearAdminNuevo('carlos', 'temporal123')
    expect(a.debe_cambiar_clave).toBe(true)
    const c = await loginCookie(e.app, 'carlos', 'temporal123')

    const salas = await pedir('GET', '/api/admin/salas', c)
    expect(salas.statusCode).toBe(403)
    expect(salas.json().error.codigo).toBe('CAMBIO_CLAVE_REQUERIDO')

    const yo = await pedir('GET', '/api/admin/yo', c)
    expect(yo.statusCode).toBe(200)
    expect(yo.json()).toMatchObject({ usuario: 'carlos', rol: 'admin', debe_cambiar_clave: true })

    const mala = await pedir('POST', '/api/admin/cambiar-clave', c, { actual: 'otra-cosa', nueva: 'definitiva456' })
    expect(mala.statusCode).toBe(401)
    const igual = await pedir('POST', '/api/admin/cambiar-clave', c, { actual: 'temporal123', nueva: 'temporal123' })
    expect(igual.statusCode).toBe(422)
    const corta = await pedir('POST', '/api/admin/cambiar-clave', c, { actual: 'temporal123', nueva: 'abc' })
    expect(corta.statusCode).toBe(422)

    const ok = await pedir('POST', '/api/admin/cambiar-clave', c, { actual: 'temporal123', nueva: 'definitiva456' })
    expect(ok.statusCode).toBe(200)
    expect((await pedir('GET', '/api/admin/salas', c)).statusCode).toBe(200)
    expect((await pedir('GET', '/api/admin/yo', c)).json().debe_cambiar_clave).toBe(false)

    // La clave vieja ya no entra; la nueva sí.
    expect((await pedir('POST', '/api/admin/login', undefined, { usuario: 'carlos', clave: 'temporal123' })).statusCode).toBe(401)
    await loginCookie(e.app, 'carlos', 'definitiva456')
  })

  it('un admin normal recibe 403 SOLO_SUPERADMIN en la gestión de admins', async () => {
    const { cookie } = await adminListo('carlos')
    const lista = await pedir('GET', '/api/admin/admins', cookie)
    const crea = await pedir('POST', '/api/admin/admins', cookie, { usuario: 'otro', nombre: 'Otro', clave_temporal: 'temporal123' })
    const edita = await pedir('PATCH', '/api/admin/admins/1', cookie, { activo: false })
    for (const r of [lista, crea, edita]) {
      expect(r.statusCode).toBe(403)
      expect(r.json().error.codigo).toBe('SOLO_SUPERADMIN')
    }
    // No quedó creado.
    const admins = (await pedir('GET', '/api/admin/admins', e.cookie)).json().admins as { usuario: string }[]
    expect(admins.map((a) => a.usuario)).toEqual(['paola', 'carlos'])
  })

  it('el superadmin lista admins sin hashes de clave', async () => {
    await crearAdminNuevo('carlos')
    const r = await pedir('GET', '/api/admin/admins', e.cookie)
    expect(r.statusCode).toBe(200)
    expect(r.json().admins).toHaveLength(2)
    expect(r.body).not.toContain('scrypt')
  })

  it('desactivar a un admin invalida su sesión y le impide loguearse', async () => {
    const { admin, cookie } = await adminListo('carlos')
    const r = await pedir('PATCH', `/api/admin/admins/${admin.id}`, e.cookie, { activo: false })
    expect(r.statusCode).toBe(200)
    expect(r.json().activo).toBe(false)
    expect((await pedir('GET', '/api/admin/yo', cookie)).statusCode).toBe(401)
    const login = await pedir('POST', '/api/admin/login', undefined, { usuario: 'carlos', clave: 'definitiva456' })
    expect(login.statusCode).toBe(401)
    expect(login.json().error.codigo).toBe('CREDENCIALES_INVALIDAS')

    // Reactivarlo le devuelve el acceso.
    await pedir('PATCH', `/api/admin/admins/${admin.id}`, e.cookie, { activo: true })
    await loginCookie(e.app, 'carlos', 'definitiva456')
  })

  it('restablecer_clave devuelve clave_temporal, cierra sesiones y vuelve a exigir cambio', async () => {
    const { admin, cookie } = await adminListo('carlos')
    const r = await pedir('PATCH', `/api/admin/admins/${admin.id}`, e.cookie, { restablecer_clave: true })
    expect(r.statusCode).toBe(200)
    const temporal = r.json().clave_temporal as string
    expect(typeof temporal).toBe('string')
    expect(temporal.length).toBeGreaterThanOrEqual(8)
    expect(r.json().debe_cambiar_clave).toBe(true)

    expect((await pedir('GET', '/api/admin/yo', cookie)).statusCode).toBe(401)
    expect((await pedir('POST', '/api/admin/login', undefined, { usuario: 'carlos', clave: 'definitiva456' })).statusCode).toBe(401)
    const c2 = await loginCookie(e.app, 'carlos', temporal)
    expect((await pedir('GET', '/api/admin/salas', c2)).json().error.codigo).toBe('CAMBIO_CLAVE_REQUERIDO')
  })

  it('no se puede desactivar ni restablecer al superadmin (409)', async () => {
    const yo = (await pedir('GET', '/api/admin/yo', e.cookie)).json()
    const des = await pedir('PATCH', `/api/admin/admins/${yo.id}`, e.cookie, { activo: false })
    expect(des.statusCode).toBe(409)
    const res = await pedir('PATCH', `/api/admin/admins/${yo.id}`, e.cookie, { restablecer_clave: true })
    expect(res.statusCode).toBe(409)
    expect((await pedir('GET', '/api/admin/yo', e.cookie)).statusCode).toBe(200)
  })

  it('PATCH de un admin inexistente responde 404', async () => {
    const r = await pedir('PATCH', '/api/admin/admins/999', e.cookie, { nombre: 'X' })
    expect(r.statusCode).toBe(404)
  })

  it('un token de participante no sirve como cookie admin ni crea admins', async () => {
    const sala = await crearSala(e, 1)
    await accion(e, sala.id, 'abrir_inscripcion')
    const ins = await inscribir(e, sala.mesas[0].codigo, 'ana@correo.co', 'Ana Gómez')
    const token = ins.json().token as string

    const comoCookie = await pedir('GET', '/api/admin/yo', `hz_admin=${token}`)
    expect(comoCookie.statusCode).toBe(401)
    const comoHeader = await pedir('POST', '/api/admin/admins', undefined, { usuario: 'ana', nombre: 'Ana', clave_temporal: 'temporal123' }, { 'x-participante-token': token })
    expect(comoHeader.statusCode).toBe(401)
    expect(comoHeader.json().error.codigo).toBe('SESION_REQUERIDA')

    const admins = (await pedir('GET', '/api/admin/admins', e.cookie)).json().admins
    expect(admins).toHaveLength(1)
  })
})

describe('salas y mesas', () => {
  it('POST /api/admin/salas crea 10 proyectos (8 fijos, 2 vivos) y N mesas CODIGO+3 al azar-n', async () => {
    const r = await pedir('POST', '/api/admin/salas', e.cookie, { nombre: 'Taller Bogotá', plantilla: 'foodsume_2026', mesas: 3 })
    expect(r.statusCode).toBe(201)
    const s = r.json()
    expect(s.estado).toBe('preparada')
    expect(s.codigo).toMatch(/^HZ[A-Z0-9]{3}$/)
    expect(typeof s.token_tablero).toBe('string')
    // S-5: el código de la mesa ya no se deduce del de la sala (5 caracteres al azar antes del número, M-1c).
    s.mesas.forEach((m: { codigo: string }, i: number) => expect(m.codigo).toMatch(new RegExp(`^${s.codigo}[A-HJ-NP-Z2-9]{5}-${i + 1}$`)))

    const proyectos = e.db.prepare('SELECT modo, COUNT(*) AS n FROM proyectos WHERE sala_id = ? GROUP BY modo ORDER BY modo').all(s.id) as { modo: string; n: number }[]
    expect(proyectos.map((p) => [p.modo, Number(p.n)])).toEqual([
      ['fijo', 8],
      ['vivo', 2],
    ])
    const t = await e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}`)
    expect(t.json().proyectos_fijos).toHaveLength(8)
    expect(t.json().proyectos_vivos.map((p: { id: string }) => p.id).sort()).toEqual(['insumex', 'nutriwhat'])
  })

  it('POST /api/admin/salas con datos inválidos responde 422', async () => {
    expect((await pedir('POST', '/api/admin/salas', e.cookie, { nombre: '', plantilla: 'foodsume_2026', mesas: 2 })).statusCode).toBe(422)
    expect((await pedir('POST', '/api/admin/salas', e.cookie, { nombre: 'X', plantilla: 'otra', mesas: 2 })).statusCode).toBe(422)
    expect((await pedir('POST', '/api/admin/salas', e.cookie, { nombre: 'X', plantilla: 'foodsume_2026', mesas: 0 })).statusCode).toBe(422)
    expect((await pedir('POST', '/api/admin/salas', e.cookie, { nombre: 'X', plantilla: 'foodsume_2026', mesas: 31 })).statusCode).toBe(422)
  })

  it('GET /api/admin/salas lista las salas creadas', async () => {
    const a = await crearSala(e, 2, 'Sala A')
    const b = await crearSala(e, 1, 'Sala B')
    const r = await pedir('GET', '/api/admin/salas', e.cookie)
    expect(r.statusCode).toBe(200)
    const salas = r.json().salas as { id: string; mesas: number; inscritos: number }[]
    expect(salas.map((s) => s.id).sort()).toEqual([a.id, b.id].sort())
    expect(salas.find((s) => s.id === a.id)).toMatchObject({ mesas: 2, inscritos: 0 })
  })

  it('GET /api/admin/salas/:id trae version, ETag y 304 con If-None-Match', async () => {
    const s = await crearSala(e, 2)
    const r = await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)
    expect(r.statusCode).toBe(200)
    const d = r.json()
    expect(typeof d.version).toBe('string')
    expect(r.headers.etag).toBe(`"${d.version}"`)
    const r2 = await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie, undefined, { 'if-none-match': r.headers.etag as string })
    expect(r2.statusCode).toBe(304)
    expect(r2.body).toBe('')

    // Tras un cambio, la ETag vieja ya no sirve.
    await accion(e, s.id, 'abrir_inscripcion')
    const r3 = await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie, undefined, { 'if-none-match': r.headers.etag as string })
    expect(r3.statusCode).toBe(200)
    expect(r3.json().version).not.toBe(d.version)
  })

  it('las mesas del detalle traen url_participante y url_tablero', async () => {
    const s = await crearSala(e, 2)
    const d = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json()
    expect(d.mesas).toHaveLength(2)
    for (const m of d.mesas) {
      expect(m.url_participante).toBe(`https://horizontes.test/m/${m.codigo}`)
      expect(m.url_tablero).toContain(`/tablero/${s.id}?`)
      expect(m.url_tablero).toContain(`mesa=${m.id}`)
      expect(m.url_tablero).toContain(`t=${s.token_tablero}`)
    }
  })

  it('GET /api/admin/salas/:id de una sala inexistente responde 404', async () => {
    const r = await pedir('GET', '/api/admin/salas/s_noexiste', e.cookie)
    expect(r.statusCode).toBe(404)
    expect(r.json().error.codigo).toBe('SALA_NO_EXISTE')
  })

  it('PATCH config acepta valores válidos y los devuelve', async () => {
    const s = await crearSala(e, 1)
    const r = await pedir('PATCH', `/api/admin/salas/${s.id}/config`, e.cookie, {
      alcance_resultados: 'sala',
      vista_participante: 'en_vivo',
      revelar_hojas: true,
      cierre_programado_ronda_at: '2026-10-20T15:30:00-05:00',
      cierre_programado_sala_at: '2026-10-20T17:00:00-05:00',
    })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toEqual({
      alcance_resultados: 'sala',
      vista_participante: 'en_vivo',
      revelar_hojas: true,
      cierre_programado_ronda_at: '2026-10-20T15:30:00-05:00',
      cierre_programado_sala_at: '2026-10-20T17:00:00-05:00',
      pais: 'CO',
      zona_horaria: 'America/Bogota',
      // 19-oct: el alias de ronda escribe el cierre de la ronda 1 (la siguiente en una sala preparada).
      apertura_programada_sala_at: null,
      apertura_programada_r1_at: null,
      cierre_programado_r1_at: '2026-10-20T15:30:00-05:00',
      apertura_programada_r2_at: null,
      cierre_programado_r2_at: null,
      modo_preguntas: 'automatico',
    })
  })

  it('PATCH config acepta null para borrar un cierre programado', async () => {
    const s = await crearSala(e, 1)
    await pedir('PATCH', `/api/admin/salas/${s.id}/config`, e.cookie, { cierre_programado_ronda_at: '2026-10-20T20:30:00Z' })
    const r = await pedir('PATCH', `/api/admin/salas/${s.id}/config`, e.cookie, { cierre_programado_ronda_at: null })
    expect(r.statusCode).toBe(200)
    expect(r.json().cierre_programado_ronda_at).toBeNull()
  })

  it.each([
    [{ alcance_resultados: 'todos' }],
    [{ vista_participante: 'siempre' }],
    [{ revelar_hojas: 'si' }],
    [{ cierre_programado_ronda_at: 'mañana' }],
    [{ cierre_programado_sala_at: 12345 }],
    [{}],
  ])('PATCH config con %j responde 422 CONFIG_INVALIDA', async (cuerpo) => {
    const s = await crearSala(e, 1)
    const r = await pedir('PATCH', `/api/admin/salas/${s.id}/config`, e.cookie, cuerpo)
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('CONFIG_INVALIDA')
  })

  it('POST mesas agrega mesas con numeración continua; cantidad inválida 422', async () => {
    const s = await crearSala(e, 2)
    const r = await pedir('POST', `/api/admin/salas/${s.id}/mesas`, e.cookie, { cantidad: 2 })
    expect(r.statusCode).toBe(200)
    expect(r.json().mesas.map((m: { codigo: string }) => m.codigo.replace(/^HZ[A-Z0-9]{3}[A-Z0-9]{5}-/, 'n'))).toEqual(['n1', 'n2', 'n3', 'n4'])
    expect(r.json().mesas.slice(0, 2).map((m: { codigo: string }) => m.codigo)).toEqual(s.mesas.map((m) => m.codigo))
    expect((await pedir('POST', `/api/admin/salas/${s.id}/mesas`, e.cookie, { cantidad: 0 })).statusCode).toBe(422)
    expect((await pedir('POST', `/api/admin/salas/${s.id}/mesas`, e.cookie, {})).statusCode).toBe(422)
  })

  it('QR de la mesa es un SVG', async () => {
    const s = await crearSala(e, 1)
    const r = await pedir('GET', `/api/admin/mesas/${s.mesas[0].id}/qr.svg`, e.cookie)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('image/svg+xml')
    expect(r.body.trimStart()).toMatch(/^(<svg|<\?xml)/)
    // También por código de mesa (sin distinguir mayúsculas).
    const r2 = await pedir('GET', `/api/admin/mesas/${s.mesas[0].codigo.toLowerCase()}/qr.svg`, e.cookie)
    expect(r2.statusCode).toBe(200)
    expect((await pedir('GET', '/api/admin/mesas/m_noexiste/qr.svg', e.cookie)).statusCode).toBe(404)
  })
})

describe('participantes desde el admin', () => {
  async function salaConInscrito() {
    const s = await crearSala(e, 2)
    await accion(e, s.id, 'abrir_inscripcion')
    const ins = (await inscribir(e, s.mesas[0].codigo, 'ana@correo.co', 'Ana Gómez')).json()
    return { s, pid: ins.participante.id as string, token: ins.token as string }
  }

  it('PATCH participante cambia perfil, mesa de la misma sala y activo', async () => {
    const { s, pid } = await salaConInscrito()
    const r = await pedir('PATCH', `/api/admin/participantes/${pid}`, e.cookie, { perfil_id: 'financiero', mesa_id: s.mesas[1].id, activo: false })
    expect(r.statusCode).toBe(200)
    expect(r.json()).toMatchObject({ id: pid, perfil_id: 'financiero', mesa_id: s.mesas[1].id, activo: false })
    const d = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json()
    expect(d.participantes.find((p: { id: string }) => p.id === pid)).toMatchObject({ perfil_id: 'financiero', mesa_id: s.mesas[1].id, activo: false })
  })

  it('PATCH participante con mesa de otra sala responde 422', async () => {
    const { pid } = await salaConInscrito()
    const otra = await crearSala(e, 1, 'Otra sala')
    const r = await pedir('PATCH', `/api/admin/participantes/${pid}`, e.cookie, { mesa_id: otra.mesas[0].id })
    expect(r.statusCode).toBe(422)
  })

  it('PATCH participante con perfil inexistente, activo no booleano o sin cambios responde 422', async () => {
    const { pid } = await salaConInscrito()
    expect((await pedir('PATCH', `/api/admin/participantes/${pid}`, e.cookie, { perfil_id: 'astronauta' })).statusCode).toBe(422)
    expect((await pedir('PATCH', `/api/admin/participantes/${pid}`, e.cookie, { activo: 'no' })).statusCode).toBe(422)
    expect((await pedir('PATCH', `/api/admin/participantes/${pid}`, e.cookie, {})).statusCode).toBe(422)
    expect((await pedir('PATCH', '/api/admin/participantes/p_noexiste', e.cookie, { activo: false })).statusCode).toBe(404)
  })

  it('export inscritos.csv trae BOM, separador ; y los datos de consentimiento', async () => {
    const { s } = await salaConInscrito()
    const r = await pedir('GET', `/api/admin/salas/${s.id}/export/inscritos.csv`, e.cookie)
    expect(r.statusCode).toBe(200)
    expect(r.headers['content-type']).toContain('text/csv')
    expect(r.headers['content-disposition']).toContain('inscritos.csv')
    expect(r.body.startsWith('﻿')).toBe(true)
    const lineas = r.body.slice(1).trim().split('\r\n')
    expect(lineas[0].split(';')).toEqual(['nombre', 'correo', 'mesa', 'perfil', 'activo', 'consentimiento_version', 'consentimiento_at', 'politica_url', 'ip', 'pais'])
    expect(lineas).toHaveLength(2)
    expect(lineas[1]).toContain('Ana Gómez;ana@correo.co;Mesa 1')
    expect(lineas[1]).toContain('hz-1.2')
    expect(lineas[1].endsWith(';127.0.0.1;CO')).toBe(true)
  })

  it('export votos.csv trae BOM, separador ; y no contiene nombres ni correos', async () => {
    const { s, token } = await salaConInscrito()
    await accion(e, s.id, 'abrir_ronda_1')
    expect((await votar(e, token, 'insumex', 1)).statusCode).toBe(200)
    const r = await pedir('GET', `/api/admin/salas/${s.id}/export/votos.csv`, e.cookie)
    expect(r.statusCode).toBe(200)
    expect(r.body.startsWith('﻿')).toBe(true)
    const lineas = r.body.slice(1).trim().split('\r\n')
    expect(lineas[0].split(';')[0]).toBe('id_hash')
    expect(lineas[0]).toContain(';')
    expect(lineas).toHaveLength(2)
    expect(lineas[0].split(';').slice(-3)).toEqual(['activo', 'ip', 'pais'])
    expect(lineas[1].split(';')).toHaveLength(14)
    expect(lineas[1].split(';').slice(-2)).toEqual(['127.0.0.1', 'CO'])
    expect(r.body).not.toContain('Ana')
    expect(r.body).not.toContain('ana@correo.co')
    expect(r.body).not.toContain('@')
  })

  // Inyección CSV (OWASP): las celdas que empiezan con = + - @ se neutralizan con una comilla simple.
  it('export inscritos.csv neutraliza nombres que Excel interpretaría como fórmula', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    expect((await inscribir(e, s.mesas[0].codigo, 'x@correo.co', '=HYPERLINK("http://malo.test","clic")')).statusCode).toBe(201)
    const r = await pedir('GET', `/api/admin/salas/${s.id}/export/inscritos.csv`, e.cookie)
    const fila = r.body.slice(1).trim().split('\r\n')[1]
    const primeraCelda = fila.split(';')[0].replace(/^"/, '')
    expect(primeraCelda).not.toMatch(/^[=+\-@]/)
  })

  it('export de un archivo desconocido responde 404', async () => {
    const s = await crearSala(e, 1)
    expect((await pedir('GET', `/api/admin/salas/${s.id}/export/otro.csv`, e.cookie)).statusCode).toBe(404)
  })
})

describe('máquina de estados', () => {
  const estado = async (id: string) => (await pedir('GET', `/api/admin/salas/${id}`, e.cookie)).json().sala.estado as string

  it.each([
    ['cerrar_ronda_1', []],
    ['abrir_ronda_2', []],
    ['cerrar_ronda_2', []],
    ['reabrir_ronda', []],
    ['reabrir_sala', []],
    ['abrir_ronda_2', ['abrir_ronda_1']],
    ['abrir_inscripcion', ['abrir_inscripcion']],
    ['abrir_ronda_1', ['abrir_ronda_1', 'cerrar_ronda_1']],
    ['cerrar_ronda_1', ['abrir_ronda_1', 'cerrar_ronda_1']],
  ])('%s después de %j responde 409 TRANSICION_INVALIDA', async (acc, previas) => {
    const s = await crearSala(e, 1)
    for (const p of previas) expect((await accion(e, s.id, p)).statusCode).toBe(200)
    const antes = await estado(s.id)
    const r = await accion(e, s.id, acc)
    expect(r.statusCode).toBe(409)
    expect(r.json().error.codigo).toBe('TRANSICION_INVALIDA')
    expect(await estado(s.id)).toBe(antes)
  })

  it('una acción inexistente responde 422', async () => {
    const s = await crearSala(e, 1)
    const r = await accion(e, s.id, 'borrar_todo')
    expect(r.statusCode).toBe(422)
    expect(r.json().error.codigo).toBe('ACCION_INVALIDA')
  })

  it('recorre el flujo completo y abrir_ronda_2 pone revelar_hojas=true', async () => {
    const s = await crearSala(e, 1)
    const pasos: [string, string, number][] = [
      ['abrir_inscripcion', 'inscripcion', 0],
      ['abrir_ronda_1', 'r1_abierta', 1],
      ['cerrar_ronda_1', 'r1_cerrada', 1],
      ['abrir_ronda_2', 'r2_abierta', 2],
      ['cerrar_ronda_2', 'r2_cerrada', 2],
      ['cerrar_sala', 'cerrada', 2],
      ['reabrir_sala', 'r2_cerrada', 2],
    ]
    for (const [acc, est, ronda] of pasos) {
      const r = await accion(e, s.id, acc)
      expect(r.statusCode, acc).toBe(200)
      expect(r.json().sala).toMatchObject({ estado: est, ronda_actual: ronda })
      if (acc === 'cerrar_ronda_1') expect(r.json().sala.config.revelar_hojas).toBe(false)
      if (acc === 'abrir_ronda_2') expect(r.json().sala.config.revelar_hojas).toBe(true)
    }
  })

  it('abrir_ronda_1 también se permite directo desde preparada', async () => {
    const s = await crearSala(e, 1)
    const r = await accion(e, s.id, 'abrir_ronda_1')
    expect(r.statusCode).toBe(200)
    expect(r.json().sala.estado).toBe('r1_abierta')
  })

  it('reabrir_ronda vuelve a abrir la ronda cerrada', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    await accion(e, s.id, 'cerrar_ronda_1')
    const r = await accion(e, s.id, 'reabrir_ronda')
    expect(r.statusCode).toBe(200)
    expect(r.json().sala.estado).toBe('r1_abierta')
    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    await accion(e, s.id, 'cerrar_ronda_2')
    expect((await accion(e, s.id, 'reabrir_ronda')).json().sala.estado).toBe('r2_abierta')
  })

  it('reiniciar_ronda borra los votos de la ronda actual', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const t = (await inscribir(e, s.mesas[0].codigo, 'ana@correo.co')).json().token
    await accion(e, s.id, 'abrir_ronda_1')
    await votar(e, t, 'insumex', 1)
    await votar(e, t, 'nutriwhat', 1)
    const contar = () => Number((e.db.prepare('SELECT COUNT(*) AS n FROM votos WHERE sala_id = ?').get(s.id) as { n: number }).n)
    expect(contar()).toBe(2)
    const r = await accion(e, s.id, 'reiniciar_ronda')
    expect(r.statusCode).toBe(200)
    expect(r.json().sala.estado).toBe('r1_abierta')
    expect(contar()).toBe(0)
    const ev = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json().eventos[0]
    expect(ev).toMatchObject({ tipo: 'reinicio', detalle: { ronda: 1, votos_borrados: 2 } })
  })

  it('reiniciar_ronda sin ronda iniciada o con la sala cerrada responde 409', async () => {
    const s = await crearSala(e, 1)
    expect((await accion(e, s.id, 'reiniciar_ronda')).statusCode).toBe(409)
    await accion(e, s.id, 'abrir_ronda_1')
    await accion(e, s.id, 'cerrar_sala')
    expect((await accion(e, s.id, 'reiniciar_ronda')).statusCode).toBe(409)
  })

  it('cerrar_sala y reabrir_sala vuelven al estado de la ronda alcanzada', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    expect((await accion(e, s.id, 'cerrar_sala')).json().sala.estado).toBe('cerrada')
    expect((await accion(e, s.id, 'reabrir_sala')).json().sala.estado).toBe('inscripcion')
    await accion(e, s.id, 'abrir_ronda_1')
    await accion(e, s.id, 'cerrar_sala')
    expect((await accion(e, s.id, 'reabrir_sala')).json().sala.estado).toBe('r1_cerrada')
    expect((await accion(e, s.id, 'cerrar_sala')).statusCode).toBe(200)
    expect((await accion(e, s.id, 'cerrar_sala')).statusCode).toBe(409)
  })

  it('cada acción deja un evento con su autor en el detalle de la sala', async () => {
    const s = await crearSala(e, 1)
    const acciones = ['abrir_inscripcion', 'abrir_ronda_1', 'cerrar_ronda_1', 'reabrir_ronda', 'cerrar_ronda_1', 'abrir_ronda_2', 'cerrar_ronda_2', 'cerrar_sala', 'reabrir_sala']
    for (const a of acciones) expect((await accion(e, s.id, a)).statusCode).toBe(200)
    const eventos = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json().eventos as { tipo: string; por: string; detalle: { accion?: string } | null }[]
    const deAcciones = eventos.filter((x) => x.detalle?.accion).reverse()
    expect(deAcciones.map((x) => x.detalle!.accion)).toEqual(acciones)
    expect(deAcciones.every((x) => x.por === 'admin:paola')).toBe(true)
    expect(eventos.at(-1)!.tipo).toBe('sala_creada')
  })

  it('una transición inválida no deja evento ni cambia la versión', async () => {
    const s = await crearSala(e, 1)
    const d1 = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json()
    await accion(e, s.id, 'cerrar_ronda_1')
    const d2 = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json()
    expect(d2.version).toBe(d1.version)
    expect(d2.eventos).toHaveLength(d1.eventos.length)
  })

  it('cerrar una ronda consume el cierre programado de ronda', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    await pedir('PATCH', `/api/admin/salas/${s.id}/config`, e.cookie, { cierre_programado_ronda_at: '2026-10-20T16:00:00-05:00' })
    const r = await accion(e, s.id, 'cerrar_ronda_1')
    expect(r.json().sala.config.cierre_programado_ronda_at).toBeNull()
  })

  it('un cierre programado vencido cierra la ronda antes de responder', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_ronda_1')
    await pedir('PATCH', `/api/admin/salas/${s.id}/config`, e.cookie, { cierre_programado_ronda_at: new Date(T0 + 60_000).toISOString() })
    expect(await estado(s.id)).toBe('r1_abierta')
    e.reloj.ms = T0 + 60_000
    expect(await estado(s.id)).toBe('r1_cerrada')
    const ev = (await pedir('GET', `/api/admin/salas/${s.id}`, e.cookie)).json().eventos as { tipo: string; por: string }[]
    expect(ev.some((x) => x.tipo === 'cierre_programado' && x.por === 'programado')).toBe(true)
  })
})
