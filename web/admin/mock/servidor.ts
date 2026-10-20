// Servidor simulado en memoria con la forma de docs/CONTRATO_API.md y los ejemplos de mocks/.
// Solo para desarrollo (/admin?mock=1). Cuentas de prueba: las de `inicial()` (superadmin y admin), con CLAVE_DEMO.
import detalleBase from '../../../mocks/GET_api_admin_salas_id.json'
import tableroBase from '../../../mocks/GET_api_tablero.json'
import seed from '../../../data/seed_foodsume.json'
import type { Accion, AdminFila, AdminYo, ConfigSala, EstadoSala, Mesa, Metricas, Participante, RubricasSala, SalaDetalle, SalaResumen, Sector, TipoSala } from '../tipos'
import { ACCIONES_POR_ESTADO, LARGO_MINIMO_CLAVE, rondaAbierta } from '../textos'
import type { Respuesta } from '../api'
import type { CriterioId } from '../../shared/api/contrato'

// El simulador hace de servidor: él sí lee la semilla, como el servidor real. El panel no (QA por roles del 20-oct).
const PERFILES: { id: string; nombre: string }[] = seed.perfiles
const CRITERIOS = seed.motor.criterios.map((c) => ({ id: c.id as CriterioId, nombre: c.nombre }))
const PROYECTOS_VIVOS = seed.plantilla.proyectos.filter((p) => p.modo === 'vivo').map((p) => ({ id: p.id, nombre: p.nombre }))
const nombrePerfil = (id: string) => PERFILES.find((p) => p.id === id)?.nombre ?? id

const CLAVE_DEMO = 'demo1234'
const LLAVE_SESION = 'hz_admin_mock'

/** C19-4 y C19-5 (S2, S4): programación por sala y ronda, y modo de preguntas. */
const CONFIG_19OCT = {
  apertura_programada_sala_at: null,
  apertura_programada_r1_at: null,
  cierre_programado_r1_at: null,
  apertura_programada_r2_at: null,
  cierre_programado_r2_at: null,
  modo_preguntas: 'automatico',
} as const

/** Orden del taller que valida el servidor (S2): cada hora no antes que la anterior; apertura y cierre de una etapa, estrictos. */
const ORDEN_PROGRAMADO: { campo: keyof ConfigSala; etapa: string; nombre: string }[] = [
  { campo: 'apertura_programada_sala_at', etapa: 'sala', nombre: 'la apertura de la inscripción' },
  { campo: 'apertura_programada_r1_at', etapa: 'r1', nombre: 'la apertura de la ronda 1' },
  { campo: 'cierre_programado_r1_at', etapa: 'r1', nombre: 'el cierre de la ronda 1' },
  { campo: 'apertura_programada_r2_at', etapa: 'r2', nombre: 'la apertura de la ronda 2' },
  { campo: 'cierre_programado_r2_at', etapa: 'r2', nombre: 'el cierre de la ronda 2' },
  { campo: 'cierre_programado_sala_at', etapa: 'sala', nombre: 'el cierre de la sala' },
]

/**
 * Hora del «servidor» en la zona de la sala como la escribe el servidor real (`HH:MM:SS`, con cero a la izquierda):
 * `toLocaleTimeString` daba «3:08:24» antes de las 10 de la mañana.
 */
export function horaEnZona(ms: number, zona: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zona, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(ms)
}

/** Como el servidor (S2): 422 HORA_PASADA y 422 ORDEN_INVALIDO, con sus mensajes. */
function validarConfig(actual: ConfigSala, cambio: Record<string, unknown>): Respuesta | null {
  for (const [campo, v] of Object.entries(cambio)) {
    if (/_at$/.test(campo) && typeof v === 'string' && Date.parse(v) <= Date.now()) {
      const hora = horaEnZona(Date.now(), actual.zona_horaria ?? 'America/Bogota')
      return error(422, 'HORA_PASADA', `Esa hora ya pasó. En el servidor son las ${hora}; elige una hora posterior.`)
    }
  }
  const nueva = { ...actual, ...cambio } as ConfigSala
  const definidas = ORDEN_PROGRAMADO.filter((o) => typeof nueva[o.campo] === 'string')
  for (const [k, a] of definidas.entries()) {
    for (const b of definidas.slice(k + 1)) {
      const ta = Date.parse(nueva[a.campo] as string)
      const tb = Date.parse(nueva[b.campo] as string)
      if (ta > tb || (ta === tb && a.etapa === b.etapa)) {
        return error(422, 'ORDEN_INVALIDO', `${a.nombre[0].toUpperCase()}${a.nombre.slice(1)} debe ser antes que ${b.nombre}.`)
      }
    }
  }
  return null
}

type AdminInterno = AdminFila & { clave: string }

type CriterioRubrica = RubricasSala['criterios'][number]

interface Estado {
  admins: AdminInterno[]
  salas: SalaDetalle[]
  version: number
  /** Rúbricas por sala (se copian de la semilla y de rubricasNuevas al crear la sala). */
  rubricas: Record<string, CriterioRubrica[]>
  /** Las que el admin marcó «Usar también en las salas nuevas», por criterio. */
  rubricasNuevas: Record<string, CriterioRubrica['rubrica']>
  /** Modo demo: la sala «Demostración» que avanza sola y cuándo empezó (ms). */
  demo: { salaId: string; inicio: number; terminada: boolean } | null
}

