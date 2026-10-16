// Simulación de un taller completo por la API pública, igual que lo haría la gente en la sala:
// el admin crea la sala y abre/cierra rondas, cada celular se inscribe con consentimiento, hace polling
// de /api/yo cada 2,5 s y vota; el proyector y el panel admin también hacen polling. Al final verifica
// los puntos de la sala y de cada mesa contra un cálculo independiente (y contra el golden en modo --golden).
import { Cliente, esperar, percentil } from './cliente.js'
import { CRITERIOS, type Generador, type Respuestas, prng } from './distribuciones.js'

const PROYECTOS = ['insumex', 'nutriwhat'] as const
type Proyecto = (typeof PROYECTOS)[number]

export interface VotosGolden {
  /** Respuestas por persona (1..n), ronda y proyecto. */
  respuestas(persona: number, ronda: 1 | 2, proyecto: Proyecto): Respuestas
  esperado: Record<string, Record<string, { n: number; promedio_por_criterio: Record<string, number>; t2m: number; eje_x: number; eje_y: number }>>
  tolerancia: number
}

export interface OpcionesSimulacion {
  base: string
  usuario: string
  clave: string
  personas: number
  mesas: number
  pollMs: number
  semilla: number
  generador: Generador
  /** Si viene, los votos salen del golden y se compara la sala contra sus esperados. */
  golden?: VotosGolden
  log?: (linea: string) => void
}

export interface Verificacion {
  nombre: string
  ok: boolean
  detalle?: string
}

export interface Latencia {
  ruta: string
  n: number
  p50: number
  p95: number
  max: number
}

export interface Informe {
  ok: boolean
  sala: { id: string; codigo: string }
  errores: string[]
  verificaciones: Verificacion[]
  latencias: Latencia[]
  p95Total: number
  peticiones: number
  duracionMs: number
}

interface Persona {
  n: number
  mesa: number
  correo: string
  token: string
  etag?: string
  hojas: Record<number, number>
  votos: Record<number, Record<string, Respuestas>>
}

