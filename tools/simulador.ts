// Simulador de carga del taller (SPEC §11.1): N celulares en M mesas, polling cada 2,5 s,
// votan 2 rondas; mide p95 por ruta y verifica los puntos de la sala contra un cálculo independiente.
//
// Uso:
//   npm run simular                                    -> levanta la API en memoria y simula 40 personas / 4 mesas
//   npm run simular -- --personas 40 --mesas 4 --poll 2500
//   npm run simular -- --url https://staging-horizontes.estratek.com.co --usuario paola --clave '...'
// Sale con código 1 si hay errores, si p95 > 500 ms o si los puntos no coinciden.
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const PERSONAS = Number(arg('personas', '40'))
const MESAS = Number(arg('mesas', '4'))
const POLL_MS = Number(arg('poll', '2500'))
const ESCALA = [1, 3, 5, 7, 9]
const CRITERIOS = ['alistamiento_tecnico', 'conocimiento_cliente', 'regulacion', 'capacidades_organizacionales', 'alineacion_core', 'inversion_requerida'] as const

let base = arg('url')
// En modo local también se mide el tiempo dentro del servidor (sin la red ni el cliente, que comparten proceso).
const tiemposServidor: number[] = []
let cerrarLocal: (() => Promise<void>) | null = null
let usuario = arg('usuario', 'simulador')!
let clave = arg('clave', 'simulador-clave-1')!

if (!base) {
  // API real en proceso con BD temporal.
  const dir = mkdtempSync(join(tmpdir(), 'hz-sim-'))
  process.env.DB_PATH = join(dir, 'sim.sqlite')
  process.env.SUPERADMIN_USUARIO = usuario
  process.env.SUPERADMIN_CLAVE = clave
  const { construirApp } = await import('../server/app.js')
  const app = await construirApp({ mocks: false, baseUrl: 'http://localhost' })
  app.addHook('onResponse', async (_req, reply) => {
    tiemposServidor.push(reply.elapsedTime)
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const addr = app.server.address() as { port: number }
  base = `http://127.0.0.1:${addr.port}`
  cerrarLocal = async () => {
    await app.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

const tiempos = new Map<string, number[]>()
let errores = 0
async function http(metodo: string, ruta: string, op: { cuerpo?: unknown; headers?: Record<string, string>; etiqueta?: string } = {}) {
  const t0 = performance.now()
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: { ...(op.cuerpo !== undefined ? { 'content-type': 'application/json' } : {}), ...op.headers },
    body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo),
  })
  const texto = await r.text()
  const ms = performance.now() - t0
  const k = op.etiqueta ?? `${metodo} ${ruta.split('?')[0].replace(/\/(s|m|p)_[a-z0-9]+/g, '/:id')}`
  if (!tiempos.has(k)) tiempos.set(k, [])
  tiempos.get(k)!.push(ms)
  if (r.status >= 400 && r.status !== 409) {
    errores++
    console.error(`  ✗ ${metodo} ${ruta} → ${r.status} ${texto.slice(0, 200)}`)
  }
  return { status: r.status, json: texto ? JSON.parse(texto) : null, headers: r.headers }
}

const p95 = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]
}

// --- Preparación (admin) ---
const login = await http('POST', '/api/admin/login', { cuerpo: { usuario, clave } })
if (login.status !== 200) throw new Error(`No pude iniciar sesión como ${usuario}: ${JSON.stringify(login.json)}`)
const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
const adm = { cookie }
const sala = (await http('POST', '/api/admin/salas', { cuerpo: { nombre: `Simulación ${new Date().toISOString()}`, plantilla: 'foodsume_2026', mesas: MESAS }, headers: adm })).json
const accion = (a: string) => http('POST', `/api/admin/salas/${sala.id}/acciones`, { cuerpo: { accion: a }, headers: adm })
await accion('abrir_inscripcion')
console.log(`Sala ${sala.codigo} (${sala.id}) · ${PERSONAS} personas · ${MESAS} mesas · polling ${POLL_MS} ms · ${base}`)

// --- Participantes ---
const consentimiento = (await http('GET', `/api/mesas/${sala.mesas[0].codigo}`)).json.consentimiento
interface Persona {
  token: string
  etag?: string
  votos: Record<number, Record<string, Record<string, number>>>
}
const personas: Persona[] = []
await Promise.all(
  Array.from({ length: PERSONAS }, async (_, i) => {
    const r = await http('POST', '/api/inscripcion', {
      cuerpo: { codigoMesa: sala.mesas[i % MESAS].codigo, nombre: `Persona ${i + 1}`, correo: `sim${i + 1}@simulacion.co`, consentimiento: { aceptado: true, version: consentimiento.version } },
    })
    personas.push({ token: r.json.token, votos: {} })
  }),
)