const NOMBRES = ['Ana Pérez', 'Luis Gómez', 'Marta Ríos', 'Carlos Díaz', 'Sofía Mejía', 'Andrés Rojas', 'Laura Vélez', 'Diego Castro', 'Paula Henao', 'Jorge Arango', 'Camila Ortiz', 'Felipe Duque']

function mesa(codigo: string, i: number): Mesa {
  return {
    id: `m${i}`,
    nombre: `Mesa ${i}`,
    codigo: `${codigo}-${i}`,
    url_participante: `https://horizontes.estratek.com.co/m/${codigo}-${i}`,
    url_tablero: `https://horizontes.estratek.com.co/tablero/${codigo}?mesa=m${i}&t=TOKEN`,
    inscritos: 0,
    completos: 0,
    precierre: false,
    perfiles: {},
  }
}

/** Recalcula conteos y precierre por mesa como lo haría el servidor (SPEC §4). */
function derivar(s: SalaDetalle) {
  for (const m of s.mesas) {
    const activos = s.participantes.filter((p) => p.mesa_id === m.id && p.activo)
    m.inscritos = activos.length
    m.completos = activos.filter((p) => p.completo_ronda).length
    m.precierre = rondaAbierta(s.sala.estado) !== null && m.inscritos > 0 && m.completos === m.inscritos
    m.perfiles = Object.fromEntries(PERFILES.map((pf) => [pf.id, activos.filter((p) => p.perfil_id === pf.id).length]))
  }
}

function inicial(): Estado {
  const base = structuredClone(detalleBase) as SalaDetalle
  base.sala.config = { ...CONFIG_19OCT, ...base.sala.config }
  base.sala = { ...base.sala, tipo: 'taller', empresa: 'Empresa ABC', sector: 'alimentos' }
  base.mesas = [1, 2, 3].map((i) => mesa(base.sala.codigo, i))
  base.participantes = NOMBRES.map(
    (nombre, i): Participante => ({
      id: `p_${i + 1}`,
      nombre,
      correo: `${nombre.split(' ')[0].toLowerCase()}@ejemplo.com`,
      mesa_id: `m${(i % 3) + 1}`,
      perfil_id: PERFILES[Math.floor(i / 3) % PERFILES.length].id,
      activo: true,
      completo_ronda: i % 3 === 0,
      consentimiento_at: base.sala.creada_at,
      ip: `181.50.12.${i + 10}`,
      pais: 'CO',
    }),
  )
  derivar(base)
  return {
    version: 123,
    admins: [
      { id: 1, usuario: 'paola', nombre: 'Paola Porras', correo: 'desarrollo@estratek.com.co', rol: 'superadmin', activo: true, debe_cambiar_clave: false, clave: CLAVE_DEMO },
      { id: 2, usuario: 'jorge', nombre: 'Jorge Puentes', correo: null, rol: 'admin', activo: true, debe_cambiar_clave: false, clave: CLAVE_DEMO },
    ],
    salas: [base],
    rubricas: {},
    rubricasNuevas: {},
    demo: null,
  }
}

let estado = inicial()

/** Vuelve al estado inicial. `simularVotos` en false evita votos aleatorios (pruebas deterministas). */
let simular = true
export function reiniciarMock(opciones: { simularVotos?: boolean } = {}) {
  estado = inicial()
  completaronR1.clear()
  simular = opciones.simularVotos ?? true
  sessionStorage.removeItem(LLAVE_SESION)
}

const ok = (body: unknown, status = 200): Respuesta => ({ status, body })
const error = (status: number, codigo: string, mensaje: string): Respuesta => ({ status, body: { error: { codigo, mensaje } } })

function sesion(): AdminInterno | undefined {
  const id = Number(sessionStorage.getItem(LLAVE_SESION))
  return estado.admins.find((a) => a.id === id && a.activo)
}

const yo = (a: AdminFila): AdminYo => ({ id: a.id, usuario: a.usuario, nombre: a.nombre, rol: a.rol, debe_cambiar_clave: a.debe_cambiar_clave })

function filaPublica(a: AdminInterno): AdminFila {
  const { clave: _clave, ...resto } = a
  return resto
}

function resumen(s: SalaDetalle): SalaResumen {
  const { config: _config, url_tablero: _u, pregunta_guiada: _p, ...resto } = s.sala
  return { ...resto, mesas: s.mesas.length, inscritos: s.participantes.filter((p) => p.activo).length }
}

const TIPOS: TipoSala[] = ['taller', 'ensayo']
const SECTORES_VALIDOS: Sector[] = ['alimentos', 'energia', 'financiero', 'comercio', 'salud', 'manufactura', 'otro']

/** Como el servidor (migración 8): tipo, empresa (hasta 80 caracteres) y sector de la lista, todos opcionales. */
function datosCliente(b: Record<string, unknown>): { cambio: Partial<Pick<SalaResumen, 'tipo' | 'empresa' | 'sector'>> } | { error: Respuesta } {
  const cambio: Partial<Pick<SalaResumen, 'tipo' | 'empresa' | 'sector'>> = {}
  if (b.tipo !== undefined) {
    if (!TIPOS.includes(b.tipo as TipoSala)) return { error: error(422, 'DATOS_INVALIDOS', 'El tipo de sala debe ser taller o ensayo.') }
    cambio.tipo = b.tipo as TipoSala
  }
  if (b.empresa !== undefined) {
    const e = b.empresa === null ? '' : String(b.empresa).trim()
    if (e.length > 80) return { error: error(422, 'DATOS_INVALIDOS', 'El nombre de la empresa admite hasta 80 caracteres.') }
    cambio.empresa = e || null
  }
  if (b.sector !== undefined) {
    if (b.sector !== null && !SECTORES_VALIDOS.includes(b.sector as Sector)) return { error: error(422, 'DATOS_INVALIDOS', 'Ese sector no está en la lista.') }
    cambio.sector = (b.sector as Sector | null) ?? null
  }
  return { cambio }
}