export async function simularTaller(op: OpcionesSimulacion): Promise<Informe> {
  const t0 = performance.now()
  const log = op.log ?? (() => {})
  const c = new Cliente(op.base)
  const azar = prng(op.semilla ^ 0x5eed)
  const verificaciones: Verificacion[] = []
  const verificar = (nombre: string, ok: boolean, detalle?: string) => {
    verificaciones.push({ nombre, ok, detalle })
    log(`  ${ok ? '✓' : '✗'} ${nombre}${detalle ? ` · ${detalle}` : ''}`)
  }
  const pausa = (max: number) => esperar(azar.siguiente() * max)

  // --- Admin: sesión y sala ---------------------------------------------------------
  const login = await c.pedir('POST', '/api/admin/login', { cuerpo: { usuario: op.usuario, clave: op.clave } })
  if (login.status !== 200) throw new Error(`No pude iniciar sesión como "${op.usuario}" (${login.status}): ${JSON.stringify(login.json)}`)
  if (login.json?.admin?.debe_cambiar_clave) throw new Error(`"${op.usuario}" debe cambiar la clave antes de usar el simulador.`)
  const adm = { cookie: (login.headers.get('set-cookie') ?? '').split(';')[0] }
  const creada = await c.pedir('POST', '/api/admin/salas', {
    cuerpo: { nombre: `Simulación ${new Date().toISOString().slice(0, 16)}${op.golden ? ' golden' : ''}`, plantilla: 'foodsume_2026', mesas: op.mesas },
    headers: adm,
  })
  if (creada.status !== 201) throw new Error(`No pude crear la sala: ${JSON.stringify(creada.json)}`)
  const sala = creada.json as { id: string; codigo: string; token_tablero: string; mesas: { id: string; codigo: string; nombre: string }[] }
  const tablero = (q = '') => c.pedir('GET', `/api/tablero/${sala.id}?t=${sala.token_tablero}${q}`)
  const accion = async (a: string) => {
    const r = await c.pedir('POST', `/api/admin/salas/${sala.id}/acciones`, { cuerpo: { accion: a }, headers: adm })
    log(`  · admin: ${a} → ${r.status}`)
    return r
  }
  log(`Sala ${sala.codigo} (${sala.id}) · ${op.personas} personas · ${op.mesas} mesas · polling ${op.pollMs} ms · ${op.base}`)
  await accion('abrir_inscripcion')

  // --- Polling de fondo: celulares, proyector y panel admin ------------------------------
  let vivo = true
  const personas: Persona[] = []
  const sondeos: Promise<void>[] = []
  const sondear = (fn: () => Promise<void>) =>
    sondeos.push(
      (async () => {
        await pausa(op.pollMs)
        while (vivo) {
          await fn()
          await esperar(op.pollMs)
        }
      })(),
    )
  let etagTablero: string | undefined
  sondear(async () => {
    const r = await c.pedir('GET', `/api/tablero/${sala.id}?t=${sala.token_tablero}`, { headers: etagTablero ? { 'if-none-match': etagTablero } : {} })
    etagTablero = r.headers.get('etag') ?? etagTablero
  })
  let etagAdmin: string | undefined
  sondear(async () => {
    const r = await c.pedir('GET', `/api/admin/salas/${sala.id}`, { headers: { ...adm, ...(etagAdmin ? { 'if-none-match': etagAdmin } : {}) } })
    etagAdmin = r.headers.get('etag') ?? etagAdmin
  })

  // --- Inscripción: cada celular abre el QR de su mesa, acepta el aviso y se inscribe ----------
  await Promise.all(
    Array.from({ length: op.personas }, async (_, i) => {
      await pausa(op.pollMs * 2)
      const mesa = i % op.mesas
      const info = await c.pedir('GET', `/api/mesas/${sala.mesas[mesa].codigo}`)
      const correo = `sim${i + 1}.${sala.codigo.toLowerCase()}@simulacion.estratek.co`
      const r = await c.pedir('POST', '/api/inscripcion', {
        cuerpo: { codigoMesa: sala.mesas[mesa].codigo, nombre: `Persona ${i + 1}`, correo, consentimiento: { aceptado: true, version: info.json?.consentimiento?.version } },
      })
      if (r.status !== 201) return
      const p: Persona = { n: i + 1, mesa, correo, token: r.json.token, hojas: {}, votos: {} }
      personas.push(p)
      sondear(async () => {
        const token = p.token
        const y = await c.pedir('GET', '/api/yo', { headers: { 'x-participante-token': token, ...(p.etag ? { 'if-none-match': p.etag } : {}) }, esperados: [401] })
        // 401 solo es esperable si el token cambió mientras la petición iba en camino (recuperó sesión en otro celular).
        if (y.status === 401 && token === p.token) c.errores.push(`GET /api/yo → 401 con el token vigente de la persona ${p.n}`)
        if (y.status === 200) {
          p.etag = y.headers.get('etag') ?? p.etag
          if (y.json.sala.ronda_actual) p.hojas[y.json.sala.ronda_actual] = y.json.contenido.hojas.length
        }
      })
    }),
  )
  personas.sort((a, b) => a.n - b.n)
  verificar('inscripción con consentimiento', personas.length === op.personas, `${personas.length}/${op.personas}`)

  const respuestasDe = (p: Persona, ronda: 1 | 2, proyecto: Proyecto) =>
    op.golden ? op.golden.respuestas(p.n, ronda, proyecto) : op.generador.respuestas(p.n, p.mesa, proyecto, ronda)
  const votar = (p: Persona, ronda: 1 | 2, proyecto: Proyecto, respuestas: Respuestas) =>
    c.pedir('PUT', '/api/votos', { cuerpo: { proyecto_id: proyecto, ronda, respuestas }, headers: { 'x-participante-token': p.token } })

  async function ronda(n: 1 | 2) {
    const abierta = await accion(`abrir_ronda_${n}`)
    if (n === 2) verificar('abrir_ronda_2 revela las hojas', abierta.json?.sala?.config?.revelar_hojas === true)
    await Promise.all(
      personas.map(async (p, i) => {
        p.votos[n] = {}
        for (const proyecto of PROYECTOS) {
          await pausa(op.pollMs * 2) // lectura de la rúbrica
          // Algunos votan primero algo distinto y lo corrigen: el servidor debe quedarse con el último.
          if (!op.golden && azar.siguiente() < 0.15) await votar(p, n, proyecto, respuestasDe(p, n === 1 ? 2 : 1, proyecto))
          p.votos[n][proyecto] = respuestasDe(p, n, proyecto)
          await votar(p, n, proyecto, p.votos[n][proyecto])
        }
        // Una persona cambia de celular a mitad de la ronda 1 y recupera su sesión con el mismo correo.
        if (n === 1 && i === 0) {
          const r = await c.pedir('POST', '/api/inscripcion', {
            cuerpo: { codigoMesa: sala.mesas[p.mesa].codigo, nombre: `Persona ${p.n}`, correo: p.correo, consentimiento: { aceptado: true, version: (await c.pedir('GET', `/api/mesas/${sala.mesas[p.mesa].codigo}`)).json.consentimiento.version } },
            esperados: [409],
          })
          verificar('recuperar sesión con el mismo correo', r.status === 409 && r.json?.participante?.id !== undefined)
          if (r.json?.token) {
            p.token = r.json.token
            p.etag = undefined
          }
        }
      }),
    )
    // Cada celular lee su vista al terminar de votar (no depender de que el polling haya alcanzado a pasar).
    await Promise.all(
      personas.map(async (p) => {
        const y = await c.pedir('GET', '/api/yo', { headers: { 'x-participante-token': p.token } })
        if (y.status === 200) p.hojas[n] = y.json.contenido.hojas.length
      }),
    )
    const t = (await tablero()).json
    verificar(`R${n}: precierre de sala al votar todos`, t?.progreso?.precierre === true && t?.preliminar === true, `${t?.progreso?.completos}/${t?.progreso?.inscritos}`)
    const res = await c.pedir('GET', '/api/resultados', { headers: { 'x-participante-token': personas[personas.length - 1].token } })
    verificar(`R${n}: el participante ve el resultado preliminar`, res.status === 200 && res.json?.preliminar === true)
    await esperar(op.pollMs) // los celulares alcanzan a ver el precierre
    await accion(`cerrar_ronda_${n}`)
    verificar(`R${n}: cerrada, el tablero deja de ser preliminar`, (await tablero()).json?.preliminar === false)
  }

  await ronda(1)
  await ronda(2)
  await esperar(op.pollMs)
  vivo = false
  await Promise.all(sondeos)

  // --- Verificación independiente de los puntos -------------------------------------------
  const calcular = (grupo: Persona[], r: number, proyecto: string) => {
    const prom = Object.fromEntries(CRITERIOS.map((k) => [k, grupo.reduce((a, p) => a + p.votos[r][proyecto][k], 0) / grupo.length])) as Respuestas
    const t2m = prom.alistamiento_tecnico * 0.3 + prom.conocimiento_cliente * 0.35 + prom.regulacion * 0.35
    return { prom, t2m, x: t2m * 0.6 + prom.capacidades_organizacionales * 0.4, y: prom.alineacion_core * 0.7 + prom.inversion_requerida * 0.3 }
  }
  const comparar = (nombre: string, t: any, grupo: Persona[]) => {
    let mal = 0
    const detalle: string[] = []
    for (const pv of t.proyectos_vivos) {
      for (const r of pv.rondas) {
        const e = calcular(grupo, r.ronda, pv.id)
        const ok =
          r.n_votos === grupo.length &&
          Math.abs(r.t2m - e.t2m) < 1e-9 &&
          Math.abs(r.eje_x - e.x) < 1e-9 &&
          Math.abs(r.eje_y - e.y) < 1e-9 &&
          CRITERIOS.every((k) => Math.abs(r.promedios[k] - e.prom[k]) < 1e-9)
        if (!ok) mal++
        detalle.push(`${pv.nombre} R${r.ronda} (${r.eje_x.toFixed(2)}, ${r.eje_y.toFixed(2)})`)
      }
    }
    verificar(nombre, mal === 0 && t.proyectos_vivos.length === 2, detalle.join(' · '))
  }
  comparar('puntos de la sala = cálculo independiente', (await tablero()).json, personas)
  for (const [i, m] of sala.mesas.entries()) {
    if (!personas.some((p) => p.mesa === i)) continue // más mesas que personas: mesa vacía
    comparar(`puntos de ${m.nombre}`, (await tablero(`&alcance=mesa&mesa=${m.id}`)).json, personas.filter((p) => p.mesa === i))
  }
  if (op.golden) {
    const g = op.golden
    const t = (await tablero()).json
    let mal = 0
    for (const pv of t.proyectos_vivos) {
      for (const r of pv.rondas) {
        const e = g.esperado[pv.nombre][String(r.ronda)]
        const ok =
          r.n_votos === e.n &&
          Math.abs(r.t2m - e.t2m) <= g.tolerancia &&
          Math.abs(r.eje_x - e.eje_x) <= g.tolerancia &&
          Math.abs(r.eje_y - e.eje_y) <= g.tolerancia &&
          CRITERIOS.every((k) => Math.abs(r.promedios[k] - e.promedio_por_criterio[k]) <= g.tolerancia)
        if (!ok) mal++
      }
    }
    verificar(`golden: prueba sintética (tolerancia ${g.tolerancia})`, mal === 0, mal ? `${mal} puntos fuera de tolerancia` : '4 de 4 puntos')
  }
  const hojasR1 = personas.every((p) => (p.hojas[1] ?? 0) > 0 && p.hojas[1] < 12)
  const hojasR2 = personas.every((p) => p.hojas[2] === 12)
  verificar('hojas: solo las propias en R1 y las 12 en R2', hojasR1 && hojasR2)

  await accion('cerrar_sala')
  const csv = await c.pedir('GET', `/api/admin/salas/${sala.id}/export/votos.csv`, { headers: adm })
  const filas = String(csv.json ?? '').trim().split('\n').length - 1
  verificar('export de votos completo', csv.status === 200 && filas === personas.length * 4, `${filas} filas`)

  // --- Informe -----------------------------------------------------------------------
  const latencias: Latencia[] = [...c.tiempos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruta, xs]) => ({ ruta, n: xs.length, p50: percentil(xs, 0.5), p95: percentil(xs, 0.95), max: Math.max(...xs) }))
  const todas = [...c.tiempos.values()].flat()
  const p95Total = percentil(todas, 0.95)
  return {
    ok: c.errores.length === 0 && verificaciones.every((v) => v.ok) && p95Total <= 500,
    sala: { id: sala.id, codigo: sala.codigo },
    errores: c.errores,
    verificaciones,
    latencias,
    p95Total,
    peticiones: todas.length,
    duracionMs: performance.now() - t0,
  }
}
