// Carga la prueba sintética del golden en la API real: sala de 2 mesas, 20 personas, R1 y R2.
// Uso: node golden_api.mjs <base> <usuario> <clave> <golden.json> [hasta=r1|r2_abierta|r2_cerrada]
import { readFileSync } from 'node:fs'
const [base, usuario, clave, rutaGolden, hasta = 'r2_cerrada'] = process.argv.slice(2)
const golden = JSON.parse(readFileSync(rutaGolden, 'utf8'))
async function http(metodo, ruta, { cuerpo, headers = {} } = {}) {
  const r = await fetch(base + ruta, { method: metodo, headers: { ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...headers }, body: cuerpo ? JSON.stringify(cuerpo) : undefined })
  const t = await r.text()
  if (r.status >= 400) throw new Error(`${metodo} ${ruta} → ${r.status} ${t.slice(0, 300)}`)
  return { json: t ? JSON.parse(t) : null, headers: r.headers }
}
const login = await http('POST', '/api/admin/login', { cuerpo: { usuario, clave } })
const adm = { cookie: (login.headers.get('set-cookie') ?? '').split(';')[0] }
if (login.json?.admin?.debe_cambiar_clave || login.json?.debe_cambiar_clave) {
  await http('POST', '/api/admin/cambiar-clave', { cuerpo: { actual: clave, nueva: clave + 'X' }, headers: adm })
  console.error('AVISO: clave cambiada a', clave + 'X')
}
const sala = (await http('POST', '/api/admin/salas', { cuerpo: { nombre: 'Golden sintético', plantilla: 'foodsume_2026', mesas: 2 }, headers: adm })).json
const accion = (a) => http('POST', `/api/admin/salas/${sala.id}/acciones`, { cuerpo: { accion: a }, headers: adm })
await accion('abrir_inscripcion')
const consentimiento = (await http('GET', `/api/mesas/${sala.mesas[0].codigo}`)).json.consentimiento
const ids = [...new Set(golden.prueba_sintetica.votos.map((v) => v.respondiente_id))]
const tokens = {}
for (const [i, id] of ids.entries()) {
  const r = await http('POST', '/api/inscripcion', { cuerpo: { codigoMesa: sala.mesas[i % 2].codigo, nombre: `Persona ${id}`, correo: `golden${id}@prueba.co`, consentimiento: { aceptado: true, version: consentimiento.version } } })
  tokens[id] = r.json.token
}
const CRIT = ['alistamiento_tecnico', 'conocimiento_cliente', 'regulacion', 'capacidades_organizacionales', 'alineacion_core', 'inversion_requerida']
async function votar(ronda) {
  for (const v of golden.prueba_sintetica.votos.filter((x) => x.ronda === ronda)) {
    const respuestas = Object.fromEntries(CRIT.map((c) => [c, v[c]]))
    await http('PUT', '/api/votos', { cuerpo: { proyecto_id: v.proyecto.toLowerCase(), ronda, respuestas }, headers: { 'x-participante-token': tokens[v.respondiente_id] } })
  }
}
await accion('abrir_ronda_1')
await votar(1)
if (hasta !== 'r1') {
  await accion('cerrar_ronda_1')
  await accion('abrir_ronda_2')
  await votar(2)
  if (hasta === 'r2_cerrada') await accion('cerrar_ronda_2')
}
console.log(JSON.stringify({ id: sala.id, token: sala.token_tablero, mesas: sala.mesas.map((m) => m.id) }))