/** GET /api/admin/metricas: solo talleres con cliente con al menos una persona activa; completaron la ronda 2 quienes votaron los 2 vivos en R2. */
function metricas(): Metricas {
  const talleres = estado.salas.filter((s) => (s.sala.tipo ?? 'taller') === 'taller' && s.participantes.some((p) => p.activo))
  const activos = talleres.flatMap((s) => s.participantes.filter((p) => p.activo).map((p) => ({ p, s })))
  return {
    talleres: talleres.length,
    personas: activos.length,
    completaron_r2: activos.filter(({ p, s }) => (s.sala.ronda_actual ?? 0) === 2 && p.completo_ronda).length,
    paises: [...new Set(talleres.map((s) => s.sala.config.pais ?? 'CO'))],
  }
}

function tocar(s: SalaDetalle, tipo: string, por: string, detalle: Record<string, unknown> = {}) {
  estado.version += 1
  s.version = `v-${String(estado.version).padStart(6, '0')}`
  s.eventos.unshift({ at: new Date().toISOString(), tipo, detalle, por })
}

const SIGUIENTE: Partial<Record<Accion, EstadoSala>> = {
  abrir_inscripcion: 'inscripcion',
  abrir_ronda_1: 'r1_abierta',
  cerrar_ronda_1: 'r1_cerrada',
  abrir_ronda_2: 'r2_abierta',
  cerrar_ronda_2: 'r2_cerrada',
  cerrar_sala: 'cerrada',
  reabrir_sala: 'r2_cerrada',
}

/** Evento que el servidor anota por cada acción (server/dominio/estados.ts), con su ronda. */
const EVENTO_ACCION: Record<Accion, { tipo: string; ronda?: 1 | 2 | 'actual' }> = {
  abrir_inscripcion: { tipo: 'inscripcion_abierta' },
  abrir_ronda_1: { tipo: 'ronda_abierta', ronda: 1 },
  cerrar_ronda_1: { tipo: 'ronda_cerrada', ronda: 1 },
  abrir_ronda_2: { tipo: 'ronda_abierta', ronda: 2 },
  cerrar_ronda_2: { tipo: 'ronda_cerrada', ronda: 2 },
  reabrir_ronda: { tipo: 'ronda_reabierta', ronda: 'actual' },
  reiniciar_ronda: { tipo: 'reinicio', ronda: 'actual' },
  cerrar_sala: { tipo: 'sala_cerrada' },
  reabrir_sala: { tipo: 'sala_reabierta' },
}

/** Quiénes completaron la ronda 1 al cerrarla, por sala (el simulador solo guarda quién completó la ronda en curso). */
const completaronR1 = new Map<string, number>()

/**
 * «Resumen del taller» del detalle (QA por roles, inversionista), como el servidor: minutos de la apertura al último
 * cierre de cada ronda según la bitácora (null si no se cerró), completitud y accesos de nuevo.
 */
function resumenTaller(s: SalaDetalle): NonNullable<SalaDetalle['resumen']> {
  const cronologicos = [...s.eventos].reverse()
  const minutos = (ronda: number) => {
    const abre = cronologicos.find((e) => e.tipo === 'ronda_abierta' && e.detalle?.ronda === ronda)
    const cierra = [...cronologicos].reverse().find((e) => e.tipo === 'ronda_cerrada' && e.detalle?.ronda === ronda)
    if (!abre || !cierra) return null
    // Como el servidor: minutos con un decimal.
    return Math.max(0, Math.round((Date.parse(cierra.at) - Date.parse(abre.at)) / 6000) / 10)
  }
  const activos = s.participantes.filter((p) => p.activo)
  const r = s.sala.ronda_actual ?? 0
  return {
    minutos_r1: minutos(1),
    minutos_r2: minutos(2),
    inscritos: activos.length,
    completaron_r1: r === 1 ? activos.filter((p) => p.completo_ronda).length : r === 2 ? (completaronR1.get(s.sala.id) ?? activos.length) : 0,
    completaron_r2: r === 2 ? activos.filter((p) => p.completo_ronda).length : 0,
    accesos_nuevos: s.eventos.filter((e) => e.tipo === 'acceso_reemitido').length,
  }
}

/** Modo demo (`POST /api/admin/demo`): la sala «Demostración», 4 mesas y 24 personas de ejemplo (@example.com). */
const DEMO_MS = { inscribir: 1000, abrirR1: 4000, votarR1: 25000, abrirR2: 1000, votarR2: 25000 }

function crearDemo(por: string): Respuesta {
  if (estado.demo && !estado.demo.terminada) return error(409, 'DEMO_EN_CURSO', 'Ya hay una demostración corriendo. Espera a que termine (dura un minuto) o ábrela desde Salas.')
  const r = crearSala({ nombre: 'Demostración', mesas: 4, tipo: 'ensayo' }, por)
  if (r.status !== 201) return r
  const s = estado.salas[estado.salas.length - 1]
  estado.demo = { salaId: s.sala.id, inicio: Date.now(), terminada: false }
  return ok({ sala: resumen(s) }, 201)
}

