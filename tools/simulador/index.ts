// Simulador de taller (SPEC §11.1). Ver la sección "Simulador" de docs/bitacora/R2_T1.md.
//
//   npm run simular                                   -> API real en proceso (BD temporal), 40 personas, 4 mesas
//   npm run simular -- --personas 40 --mesas 4 --poll 2500 --semilla 7
//   npm run simular -- --golden                       -> 20 personas con los votos de la prueba sintética del golden
//   npm run simular -- --url https://staging-horizontes.estratek.com.co --usuario paola --clave '...'
//   npm run simular -- --json informe.json            -> además guarda el informe completo
//
// Sale con 1 si hay errores HTTP, alguna verificación falla o el p95 supera 500 ms.
import { fork } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CRITERIOS, type Respuestas, generadorRealista } from './distribuciones.js'
import { type Informe, type VotosGolden, simularTaller } from './simular.js'

const RAIZ = resolve(fileURLToPath(import.meta.url), '../../..')

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const bandera = (n: string) => process.argv.includes(`--${n}`)

/** Votos y esperados de tests/golden/motor_golden.json → prueba_sintetica. */
export function cargarGolden(): VotosGolden {
  const g = JSON.parse(readFileSync(resolve(RAIZ, 'tests/golden/motor_golden.json'), 'utf8'))
  const ps = g.prueba_sintetica as { votos: Record<string, number | string>[]; esperado: VotosGolden['esperado'] }
  const mapa = new Map<string, Respuestas>()
  for (const v of ps.votos) {
    mapa.set(`${v.respondiente_id}|${v.ronda}|${String(v.proyecto).toLowerCase()}`, Object.fromEntries(CRITERIOS.map((c) => [c, Number(v[c])])) as Respuestas)
  }
  return {
    respuestas(persona, ronda, proyecto) {
      const r = mapa.get(`${persona}|${ronda}|${proyecto}`)
      if (!r) throw new Error(`El golden no trae votos de la persona ${persona}, ronda ${ronda}, ${proyecto}`)
      return r
    },
    esperado: ps.esperado,
    tolerancia: g.tolerancia,
  }
}

/**
 * Levanta la API real en un proceso aparte con una BD temporal, como en producción:
 * así la latencia del cliente no se mezcla con la de 40 celulares simulados en el mismo event loop.
 * El tiempo dentro del servidor llega por IPC desde tools/simulador/servidor.ts.
 */
export async function servidorLocal(usuario: string, clave: string) {
  const dir = mkdtempSync(join(tmpdir(), 'hz-sim-'))
  const port = await puertoLibre()
  const hijo = fork(resolve(RAIZ, 'tools/simulador/servidor.ts'), [], {
    cwd: RAIZ,
    execArgv: ['--disable-warning=ExperimentalWarning', '--import', 'tsx'],
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: join(dir, 'sim.sqlite'), SUPERADMIN_USUARIO: usuario, SUPERADMIN_CLAVE: clave, USE_MOCKS: '0', BASE_URL: `http://127.0.0.1:${port}` },
    stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
  })
  const tiempos: number[] = []
  await new Promise<void>((ok, mal) => {
    hijo.on('message', (m: { listo?: boolean; tiempos?: number[] }) => {
      if (m.tiempos) tiempos.push(...m.tiempos)
      if (m.listo) ok()
    })
    hijo.once('exit', () => mal(new Error('El servidor local no arrancó.')))
  })
  const base = `http://127.0.0.1:${port}`
  return {
    base,
    tiempos,
    cerrar: async () => {
      const fin = new Promise((r) => hijo.once('exit', r))
      hijo.send({ cerrar: true })
      await fin
      rmSync(dir, { recursive: true, force: true })
    },
  }
}

function puertoLibre(): Promise<number> {
  return new Promise((ok, mal) => {
    const s = createServer()
    s.once('error', mal)
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number }
      s.close(() => ok(port))
    })
  })
}

export function imprimir(inf: Informe, tiemposServidor?: number[]) {
  const f = (x: number) => x.toFixed(1).padStart(7)
  console.log('\nLatencia por ruta, medida en el cliente (ms):')
  for (const l of inf.latencias) console.log(`  ${l.ruta.padEnd(40)} n=${String(l.n).padStart(5)}  p50=${f(l.p50)}  p95=${f(l.p95)}  máx=${f(l.max)}`)
  console.log(`  ${'TOTAL'.padEnd(40)} n=${String(inf.peticiones).padStart(5)}  p95=${f(inf.p95Total)}`)
  if (tiemposServidor?.length) {
    const s = [...tiemposServidor].sort((a, b) => a - b)
    console.log(`  ${'TOTAL dentro del servidor'.padEnd(40)} n=${String(s.length).padStart(5)}  p95=${f(s[Math.ceil(s.length * 0.95) - 1])}`)
  }
  // Errores agrupados por ruta y status: con un tope mal puesto salen cientos iguales.
  const grupos = new Map<string, { n: number; ejemplo: string }>()
  for (const e of inf.errores) {
    const k = e.replace(/\/(s|m|p)_[A-Za-z0-9]+/g, '/:id').replace(/ \{.*$/, '')
    const g = grupos.get(k) ?? { n: 0, ejemplo: e }
    g.n++
    grupos.set(k, g)
  }
  for (const [, g] of grupos) console.log(`  ✗ ${g.n} × ${g.ejemplo}`)
  const fallas = inf.verificaciones.filter((v) => !v.ok).length
  console.log(`\nSala ${inf.sala.codigo} · ${(inf.duracionMs / 1000).toFixed(0)} s · errores HTTP: ${inf.errores.length} · verificaciones con falla: ${fallas} · p95: ${inf.p95Total.toFixed(1)} ms (máx. 500)`)
  console.log(inf.ok ? 'SIMULACIÓN OK' : 'SIMULACIÓN CON FALLAS')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const golden = bandera('golden') ? cargarGolden() : undefined
  const personas = golden ? 20 : Number(arg('personas', '40'))
  const mesas = Number(arg('mesas', '4'))
  const semilla = Number(arg('semilla', '2026'))
  let base = arg('url')?.replace(/\/$/, '')
  const usuario = arg('usuario', base ? process.env.SUPERADMIN_USUARIO : 'simulador')
  const clave = arg('clave', base ? process.env.SUPERADMIN_CLAVE : 'simulador-clave-1')
  if (!usuario || !clave) {
    console.error('Contra un servidor remoto indica --usuario y --clave (o SUPERADMIN_USUARIO y SUPERADMIN_CLAVE).')
    process.exit(2)
  }
  const local = base ? null : await servidorLocal(usuario, clave)
  base ??= local!.base
  let inf: Informe
  try {
    inf = await simularTaller({ base, usuario, clave, personas, mesas, pollMs: Number(arg('poll', '2500')), semilla, generador: generadorRealista(semilla, mesas), golden, log: console.log })
  } finally {
    await local?.cerrar()
  }
  imprimir(inf, local?.tiempos)
  const json = arg('json')
  if (json) writeFileSync(json, JSON.stringify({ ...inf, tiempos_servidor_ms: local?.tiempos }, null, 2))
  process.exit(inf.ok ? 0 : 1)
}