// Polling de todos los celulares + tablero del proyector mientras dura la simulación.
let vivo = true
const sondeos: Promise<void>[] = []
for (const p of personas) {
  sondeos.push(
    (async () => {
      await new Promise((r) => setTimeout(r, Math.random() * POLL_MS))
      while (vivo) {
        const r = await http('GET', '/api/yo', { headers: { 'x-participante-token': p.token, ...(p.etag ? { 'if-none-match': p.etag } : {}) } })
        p.etag = r.headers.get('etag') ?? p.etag
        await new Promise((res) => setTimeout(res, POLL_MS))
      }
    })(),
  )
}
sondeos.push(
  (async () => {
    while (vivo) {
      await http('GET', `/api/tablero/${sala.id}?t=${sala.token_tablero}`)
      await new Promise((res) => setTimeout(res, POLL_MS))
    }
  })(),
)

async function ronda(n: 1 | 2) {
  await accion(`abrir_ronda_${n}`)
  // Cada persona vota los 2 vivos con pausas aleatorias (lectura de la rúbrica).
  await Promise.all(
    personas.map(async (p) => {
      p.votos[n] = {}
      for (const proyecto of ['insumex', 'nutriwhat']) {
        await new Promise((r) => setTimeout(r, Math.random() * POLL_MS * 2))
        const respuestas = Object.fromEntries(CRITERIOS.map((c) => [c, ESCALA[Math.floor(Math.random() * 5)]]))
        p.votos[n][proyecto] = respuestas
        await http('PUT', '/api/votos', { cuerpo: { proyecto_id: proyecto, ronda: n, respuestas }, headers: { 'x-participante-token': p.token } })
      }
    }),
  )
  const t = (await http('GET', `/api/tablero/${sala.id}?t=${sala.token_tablero}`)).json
  if (!t.progreso.precierre) {
    errores++
    console.error(`  ✗ ronda ${n}: todos votaron pero no hay precierre de sala`)
  }
  await new Promise((r) => setTimeout(r, POLL_MS))
  await accion(`cerrar_ronda_${n}`)
}

await ronda(1)
await ronda(2)
vivo = false
await Promise.all(sondeos)

// --- Verificación independiente de los puntos de la sala ---
const t = (await http('GET', `/api/tablero/${sala.id}?t=${sala.token_tablero}`)).json
let descuadres = 0
for (const pv of t.proyectos_vivos) {
  for (const r of pv.rondas) {
    const prom = Object.fromEntries(CRITERIOS.map((c) => [c, personas.reduce((a, p) => a + p.votos[r.ronda][pv.id][c], 0) / personas.length]))
    const t2m = prom.alistamiento_tecnico * 0.3 + prom.conocimiento_cliente * 0.35 + prom.regulacion * 0.35
    const x = t2m * 0.6 + prom.capacidades_organizacionales * 0.4
    const y = prom.alineacion_core * 0.7 + prom.inversion_requerida * 0.3
    const ok = Math.abs(r.t2m - t2m) < 1e-9 && Math.abs(r.eje_x - x) < 1e-9 && Math.abs(r.eje_y - y) < 1e-9 && r.n_votos === personas.length
    if (!ok) descuadres++
    console.log(`  ${ok ? '✓' : '✗'} ${pv.nombre} R${r.ronda}: x=${r.eje_x.toFixed(3)} y=${r.eje_y.toFixed(3)} (n=${r.n_votos})`)
  }
}
await accion('cerrar_sala')

console.log('\nLatencia por ruta (ms):')
let peor = 0
const todas: number[] = []
for (const [k, xs] of [...tiempos.entries()].sort()) {
  todas.push(...xs)
  peor = Math.max(peor, p95(xs))
  console.log(`  ${k.padEnd(42)} n=${String(xs.length).padStart(5)}  p95=${p95(xs).toFixed(1).padStart(7)}  máx=${Math.max(...xs).toFixed(1)}`)
}
console.log(`  ${'TOTAL'.padEnd(42)} n=${String(todas.length).padStart(5)}  p95=${p95(todas).toFixed(1).padStart(7)}`)
const p95Gate = tiemposServidor.length ? p95(tiemposServidor) : p95(todas)
if (tiemposServidor.length) console.log(`  ${'TOTAL medido en el servidor'.padEnd(42)} n=${String(tiemposServidor.length).padStart(5)}  p95=${p95Gate.toFixed(1).padStart(7)}`)
console.log(`\nErrores: ${errores} · descuadres: ${descuadres} · p95 de compuerta: ${p95Gate.toFixed(1)} ms (máx. 500)`)
if (cerrarLocal) await cerrarLocal()
const ok = errores === 0 && descuadres === 0 && p95Gate <= 500
console.log(ok ? 'SIMULACIÓN OK' : 'SIMULACIÓN CON FALLAS')
process.exit(ok ? 0 : 1)