/** La demostración avanza con el reloj: cada lectura la pone donde debería ir, como si el servidor la corriera en segundo plano. */
function avanzarDemo() {
  const d = estado.demo
  if (!d || d.terminada) return
  const s = salaPorId(d.salaId)
  if (!s) {
    estado.demo = null
    return
  }
  const t = Date.now() - d.inicio
  const abreR1 = DEMO_MS.inscribir + DEMO_MS.abrirR1
  const cierraR1 = abreR1 + DEMO_MS.votarR1
  const abreR2 = cierraR1 + DEMO_MS.abrirR2
  const cierraR2 = abreR2 + DEMO_MS.votarR2
  const accion = (a: Accion) => {
    const destino = aplicarAccion(s, a)
    if (!destino) return
    s.sala.estado = destino
    if (a === 'abrir_ronda_1' || a === 'abrir_ronda_2') s.participantes.forEach((p) => (p.completo_ronda = false))
    if (destino === 'r1_abierta') s.sala.ronda_actual = 1
    if (destino === 'r2_abierta') {
      s.sala.ronda_actual = 2
      s.sala.config.revelar_hojas = true
    }
    derivar(s)
    const ev = EVENTO_ACCION[a]
    tocar(s, ev.tipo, 'sistema', { accion: a, ...(typeof ev.ronda === 'number' ? { ronda: ev.ronda } : {}) })
  }
  const votar = (desde: number, dura: number) => {
    const meta = Math.min(s.participantes.length, Math.floor((s.participantes.length * (t - desde)) / dura))
    const faltan = meta - s.participantes.filter((p) => p.completo_ronda).length
    for (const p of s.participantes.filter((x) => !x.completo_ronda).slice(0, Math.max(0, faltan))) {
      p.completo_ronda = true
      tocar(s, 'voto', 'participante')
    }
    derivar(s)
  }
  if (t >= DEMO_MS.inscribir && s.sala.estado === 'preparada') {
    accion('abrir_inscripcion')
    for (let i = 0; i < 24; i++) {
      const m = s.mesas[i % s.mesas.length]
      const id = `${s.sala.id}_p${i + 1}`
      s.participantes.push({
        id,
        nombre: `Persona ${i + 1}`,
        correo: `persona${i + 1}@example.com`,
        mesa_id: m.id,
        perfil_id: PERFILES[Math.floor(i / s.mesas.length) % PERFILES.length].id,
        activo: true,
        completo_ronda: false,
        consentimiento_at: new Date().toISOString(),
        ip: '127.0.0.1',
        pais: 'CO',
      })
      tocar(s, 'inscripcion', 'participante', { participante_id: id, mesa_id: m.id })
    }
    derivar(s)
  }
  if (t >= abreR1 && s.sala.estado === 'inscripcion') accion('abrir_ronda_1')
  if (s.sala.estado === 'r1_abierta') votar(abreR1, DEMO_MS.votarR1)
  if (t >= cierraR1 && s.sala.estado === 'r1_abierta') {
    completaronR1.set(s.sala.id, s.participantes.filter((p) => p.completo_ronda).length)
    accion('cerrar_ronda_1')
  }
  if (t >= abreR2 && s.sala.estado === 'r1_cerrada') accion('abrir_ronda_2')
  if (s.sala.estado === 'r2_abierta') votar(abreR2, DEMO_MS.votarR2)
  if (t >= cierraR2 && s.sala.estado === 'r2_abierta') {
    accion('cerrar_ronda_2')
    d.terminada = true
  }
}

function aplicarAccion(s: SalaDetalle, accion: Accion): EstadoSala | null {
  if (!ACCIONES_POR_ESTADO[s.sala.estado].includes(accion)) return null
  if (accion === 'reiniciar_ronda') return s.sala.estado
  if (accion === 'reabrir_ronda') return s.sala.estado === 'r1_cerrada' ? 'r1_abierta' : 'r2_abierta'
  return SIGUIENTE[accion] ?? null
}

function crearSala(b: Record<string, unknown>, por: string): Respuesta {
  const nombre = String(b.nombre ?? '').trim()
  const n = Number(b.mesas)
  if (!nombre || !(n >= 1 && n <= 20)) return error(422, 'DATOS_INVALIDOS', 'Escribe un nombre y entre 1 y 20 mesas.')
  const cliente = datosCliente(b)
  if ('error' in cliente) return cliente.error
  const codigo = Math.random().toString(36).slice(2, 7).toUpperCase()
  const nueva = structuredClone(estado.salas[0])
  nueva.sala = {
    ...nueva.sala,
    id: `s_${codigo.toLowerCase()}`,
    codigo,
    nombre,
    estado: 'preparada',
    ronda_actual: 0,
    creada_at: new Date().toISOString(),
    tipo: 'taller',
    empresa: null,
    sector: null,
    ...cliente.cambio,
    // Acta del 16-oct, C5: toda sala nueva o duplicada muestra los resultados de la sala tras votar.
    config: {
      alcance_resultados: 'sala',
      vista_participante: 'en_vivo',
      revelar_hojas: false,
      cierre_programado_ronda_at: null,
      cierre_programado_sala_at: null,
      pais: 'CO',
      zona_horaria: 'America/Bogota',
      ...CONFIG_19OCT,
    },
  }
  nueva.mesas = Array.from({ length: n }, (_, i) => mesa(codigo, i + 1))
  estado.rubricas[nueva.sala.id] = rubricasIniciales()
  nueva.participantes = []
  nueva.eventos = []
  derivar(nueva)
  tocar(nueva, 'sala_creada', por)
  estado.salas.push(nueva)
  return ok(resumen(nueva), 201)
}

