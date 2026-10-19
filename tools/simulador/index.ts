// Simulador de taller (SPEC §11.1). Resultados del ensayo en docs/ENSAYO.md.
//
//   npm run simular                                   -> API real en proceso (BD temporal), 40 personas, 4 mesas
//   npm run simular -- --personas 40 --mesas 4 --poll 2500 --semilla 7
//   npm run simular -- --golden                       -> 20 personas con los votos de la prueba sintética del golden
//   npm run simular -- --url https://staging-horizontes.estratek.com.co --usuario paola --clave '...'
//   npm run simular -- --json informe.json            -> además guarda el informe completo
//   npm run ensayo                                    -> ensayo general (tools/simulador/ensayo.ts): precierre por mesa,
//                                                        cambios en vivo y cierre programado real a 10 min (--cierre-min N)
//   npm run ensayo -- --md docs/ENSAYO_corrida.md      -> además escribe el informe en markdown
//   --puerto 4101                                     -> puerto fijo para la API local (por defecto uno libre)
//
// Sale con 1 si hay errores HTTP, alguna verificación falla o el p95 supera 500 ms.
import { fork } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CRITERIOS, type Respuestas, generadorRealista } from './distribuciones.js'
import { type InformeEnsayo, ensayarTaller } from './ensayo.js'
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
export async function servidorLocal(usuario: string, clave: string, puerto?: number) {
  const dir = mkdtempSync(join(tmpdir(), 'hz-sim-'))
  const port = puerto ?? (await puertoLibre())
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

/** Informe del ensayo en markdown (para docs/ENSAYO.md). */
export function informeMarkdown(e: InformeEnsayo, ctx: { personas: number; mesas: number; golden: boolean; base: string; tiemposServidor?: number[] }) {
  const f = (x: number) => x.toFixed(1)
  const s = ctx.tiemposServidor?.length ? [...ctx.tiemposServidor].sort((a, b) => a - b) : []
  const l: string[] = []
  l.push(`### Corrida ${new Date().toISOString().slice(0, 16)}Z · ${ctx.golden ? 'golden' : 'realista'} · ${ctx.personas} personas · ${ctx.mesas} mesas · ${ctx.base}`)
  l.push('')
  l.push(`Resultado: **${e.ok ? 'OK' : 'CON FALLAS'}** · sala ${e.sala.codigo} · ${(e.duracionMs / 60000).toFixed(1)} min · ${e.peticiones} peticiones · errores HTTP ${e.errores.length} · 5xx ${e.errores5xx} · p95 cliente ${f(e.p95Total)} ms${s.length ? ` · p95 servidor ${f(s[Math.ceil(s.length * 0.95) - 1])} ms` : ''}`)
  l.push('')
  l.push('| Verificación | | Detalle |', '|---|---|---|')
  for (const v of e.verificaciones) l.push(`| ${v.nombre} | ${v.ok ? 'OK' : 'FALLA'} | ${(v.detalle ?? '').replace(/\|/g, '/')} |`)
  l.push('', '| Cambio en vivo | Mediana | Último celular |', '|---|---|---|')
  for (const p of e.propagacion) l.push(`| ${p.cambio} | ${p.p50Ms} ms | ${p.maxMs} ms |`)
  l.push('', '| Cierre programado | Programado | Aplicado | Desfase | Último celular |', '|---|---|---|---|---|')
  for (const c of e.cierres) l.push(`| ${c.que} | ${c.programado} | ${c.aplicado} | ${c.desfaseMs} ms | ${c.ultimoCelularMs} ms |`)
  l.push('', '| Ruta | n | p50 | p95 | máx. |', '|---|---|---|---|---|')
  for (const r of e.latencias) l.push(`| ${r.ruta} | ${r.n} | ${f(r.p50)} | ${f(r.p95)} | ${f(r.max)} |`)
  if (e.errores.length) l.push('', 'Errores:', ...e.errores.slice(0, 20).map((x) => `- ${x}`))
  return `${l.join('\n')}\n`
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
  const local = base ? null : await servidorLocal(usuario, clave, arg('puerto') ? Number(arg('puerto')) : undefined)
  base ??= local!.base
  const comun = { base, usuario, clave, personas, mesas, pollMs: Number(arg('poll', '2500')), semilla, generador: generadorRealista(semilla, mesas), golden, log: console.log }
  let inf: Informe
  try {
    inf = bandera('ensayo')
      ? await ensayarTaller({ ...comun, cierreMin: Number(arg('cierre-min', '10')), cierreSalaSeg: Number(arg('cierre-sala-seg', '20')) })
      : await simularTaller(comun)
  } finally {
    await local?.cerrar()
  }
  imprimir(inf, local?.tiempos)
  if (bandera('ensayo')) {
    const e = inf as InformeEnsayo
    console.log(`\nErrores 5xx: ${e.errores5xx}`)
    for (const p of e.propagacion) console.log(`  propagación ${p.cambio}: mediana ${p.p50Ms} ms, último celular ${p.maxMs} ms`)
    for (const c of e.cierres) console.log(`  ${c.que}: programado ${c.programado}, aplicado ${c.aplicado} (desfase ${c.desfaseMs} ms), último celular ${c.ultimoCelularMs} ms`)
    const md = arg('md')
    if (md) writeFileSync(md, informeMarkdown(e, { personas, mesas, golden: Boolean(golden), base: arg('url') ?? 'local', tiemposServidor: local?.tiempos }))
  }
  const json = arg('json')
  if (json) writeFileSync(json, JSON.stringify({ ...inf, tiempos_servidor_ms: local?.tiempos }, null, 2))
  process.exit(inf.ok ? 0 : 1)
}
