// Ensayo general del taller (R3): lo mismo que vive la sala, de punta a punta y con el reloj real.
//   - 4 mesas, 40 personas (la última llega tarde, en plena ronda 1), polling de celulares, proyector y panel cada 2,5 s.
//   - Precierre mesa por mesa: cada mesa termina de votar a su turno; solo esa mesa ve su resultado preliminar,
//     el panel recibe el aviso y la ronda sigue abierta. La llegada tarde deshace el precierre de su mesa.
//   - Cambio de alcance (mesa → sala) en R1 y de vista (registrado → en vivo) en R2, medido en cada celular (< 5 s).
//   - Cierre programado real de R2 a N minutos (10 por defecto) y de la sala unos segundos después (± 15 s).
//   - Puntos de la sala y de cada mesa contra un cálculo independiente; con --golden, contra tests/golden.
// Uso: `npm run ensayo` (ver docs/ENSAYO.md). Sale con 1 ante cualquier 5xx, error HTTP inesperado o verificación en rojo.
import { Cliente, esperar, percentil } from './cliente.js'
import { CRITERIOS, type Generador, type Respuestas, prng } from './distribuciones.js'
import type { Informe, Latencia, Verificacion, VotosGolden } from './simular.js'

const PROYECTOS = ['insumex', 'nutriwhat'] as const
type Proyecto = (typeof PROYECTOS)[number]

export interface OpcionesEnsayo {
  base: string
  usuario: string
  clave: string
  personas: number
  mesas: number
  pollMs: number
  semilla: number
  generador: Generador
  /** Minutos entre programar el cierre de R2 y la hora del cierre. */
  cierreMin: number
  /** Segundos entre el cierre programado de R2 y el de la sala. */
  cierreSalaSeg: number
  /** Máximo para ver un cambio de config en todos los celulares (SPEC §11.5). */
  maxPropagacionMs?: number
  /** Tolerancia del cierre programado (SPEC §11.4). */
  toleranciaCierreMs?: number
  golden?: VotosGolden
  log?: (linea: string) => void
}

export interface InformeEnsayo extends Informe {
  errores5xx: number
  propagacion: { cambio: string; maxMs: number; p50Ms: number }[]
  cierres: { que: string; programado: string; aplicado: string; desfaseMs: number; ultimoCelularMs: number }[]
}

interface Persona {
  n: number
  mesa: number
  correo: string
  token: string
  etag?: string
  yo?: any
  votos: Record<number, Record<string, Respuestas>>
}