function admins(metodo: string, camino: string, b: Record<string, unknown>, a: AdminInterno): Respuesta {
  if (a.rol !== 'superadmin') return error(403, 'SOLO_SUPERADMIN', 'Solo el superadmin puede gestionar administradores.')
  if (metodo === 'GET') return ok(estado.admins.map(filaPublica))
  if (metodo === 'POST') {
    if (!b.usuario || !b.nombre || !b.clave_temporal) return error(422, 'DATOS_INVALIDOS', 'Usuario, nombre y clave temporal son obligatorios.')
    if (String(b.clave_temporal).length < LARGO_MINIMO_CLAVE) return error(422, 'CLAVE_INVALIDA', `La clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`)
    if (estado.admins.some((x) => x.usuario === b.usuario)) return error(409, 'USUARIO_EXISTE', 'Ese usuario ya existe.')
    const nuevo: AdminInterno = {
      id: Math.max(...estado.admins.map((x) => x.id)) + 1,
      usuario: String(b.usuario),
      nombre: String(b.nombre),
      correo: (b.correo as string) || null,
      rol: 'admin',
      activo: true,
      debe_cambiar_clave: true,
      clave: String(b.clave_temporal),
    }
    estado.admins.push(nuevo)
    return ok(filaPublica(nuevo), 201)
  }
  const objetivo = estado.admins.find((x) => x.id === Number(camino.split('/').pop()))
  if (metodo === 'PATCH' && objetivo) {
    if (objetivo.rol === 'superadmin') return error(409, 'NO_EDITABLE', 'El superadmin se administra desde el servidor.')
    if (typeof b.activo === 'boolean') objetivo.activo = b.activo
    if (typeof b.nombre === 'string') objetivo.nombre = b.nombre
    if (typeof b.correo === 'string') objetivo.correo = b.correo
    if (typeof b.restablecer_clave === 'string') {
      objetivo.clave = b.restablecer_clave
      objetivo.debe_cambiar_clave = true
    }
    return ok(filaPublica(objetivo))
  }
  return error(404, 'NO_EXISTE', 'Ese administrador no existe.')
}

/** Simula que alguien termina de votar en algunas lecturas mientras la ronda está abierta (para ver el precierre). */
function simularVoto(s: SalaDetalle) {
  if (!simular || !rondaAbierta(s.sala.estado) || Math.random() < 0.6) return
  const pendiente = s.participantes.find((p) => p.activo && !p.completo_ronda)
  if (!pendiente) return
  pendiente.completo_ronda = true
  derivar(s)
  tocar(s, 'voto', 'participante')
}

/** Como el servidor en resultados.csv: coma decimal (6,33). */
const coma = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))

