// Simulacro de demostración: crea una sala de ensayo (no cuenta en las cifras del panel) con mesas e inscritos de ejemplo y la lleva por las dos rondas
// para mostrar el flujo completo. La deja con la ronda 2 cerrada (la sala sigue abierta para explorarla).
//
//   npx tsx tools/simulacro_demo.ts --url https://horizontes.estratek.com.co --usuario pruebas --nombre "Bootcamp España"
//
// La clave se pide por la terminal sin mostrarla (o variable HZ_CLAVE). Correos de ejemplo @example.com.
import { createInterface } from 'node:readline'
import { generadorRealista } from './simulador/distribuciones.js'

const arg = (n: string, d?: string) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : d
}
const url = (arg('url') ?? '').replace(/\/+$/, '')
const usuario = arg('usuario') ?? ''
const nombre = arg('nombre') ?? 'Bootcamp de demostración'
const mesas = Number(arg('mesas', '4'))
const porMesa = Number(arg('por-mesa', '6'))
if (!url || !usuario) {
  console.error('Uso: npx tsx tools/simulacro_demo.ts --url https://… --usuario <admin> [--nombre "…"] [--mesas 4] [--por-mesa 6]')
  process.exit(2)
}

function pedirClave(): Promise<string> {
  if (process.env.HZ_CLAVE) return Promise.resolve(process.env.HZ_CLAVE)
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    const salida = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream }
    rl.question(`Clave de ${usuario}: `, (clave) => {
      rl.close()
      process.stdout.write('\n')
      resolve(clave)
    })
    salida._writeToOutput = (s) => {
      if (s.startsWith('Clave de')) salida.output.write(s)
    }
  })
}

let cookie = ''
async function pedir(metodo: string, ruta: string, cuerpo?: unknown, token?: string) {
  const r = await fetch(url + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
      ...(token ? { 'x-participante-token': token } : {}),
    },
    body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
  })
  const set = r.headers.get('set-cookie')
  if (set) cookie = set.split(';')[0]
  const texto = await r.text()
  let json: unknown = null
  try {
    json = JSON.parse(texto)
  } catch {
    /* sin cuerpo JSON */
  }
  if (!r.ok) throw new Error(`${metodo} ${ruta} → ${r.status} ${texto.slice(0, 200)}`)
  return json as Record<string, unknown>
}

const accion = (salaId: string, a: string) => pedir('POST', `/api/admin/salas/${salaId}/acciones`, { accion: a })

async function main() {
  const clave = await pedirClave()
  const login = await pedir('POST', '/api/admin/login', { usuario, clave })
  if ((login.admin as { debe_cambiar_clave?: boolean } | undefined)?.debe_cambiar_clave) {
    throw new Error(`«${usuario}» debe cambiar su clave temporal en el panel antes de usar este script.`)
  }
  const sala = (await pedir('POST', '/api/admin/salas', { nombre, plantilla: 'foodsume_2026', mesas, tipo: 'ensayo' })) as {
    id: string
    codigo: string
    mesas: { id: string; codigo: string; nombre: string }[]
  }
  console.log(`Sala «${nombre}» creada · código ${sala.codigo}`)
  await accion(sala.id, 'abrir_inscripcion')

  const info = (await pedir('GET', `/api/mesas/${sala.mesas[0].codigo}`)) as { consentimiento?: { version?: string } }
  const version = info.consentimiento?.version
  const generador = generadorRealista(2026, sala.mesas.length)
  const personas: { token: string; n: number; mesa: number }[] = []
  for (const [m, mesa] of sala.mesas.entries()) {
    for (let i = 0; i < porMesa; i++) {
      const n = m * porMesa + i + 1
      const r = (await pedir('POST', '/api/inscripcion', {
        codigoMesa: mesa.codigo,
        nombre: `Persona ${n}`,
        correo: `persona${n}.${sala.codigo.toLowerCase()}@example.com`,
        consentimiento: { aceptado: true, version },
      })) as { token: string }
      personas.push({ token: r.token, n, mesa: m })
    }
  }
  console.log(`${personas.length} personas inscritas en ${sala.mesas.length} mesas`)

  const yo = (await pedir('GET', '/api/yo', undefined, personas[0].token)) as { contenido: { portafolio: { id: string; modo: string }[] } }
  const vivos = yo.contenido.portafolio.filter((p) => p.modo === 'vivo').map((p) => p.id)

  for (const ronda of [1, 2] as const) {
    await accion(sala.id, ronda === 1 ? 'abrir_ronda_1' : 'abrir_ronda_2')
    for (const p of personas) {
      for (const proyecto of vivos) {
        const respuestas = generador.respuestas(p.n, p.mesa, proyecto, ronda)
        await pedir('PUT', '/api/votos', { proyecto_id: proyecto, ronda, respuestas }, p.token)
      }
    }
    await accion(sala.id, ronda === 1 ? 'cerrar_ronda_1' : 'cerrar_ronda_2')
    console.log(`Ronda ${ronda}: ${personas.length} personas votaron los ${vivos.length} proyectos`)
  }

  const detalle = (await pedir('GET', `/api/admin/salas/${sala.id}`)) as { sala: { url_tablero?: string } }
  const tablero = new URL(detalle.sala.url_tablero ?? '', url)
  console.log('\nListo. La sala queda con la ronda 2 cerrada para explorarla:')
  console.log(`  Panel:   ${url}/admin/salas/${sala.id}/vivo`)
  console.log(`  Tablero: ${url}${tablero.pathname}${tablero.search}`)
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exitCode = 1
})