export async function ensayarTaller(op: OpcionesEnsayo): Promise<InformeEnsayo> {
  const t0 = performance.now()
  const log = op.log ?? (() => {})
  const maxProp = op.maxPropagacionMs ?? 5000
  const tolCierre = op.toleranciaCierreMs ?? 15_000
  const c = new Cliente(op.base)
  const azar = prng(op.semilla ^ 0xe5a7)
  const verificaciones: Verificacion[] = []
  const verificar = (nombre: string, ok: boolean, detalle?: string) => {
    verificaciones.push({ nombre, ok, detalle })
    log(`  ${ok ? '✓' : '✗'} ${nombre}${detalle ? ` · ${detalle}` : ''}`)
  }
  const pausa = (max: number) => esperar(azar.siguiente() * max)
  const propagacion: InformeEnsayo['propagacion'] = []
  const cierres: InformeEnsayo['cierres'] = []

  // --- Admin --------------------------------------------------------------------------
  const login = await c.pedir('POST', '/api/admin/login', { cuerpo: { usuario: op.usuario, clave: op.clave } })
  if (login.status !== 200) throw new Error(`No pude iniciar sesión como "${op.usuario}" (${login.status}): ${JSON.stringify(login.json)}`)
  if (login.json?.admin?.debe_cambiar_clave) throw new Error(`"${op.usuario}" debe cambiar la clave antes de usar el ensayo.`)
  const adm = { cookie: (login.headers.get('set-cookie') ?? '').split(';')[0] }
  const creada = await c.pedir('POST', '/api/admin/salas', {
    cuerpo: { nombre: `Ensayo ${new Date().toISOString().slice(0, 16)}${op.golden ? ' golden' : ''}`, plantilla: 'foodsume_2026', mesas: op.mesas },
    headers: adm,
  })
  if (creada.status !== 201) throw new Error(`No pude crear la sala: ${JSON.stringify(creada.json)}`)
  const sala = creada.json as { id: string; codigo: string; token_tablero: string; mesas: { id: string; codigo: string; nombre: string }[] }
  const tablero = (q = '') => c.pedir('GET', `/api/tablero/${sala.id}?t=${sala.token_tablero}${q}`)
  const detalle = async () => (await c.pedir('GET', `/api/admin/salas/${sala.id}`, { headers: adm })).json
  const accion = async (a: string) => {
    const r = await c.pedir('POST', `/api/admin/salas/${sala.id}/acciones`, { cuerpo: { accion: a }, headers: adm })
    log(`  · admin: ${a} → ${r.status}`)
    return r
  }
  const config = async (cambios: object) => {
    const r = await c.pedir('PATCH', `/api/admin/salas/${sala.id}/config`, { cuerpo: cambios, headers: adm })
    log(`  · admin: config ${JSON.stringify(cambios)} → ${r.status}`)
    return r
  }
  log(`Ensayo en sala ${sala.codigo} (${sala.id}) · ${op.personas} personas · ${op.mesas} mesas · polling ${op.pollMs} ms · cierre R2 a ${op.cierreMin} min · ${op.base}`)
  // Punto de partida explícito: alcance por mesa y "voto registrado".
  await config({ alcance_resultados: 'mesa', vista_participante: 'registrado' })
  await accion('abrir_inscripcion')

  // --- Polling de fondo -------------------------------------------------------------------
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

  const inscribir = async (i: number, mesa = i % op.mesas) => {
    const info = await c.pedir('GET', `/api/mesas/${sala.mesas[mesa].codigo}`)
    const correo = `ensayo${i + 1}.${sala.codigo.toLowerCase()}@simulacion.estratek.co`
    const r = await c.pedir('POST', '/api/inscripcion', {
      cuerpo: { codigoMesa: sala.mesas[mesa].codigo, nombre: `Persona ${i + 1}`, correo, consentimiento: { aceptado: true, version: info.json?.consentimiento?.version } },
    })
    if (r.status !== 201) return undefined
    const p: Persona = { n: i + 1, mesa, correo, token: r.json.token, votos: {} }
    personas.push(p)
    sondear(async () => {
      const y = await c.pedir('GET', '/api/yo', { headers: { 'x-participante-token': p.token, ...(p.etag ? { 'if-none-match': p.etag } : {}) } })
      if (y.status === 200) {
        p.etag = y.headers.get('etag') ?? p.etag
        p.yo = y.json
      }
    })
    return p
  }

  /**
   * Espera a que cada celular de `grupo` vea en su polling lo que pide `pred` y devuelve cuánto tardó el último.
   * Mide desde `desde` (el momento en que el admin recibió la respuesta del cambio).
   */
  async function enCelulares(nombre: string, grupo: Persona[], pred: (yo: any) => boolean, desde: number, tope = maxProp * 3) {
    const vistos = new Map<number, number>()
    while (vistos.size < grupo.length && performance.now() - desde < tope) {
      for (const p of grupo) if (!vistos.has(p.n) && p.yo && pred(p.yo)) vistos.set(p.n, performance.now() - desde)
      await esperar(20)
    }
    const ts = [...vistos.values()]
    const maxMs = ts.length ? Math.max(...ts) : Infinity
    return { nombre, todos: vistos.size === grupo.length, maxMs, p50Ms: percentil(ts, 0.5), faltan: grupo.length - vistos.size }
  }
  const medirPropagacion = async (cambio: string, grupo: Persona[], pred: (yo: any) => boolean, desde: number) => {
    const m = await enCelulares(cambio, grupo, pred, desde)
    propagacion.push({ cambio, maxMs: Math.round(m.maxMs), p50Ms: Math.round(m.p50Ms) })
    verificar(`${cambio}: visible en los ${grupo.length} celulares en < ${maxProp / 1000} s`, m.todos && m.maxMs < maxProp, m.todos ? `último a los ${(m.maxMs / 1000).toFixed(1)} s, mediana ${(m.p50Ms / 1000).toFixed(1)} s` : `faltan ${m.faltan}`)
  }

  // --- Inscripción (la última persona llega tarde, en plena R1) ---------------------------------
  const tarde = op.personas - 1
  await Promise.all(Array.from({ length: tarde }, async (_, i) => {
    await pausa(op.pollMs * 2)
    await inscribir(i)
  }))
  personas.sort((a, b) => a.n - b.n)
  verificar('inscripción con consentimiento', personas.length === tarde, `${personas.length}/${tarde} antes de abrir R1`)

  const respuestasDe = (p: Persona, ronda: 1 | 2, proyecto: Proyecto) =>
    op.golden ? op.golden.respuestas(p.n, ronda, proyecto) : op.generador.respuestas(p.n, p.mesa, proyecto, ronda)
  const votarTodo = (grupo: Persona[], ronda: 1 | 2) =>
    Promise.all(
      grupo.map(async (p) => {
        p.votos[ronda] = {}
        for (const proyecto of PROYECTOS) {
          await pausa(op.pollMs)
          p.votos[ronda][proyecto] = respuestasDe(p, ronda, proyecto)
          await c.pedir('PUT', '/api/votos', { cuerpo: { proyecto_id: proyecto, ronda, respuestas: p.votos[ronda][proyecto] }, headers: { 'x-participante-token': p.token } })
        }
      }),
    )
  const deMesa = (m: number) => personas.filter((p) => p.mesa === m)
  const mesasConGente = () => sala.mesas.map((_, i) => i).filter((i) => deMesa(i).length > 0)
  const precierreTablero = async () => {
    const t = (await tablero()).json
    return new Map<string, boolean>(t.progreso.por_mesa.map((m: { mesa_id: string; precierre: boolean }) => [m.mesa_id, m.precierre]))
  }

  // --- Ronda 1: precierre mesa por mesa, llegada tarde y cambio de alcance -------------------------
  await accion('abrir_ronda_1')
  const abiertaR1 = await enCelulares('R1 abierta', personas, (yo) => yo.sala.estado === 'r1_abierta', performance.now())
  verificar('R1 abierta en todos los celulares', abiertaR1.todos, `último a los ${(abiertaR1.maxMs / 1000).toFixed(1)} s`)
  const ordenMesas = mesasConGente()
  for (const [k, m] of ordenMesas.entries()) {
    await votarTodo(deMesa(m), 1)
    const desde = performance.now()
    const nombreMesa = sala.mesas[m].nombre
    const pre = await precierreTablero()
    const esperado = sala.mesas.every((x, i) => pre.get(x.id) === (ordenMesas.slice(0, k + 1).includes(i)))
    verificar(`R1: precierre solo en las mesas que terminaron (${nombreMesa})`, esperado, sala.mesas.map((x) => `${x.nombre}:${pre.get(x.id) ? 'sí' : 'no'}`).join(' '))
    const ven = await enCelulares('preliminar', deMesa(m), (yo) => yo.resultados?.preliminar === true && yo.sala.estado === 'r1_abierta', desde)
    verificar(`R1: ${nombreMesa} ve su resultado preliminar sin cerrar la ronda`, ven.todos, `último a los ${(ven.maxMs / 1000).toFixed(1)} s`)
    const otras = personas.filter((p) => !ordenMesas.slice(0, k + 1).includes(p.mesa))
    verificar(`R1: las mesas que no han terminado no ven resultados (tras ${nombreMesa})`, otras.every((p) => p.yo && p.yo.resultados === null))
    const ev = (await detalle()).eventos as { tipo: string; detalle: { mensaje?: string } | null }[]
    verificar(`R1: aviso al admin "Todos votaron en ${nombreMesa}"`, ev.some((e) => e.tipo === 'precierre' && e.detalle?.mensaje?.includes(`Todos votaron en ${nombreMesa}.`)))

    if (k === 0 && tarde < op.personas) {
      // Llega tarde alguien a una mesa que ya estaba en precierre: el precierre de esa mesa desaparece.
      const p = (await inscribir(tarde, m))!
      const mesaTarde = sala.mesas[m]
      verificar(`R1: llegada tarde a ${mesaTarde.nombre} deshace su precierre`, (await precierreTablero()).get(mesaTarde.id) === false)
      await votarTodo([p], 1)
      verificar(`R1: al votar quien llegó tarde, ${mesaTarde.nombre} vuelve a precierre`, (await precierreTablero()).get(mesaTarde.id) === true)
    }
  }
  personas.sort((a, b) => a.n - b.n)
  const sinVotar = personas.filter((p) => !p.votos[1])
  if (sinVotar.length) await votarTodo(sinVotar, 1)
  const t1 = (await tablero()).json
  verificar('R1: precierre de sala con todos los votos, ronda todavía abierta', t1.progreso.precierre === true && t1.preliminar === true && t1.sala?.estado !== 'r1_cerrada', `${t1.progreso.completos}/${t1.progreso.inscritos}`)

  // Cambio de alcance en vivo: todos pasan a ver el agregado de la sala.
  let r = await config({ alcance_resultados: 'sala' })
  let desde = performance.now()
  await medirPropagacion('alcance mesa → sala', personas, (yo) => yo.config.alcance_resultados === 'sala' && yo.resultados?.alcance?.tipo === 'sala', desde)
  verificar('config de alcance → 200', r.status === 200)
  await accion('cerrar_ronda_1')
  desde = performance.now()
  const cerr1 = await enCelulares('R1 cerrada', personas, (yo) => yo.sala.estado === 'r1_cerrada' && yo.resultados?.preliminar === false, desde)
  verificar('R1: al cerrar, todos ven el resultado definitivo', cerr1.todos, `último a los ${(cerr1.maxMs / 1000).toFixed(1)} s`)

  // --- Ronda 2: vista en vivo, cierre programado real de la ronda y de la sala ------------------------
  await accion('abrir_ronda_2')
  r = await config({ vista_participante: 'en_vivo' })
  desde = performance.now()
  await medirPropagacion('vista registrado → en vivo', personas, (yo) => yo.config.vista_participante === 'en_vivo' && yo.sala.estado === 'r2_abierta', desde)
  // Segundos enteros: la BD guarda los cierres con precisión de segundo (como el panel, que programa en minutos).
  const cierreRonda = Math.ceil((Date.now() + op.cierreMin * 60_000) / 1000) * 1000
  const cierreSala = cierreRonda + op.cierreSalaSeg * 1000
  r = await config({ cierre_programado_ronda_at: new Date(cierreRonda).toISOString(), cierre_programado_sala_at: new Date(cierreSala).toISOString() })
  verificar('cierres programados aceptados', r.status === 200, `R2 a las ${new Date(cierreRonda).toISOString()}, sala ${op.cierreSalaSeg} s después`)
  await votarTodo(personas, 2)
  desde = performance.now()
  const enVivo = await enCelulares('en vivo', personas, (yo) => yo.completo_ronda === true && yo.resultados?.preliminar === true && yo.resultados?.proyectos_vivos?.[0]?.rondas?.length === 2, desde)
  verificar('R2 en vivo: quien completó ve el tablero con R1 y R2', enVivo.todos, `último a los ${(enVivo.maxMs / 1000).toFixed(1)} s`)
  const hojas = personas.every((p) => p.yo?.contenido?.hojas?.length === 12)
  verificar('R2: las 12 hojas reveladas en todos los celulares', hojas)
  const t2 = (await tablero()).json
  verificar('R2: precierre de sala y la ronda sigue abierta hasta la hora programada', t2.progreso.precierre === true && t2.preliminar === true && Date.now() < cierreRonda)

  const faltan = (cierreRonda - Date.now()) / 1000
  log(`  · esperando el cierre programado de R2 (${faltan.toFixed(0)} s) con todos los celulares haciendo polling…`)
  const medirCierre = async (que: string, tipo: string, hora: number, pred: (yo: any) => boolean) => {
    await esperar(Math.max(0, hora - Date.now()))
    const base = performance.now() - (Date.now() - hora)
    const m = await enCelulares(que, personas, pred, base, tolCierre * 2)
    const ev = ((await detalle()).eventos as { at: string; tipo: string; por: string; detalle: { accion?: string; programado_at?: string } | null }[]).find(
      (e) => e.tipo === 'cierre_programado' && e.por === 'programado' && e.detalle?.accion === tipo,
    )
    const desfase = ev ? Date.parse(ev.at) - hora : Infinity
    cierres.push({ que, programado: new Date(hora).toISOString(), aplicado: ev ? new Date(Date.parse(ev.at)).toISOString() : 'no se aplicó', desfaseMs: desfase, ultimoCelularMs: Math.round(m.maxMs) })
    verificar(`${que}: aplicado por: "programado" a la hora (± ${tolCierre / 1000} s)`, Boolean(ev) && desfase >= 0 && desfase <= tolCierre, ev ? `desfase ${(desfase / 1000).toFixed(1)} s` : 'sin evento')
    verificar(`${que}: todos los celulares lo ven en < ${(tolCierre + maxProp) / 1000} s`, m.todos && m.maxMs < tolCierre + maxProp, `último a los ${(m.maxMs / 1000).toFixed(1)} s de la hora`)
  }
  await medirCierre('cierre programado de R2', 'cerrar_ronda_2', cierreRonda, (yo) => yo.sala.estado === 'r2_cerrada' && yo.resultados?.preliminar === false)
  await medirCierre('cierre programado de la sala', 'cerrar_sala', cierreSala, (yo) => yo.sala.estado === 'cerrada')
  await esperar(op.pollMs)
  vivo = false
  await Promise.all(sondeos)

  // --- Puntos contra un cálculo independiente -------------------------------------------------
  const calcular = (grupo: Persona[], ronda: number, proyecto: string) => {
    const prom = Object.fromEntries(CRITERIOS.map((k) => [k, grupo.reduce((a, p) => a + p.votos[ronda][proyecto][k], 0) / grupo.length])) as Respuestas
    const t2m = prom.alistamiento_tecnico * 0.3 + prom.conocimiento_cliente * 0.35 + prom.regulacion * 0.35
    return { prom, t2m, x: t2m * 0.6 + prom.capacidades_organizacionales * 0.4, y: prom.alineacion_core * 0.7 + prom.inversion_requerida * 0.3 }
  }
  const comparar = (nombre: string, t: any, grupo: Persona[]) => {
    let mal = 0
    for (const pv of t.proyectos_vivos) {
      for (const rr of pv.rondas) {
        const e = calcular(grupo, rr.ronda, pv.id)
        const ok =
          rr.n_votos === grupo.length &&
          Math.abs(rr.t2m - e.t2m) < 1e-9 &&
          Math.abs(rr.eje_x - e.x) < 1e-9 &&
          Math.abs(rr.eje_y - e.y) < 1e-9 &&
          CRITERIOS.every((k) => Math.abs(rr.promedios[k] - e.prom[k]) < 1e-9)
        if (!ok) mal++
      }
    }
    verificar(nombre, mal === 0 && t.proyectos_vivos.length === 2, t.proyectos_vivos.map((pv: any) => pv.rondas.map((rr: any) => `${pv.nombre} R${rr.ronda} (${rr.eje_x.toFixed(2)}, ${rr.eje_y.toFixed(2)})`).join(' · ')).join(' · '))
  }
  comparar('puntos de la sala = cálculo independiente', (await tablero()).json, personas)
  for (const m of mesasConGente()) comparar(`puntos de ${sala.mesas[m].nombre}`, (await tablero(`&alcance=mesa&mesa=${sala.mesas[m].id}`)).json, deMesa(m))
  if (op.golden) {
    const g = op.golden
    const t = (await tablero()).json
    let mal = 0
    for (const pv of t.proyectos_vivos) {
      for (const rr of pv.rondas) {
        const e = g.esperado[pv.nombre][String(rr.ronda)]
        const ok =
          rr.n_votos === e.n &&
          Math.abs(rr.t2m - e.t2m) <= g.tolerancia &&
          Math.abs(rr.eje_x - e.eje_x) <= g.tolerancia &&
          Math.abs(rr.eje_y - e.eje_y) <= g.tolerancia &&
          CRITERIOS.every((k) => Math.abs(rr.promedios[k] - e.promedio_por_criterio[k]) <= g.tolerancia)
        if (!ok) mal++
      }
    }
    verificar(`golden: prueba sintética (tolerancia ${g.tolerancia})`, mal === 0, mal ? `${mal} puntos fuera de tolerancia` : '4 de 4 puntos')
  }
  const csv = await c.pedir('GET', `/api/admin/salas/${sala.id}/export/votos.csv`, { headers: adm })
  const filas = String(csv.json ?? '').trim().split('\n').length - 1
  verificar('export de votos completo', csv.status === 200 && filas === personas.length * 4, `${filas} filas`)

  const latencias: Latencia[] = [...c.tiempos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ruta, xs]) => ({ ruta, n: xs.length, p50: percentil(xs, 0.5), p95: percentil(xs, 0.95), max: Math.max(...xs) }))
  const todas = [...c.tiempos.values()].flat()
  const p95Total = percentil(todas, 0.95)
  const errores5xx = c.errores.filter((e) => / → 5\d\d /.test(e)).length
  return {
    ok: c.errores.length === 0 && verificaciones.every((v) => v.ok) && p95Total <= 500,
    sala: { id: sala.id, codigo: sala.codigo },
    errores: c.errores,
    errores5xx,
    verificaciones,
    latencias,
    p95Total,
    peticiones: todas.length,
    duracionMs: performance.now() - t0,
    propagacion,
    cierres,
  }
}