const celda = (v: unknown) => {
  const t = String(v ?? '')
  return /[",;\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

function csv(s: SalaDetalle, archivo: string): string {
  const nombreMesa = (id: string) => s.mesas.find((m) => m.id === id)?.nombre ?? id
  const filas: unknown[][] =
    archivo === 'inscritos.csv'
      ? [
          ['nombre', 'correo', 'mesa', 'perfil', 'activo', 'consentimiento_version', 'consentimiento_at', 'ip', 'pais'],
          ...s.participantes.map((p) => [p.nombre, p.correo, nombreMesa(p.mesa_id), nombrePerfil(p.perfil_id), p.activo ? 'si' : 'no', 'hz-1.1', p.consentimiento_at, p.ip, p.pais]),
        ]
      : archivo === 'resultados.csv'
        ? [
            // Como el servidor: sin datos personales, solo alcances con 3 votos o más (aquí, los del tablero de ejemplo).
            ['alcance', 'ronda', 'proyecto', 'n_votos', ...CRITERIOS.map((c) => c.id), 't2m', 'eje_x', 'eje_y'],
            ...tableroBase.proyectos_vivos.flatMap((p) =>
              p.rondas
                .filter((r) => r.n_votos >= 3 && r.promedios)
                .map((r) => ['sala', r.ronda, p.nombre, r.n_votos, ...[...CRITERIOS.map((c) => (r.promedios as Record<string, number>)[c.id]), r.t2m, r.eje_x, r.eje_y].map(coma)]),
            ),
          ]
        : [['id_hash', 'mesa', 'perfil', 'ronda', 'proyecto', 'alistamiento_tecnico', 'conocimiento_cliente', 'regulacion', 'capacidades_organizacionales', 'alineacion_core', 'inversion_requerida', 'activo', 'ip', 'pais']]
  return '﻿' + filas.map((f) => f.map(celda).join(',')).join('\n') + '\n'
}

/** Las 12 hojas de la semilla, en el orden del catálogo de perfiles (como GET /api/admin/salas/{id}/hojas). Sin rayas, como el servidor. */
function hojasSemilla() {
  const proyecto = (id: string) => seed.plantilla.proyectos.find((p) => p.id === id)?.nombre ?? id
  return seed.perfiles.flatMap((pf) =>
    seed.plantilla.hojas.filter((h) => h.perfil_id === pf.id).map((h) => ({ ...h, texto: h.texto.replace(/\s*\u2014\s*/g, ', '), proyecto: proyecto(h.proyecto_id), perfil: pf.nombre })),
  )
}

function rubricasIniciales(): CriterioRubrica[] {
  return seed.motor.criterios.map((c) => ({ id: c.id, nombre: c.nombre, pregunta: c.pregunta, rubrica: estado.rubricasNuevas[c.id] ?? c.rubrica }))
}

const MOTIVO_CON_VOTOS =
  'La sala ya tiene votos. Las rúbricas solo se editan antes del primer voto, para que todos califiquen con los mismos rangos. Si necesitas otros rangos, duplica la sala y edítalos en la copia.'

/** Como el servidor: sin votos (ninguna ronda abierta todavía) se editan solo los textos de los 5 niveles. */
function rubricas(metodo: string, s: SalaDetalle, criterioId: string | undefined, b: Record<string, unknown>, por: string): Respuesta {
  const criterios = (estado.rubricas[s.sala.id] ??= rubricasIniciales())
  const editable = (s.sala.ronda_actual ?? 0) === 0
  const vista = (): RubricasSala => ({ criterios: structuredClone(criterios), editable, ...(editable ? {} : { motivo_no_editable: MOTIVO_CON_VOTOS }) })
  if (metodo === 'GET' && !criterioId) return ok(vista())
  const c = criterios.find((x) => x.id === criterioId)
  if (metodo !== 'PUT' || !c) return error(422, 'CRITERIO_NO_EXISTE', 'Ese criterio no existe en esta sala.')
  const niveles = Array.isArray(b.rubrica) ? (b.rubrica as { valor: number; texto: string }[]) : []
  const textos = new Map(niveles.map((n) => [n.valor, String(n.texto ?? '').trim()]))
  if (niveles.length !== 5 || c.rubrica.some((r) => !textos.get(r.valor))) return error(422, 'RUBRICA_INVALIDA', 'Escribe el texto de los 5 niveles: 1, 3, 5, 7 y 9.')
  if ([...textos.values()].some((t) => t.length > 300)) return error(422, 'RUBRICA_INVALIDA', 'Cada texto admite hasta 300 caracteres.')
  if (!editable) return error(409, 'RUBRICA_CON_VOTOS', MOTIVO_CON_VOTOS)
  c.rubrica = c.rubrica.map((r) => ({ valor: r.valor, texto: textos.get(r.valor)! }))
  if (b.usar_en_salas_nuevas === true) estado.rubricasNuevas[c.id] = structuredClone(c.rubrica)
  tocar(s, 'rubrica_editada', por, { criterio_id: c.id, usar_en_salas_nuevas: b.usar_en_salas_nuevas === true })
  return ok(vista())
}

/** Respuestas por persona (C19-3): las rondas ya cerradas de todos los activos y la ronda en curso de quien la completó. */
function respuestasSimuladas(s: SalaDetalle) {
  const valores = [1, 3, 5, 7, 9]
  const ronda = s.sala.ronda_actual ?? 0
  return s.participantes.flatMap((p, i) =>
    p.activo
      ? [1, 2]
          .filter((r) => r < ronda || (r === ronda && p.completo_ronda))
          .flatMap((r) =>
            PROYECTOS_VIVOS.map((pr, j) => ({
              participante_id: p.id,
              nombre: p.nombre,
              correo: p.correo,
              mesa_id: p.mesa_id,
              mesa: s.mesas.find((m) => m.id === p.mesa_id)?.nombre ?? p.mesa_id,
              perfil_id: p.perfil_id,
              ronda: r,
              proyecto_id: pr.id,
              respuestas: Object.fromEntries(CRITERIOS.map((c, k) => [c.id, valores[(i + j + k + r) % 5]])),
              actualizado_at: s.sala.creada_at,
            })),
          )
      : [],
  )
}

function salaPorId(id: string) {
  return estado.salas.find((x) => x.sala.id === id)
}

export async function responderMock(metodo: string, ruta: string, cuerpo?: unknown, etag?: string): Promise<Respuesta> {
  const [camino, consulta = ''] = ruta.split('?')
  const b = (cuerpo ?? {}) as Record<string, unknown>
  avanzarDemo()

  if (metodo === 'POST' && camino === '/api/admin/login') {
    const a = estado.admins.find((x) => x.usuario === b.usuario && x.activo)
    if (!a || a.clave !== b.clave) return error(401, 'CREDENCIALES_INVALIDAS', 'Usuario o clave incorrectos.')
    sessionStorage.setItem(LLAVE_SESION, String(a.id))
    return ok(yo(a))
  }
  if (metodo === 'POST' && camino === '/api/admin/logout') {
    sessionStorage.removeItem(LLAVE_SESION)
    return ok({ ok: true })
  }

  if (metodo === 'GET' && camino === '/api/health') return ok({ ok: true, modo: 'simulado', version: 'simulador' })

  // Tablero (token por query; en el simulador no se valida).
  const t = /^\/api\/tablero\/([^/]+)$/.exec(camino)
  if (metodo === 'GET' && t) {
    const s = salaPorId(t[1])
    if (!s) return error(404, 'SALA_NO_EXISTE', 'Esa sala no existe.')
    const m = s.mesas.find((x) => x.id === new URLSearchParams(consulta).get('mesa'))
    const alcance = m ? { tipo: 'mesa', mesa_id: m.id, mesa_nombre: m.nombre } : { tipo: 'sala' }
    return ok({ ...structuredClone(tableroBase), version: s.version, alcance, preliminar: rondaAbierta(s.sala.estado) !== null })
  }

  const a = sesion()
  if (!a) return error(401, 'NO_AUTENTICADO', 'Tu sesión terminó. Vuelve a iniciar sesión.')
  const por = `admin:${a.usuario}`

  if (metodo === 'GET' && camino === '/api/admin/yo') return ok(yo(a))

  if (metodo === 'POST' && camino === '/api/admin/cambiar-clave') {
    if (b.actual !== a.clave) return error(422, 'CLAVE_ACTUAL_INVALIDA', 'La clave actual no coincide.')
    if (typeof b.nueva !== 'string' || b.nueva.length < LARGO_MINIMO_CLAVE) return error(422, 'CLAVE_INVALIDA', `La clave debe tener al menos ${LARGO_MINIMO_CLAVE} caracteres.`)
    a.clave = b.nueva
    a.debe_cambiar_clave = false
    return ok(yo(a))
  }

  if (camino.startsWith('/api/admin/admins')) return admins(metodo, camino, b, a)

  // Las salas nuevas vuelven a la rúbrica de la semilla en ese criterio (idempotente), como el servidor.
  const plantilla = /^\/api\/admin\/rubricas-plantilla\/([^/]+)$/.exec(camino)
  if (metodo === 'DELETE' && plantilla) {
    const c = seed.motor.criterios.find((x) => x.id === decodeURIComponent(plantilla[1]))
    if (!c) return error(422, 'CRITERIO_NO_EXISTE', 'Ese criterio no existe.')
    const borrada = c.id in estado.rubricasNuevas
    delete estado.rubricasNuevas[c.id]
    return ok({ plantilla: 'foodsume_2026', criterio_id: c.id, borrada, rubrica: c.rubrica })
  }

  if (camino === '/api/admin/salas') {
    if (metodo === 'GET') return ok(estado.salas.map(resumen))
    if (metodo === 'POST') return crearSala(b, por)
  }

  if (metodo === 'GET' && camino === '/api/admin/metricas') return ok(metricas())

  if (metodo === 'POST' && camino === '/api/admin/demo') {
    if (a.rol !== 'superadmin') return error(403, 'SOLO_SUPERADMIN', 'Solo el superadmin puede crear una demostración.')
    return crearDemo(por)
  }

  const m = /^\/api\/admin\/salas\/([^/]+)(\/.*)?$/.exec(camino)
  if (m) {
    const s = salaPorId(m[1])
    if (!s) return error(404, 'SALA_NO_EXISTE', 'Esa sala no existe.')
    const resto = m[2] ?? ''
    if (metodo === 'GET' && resto === '') {
      simularVoto(s)
      // ETag fuerte entre comillas, como el servidor (RFC 9110): el navegador lo devuelve tal cual en If-None-Match.
      const etagSala = `"${s.version}"`
      if (etag && etag === etagSala) return { status: 304, body: null, etag: etagSala }
      // Como el servidor: el detalle trae el catálogo de perfiles (no trae criterios ni proyectos vivos).
      const conResumen = s.sala.estado === 'r2_cerrada' || s.sala.estado === 'cerrada' ? { resumen: resumenTaller(s) } : {}
      return {
        status: 200,
        body: { ...structuredClone(s), ...conResumen, perfiles: PERFILES, admin_actual: yo(a), servidor_at: new Date().toISOString(), base_url: window.location.origin },
        etag: etagSala,
      }
    }
    if (metodo === 'POST' && resto === '/duplicar') {
      // Como el servidor: duplicar para ensayo crea una sala `tipo: 'ensayo'` con la misma empresa y sector.
      const r = crearSala(
        { nombre: (typeof b.nombre === 'string' && b.nombre.trim()) || `${s.sala.nombre} (copia)`, mesas: s.mesas.length || 1, tipo: 'ensayo', empresa: s.sala.empresa ?? null, sector: s.sala.sector ?? null },
        por,
      )
      // Como el servidor: la copia lleva las rúbricas de la original.
      if (r.status === 201) estado.rubricas[estado.salas[estado.salas.length - 1].sala.id] = structuredClone(estado.rubricas[s.sala.id] ?? rubricasIniciales())
      return r
    }
    if (metodo === 'GET' && resto === '/hojas') return ok({ hojas: hojasSemilla() })
    if (metodo === 'GET' && resto === '/respuestas') return ok({ respuestas: respuestasSimuladas(s) })
    const r = /^\/rubricas(?:\/([^/]+))?$/.exec(resto)
    if (r) return rubricas(metodo, s, r[1], b, por)
    if (metodo === 'GET' && resto.startsWith('/export/')) return ok(csv(s, resto.slice('/export/'.length)))
    if (metodo === 'PATCH' && resto === '/config') {
      // Tipo, empresa y sector (migración 8) van en la sala, no en la configuración.
      const { tipo: _t, empresa: _e, sector: _s, ...config } = b
      const cliente = datosCliente(b)
      if ('error' in cliente) return cliente.error
      const rechazo = validarConfig(s.sala.config, config)
      if (rechazo) return rechazo
      Object.assign(s.sala, cliente.cambio)
      Object.assign(s.sala.config, config)
      // Como el servidor: cambiar el modo borra la pregunta guiada.
      if ('modo_preguntas' in b) s.sala.pregunta_guiada = null
      tocar(s, 'config', por, b)
      return ok(s.sala.config)
    }
    if (metodo === 'PUT' && resto === '/pregunta-guiada') {
      if (!rondaAbierta(s.sala.estado)) return error(409, 'RONDA_CERRADA', 'La pregunta guiada solo se cambia con una ronda abierta.')
      const pregunta = cuerpo && typeof b.proyecto_id === 'string' && typeof b.criterio_id === 'string' ? { proyecto_id: b.proyecto_id, criterio_id: b.criterio_id as CriterioId } : null
      s.sala.pregunta_guiada = pregunta
      tocar(s, 'pregunta_guiada', por, pregunta ?? {})
      return ok({ pregunta_guiada: pregunta, version: s.version })
    }
    if (metodo === 'POST' && resto === '/mesas') {
      const n = Number(b.cantidad)
      if (!(n >= 1 && n <= 20)) return error(422, 'DATOS_INVALIDOS', 'Agrega entre 1 y 20 mesas.')
      const inicio = s.mesas.length
      for (let i = 1; i <= n; i++) s.mesas.push(mesa(s.sala.codigo, inicio + i))
      derivar(s)
      tocar(s, 'mesas_agregadas', por, { cantidad: n })
      return ok({ mesas: s.mesas }, 201)
    }
    if (metodo === 'POST' && resto === '/acciones') {
      // Como el servidor (B-2): token nuevo del tablero en cualquier estado; los enlaces anteriores dejan de servir.
      if (b.accion === 'regenerar_token_tablero') {
        const t = `T${Date.now().toString(36)}`
        const cambiar = (u: string) => u.replace(/t=[^&]*/, `t=${t}`)
        if (s.sala.url_tablero) s.sala.url_tablero = cambiar(s.sala.url_tablero)
        s.mesas.forEach((m) => (m.url_tablero = cambiar(m.url_tablero)))
        tocar(s, 'token_tablero_regenerado', por)
        return ok({ sala: s.sala })
      }
      const accion = b.accion as Accion
      const destino = aplicarAccion(s, accion)
      if (!destino) return error(409, 'TRANSICION_INVALIDA', 'Esa acción no aplica en el estado actual de la sala.')
      s.sala.estado = destino
      s.sala.pregunta_guiada = null
      // Ronda nueva o votos reiniciados: nadie ha completado la ronda.
      if (accion === 'abrir_ronda_1' || accion === 'abrir_ronda_2' || accion === 'reiniciar_ronda') s.participantes.forEach((p) => (p.completo_ronda = false))
      if (destino === 'r1_abierta') s.sala.ronda_actual = 1
      if (destino === 'r2_abierta') {
        s.sala.ronda_actual = 2
        if (accion === 'abrir_ronda_2') s.sala.config.revelar_hojas = true
      }
      derivar(s)
      const ev = EVENTO_ACCION[accion]
      tocar(s, ev.tipo, por, { accion, ...(ev.ronda ? { ronda: ev.ronda === 'actual' ? s.sala.ronda_actual : ev.ronda } : {}) })
      return ok({ estado: destino })
    }
  }

  // D1: enlace personal de un solo uso que vence en 15 minutos (el servidor real lo implementa en POST .../acceso).
  const acceso = /^\/api\/admin\/participantes\/([^/]+)\/acceso$/.exec(camino)
  if (metodo === 'POST' && acceso) {
    for (const s of estado.salas) {
      const par = s.participantes.find((x) => x.id === acceso[1])
      if (!par) continue
      if (s.sala.estado === 'cerrada') return error(409, 'SALA_CERRADA', 'La sala está cerrada: ya no se puede dar acceso de nuevo.')
      if (!par.activo) return error(409, 'PARTICIPANTE_INACTIVO', 'Ese participante está desactivado. Actívalo antes de darle acceso de nuevo.')
      const mesaPar = s.mesas.find((m) => m.id === par.mesa_id)
      const clave = Math.random().toString(36).slice(2, 12)
      const venceAt = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      tocar(s, 'acceso_reemitido', por, { participante_id: par.id, vence_at: venceAt })
      return ok({ url: `${window.location.origin}/m/${mesaPar?.codigo ?? s.sala.codigo}?acceso=${clave}`, vence_at: venceAt })
    }
    return error(404, 'PARTICIPANTE_NO_EXISTE', 'Ese participante no existe.')
  }

  const p = /^\/api\/admin\/participantes\/([^/]+)$/.exec(camino)
  if (metodo === 'PATCH' && p) {
    for (const s of estado.salas) {
      const par = s.participantes.find((x) => x.id === p[1])
      if (par) {
        Object.assign(par, b)
        derivar(s)
        tocar(s, 'participante_editado', por, { id: par.id })
        return ok(par)
      }
    }
    return error(404, 'PARTICIPANTE_NO_EXISTE', 'Ese participante no existe.')
  }

  return error(404, 'RUTA_NO_EXISTE', `El simulador no conoce ${metodo} ${camino}.`)
}

// usaMocks() reconoce el simulador por esta marca (las pruebas lo usan directo con usarTransporte).
;(responderMock as typeof responderMock & { simulador?: true }).simulador = true
