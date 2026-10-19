// Cliente del participante para el contrato v1 (docs/CONTRATO_API.md).
// Provisional hasta que T1 publique web/shared/api/: misma forma, solo cambia el import.
// Los tipos del 19-oct (modo de preguntas y pregunta guiada) ya vienen del contrato compartido.
import type { ModoPreguntas, PreguntaGuiada } from '../shared/api/contrato'

export type { ModoPreguntas, PreguntaGuiada }

export type EstadoSala = 'preparada' | 'inscripcion' | 'r1_abierta' | 'r1_cerrada' | 'r2_abierta' | 'r2_cerrada' | 'cerrada'
export type Valor = 1 | 3 | 5 | 7 | 9

/** País de la sala (R4_CONTRATO C4 y C6): define la ley que cita el aviso de datos. Sin dato, Colombia. */
export type Pais = 'CO' | 'PE' | 'GT'

export interface Mesa {
  sala: { id: string; nombre: string; estado: EstadoSala; pais?: Pais }
  mesa: { id: string; nombre: string }
  inscripcion_abierta: boolean
  consentimiento: { version: string; texto_autorizacion: string; politica_url: string }
}

export interface Perfil {
  id: string
  nombre: string
}

export interface ParticipanteYo {
  id: string
  nombre: string
  mesa: { id: string; nombre: string }
  perfil: Perfil
  activo?: boolean
}

export interface Inscripcion {
  token: string
  participante: ParticipanteYo
}

export interface ProyectoPortafolio {
  id: string
  nombre: string
  tipo?: string
  sector?: string
  descripcion?: string
  modo: 'vivo' | 'fijo'
}

export interface HojaInfo {
  proyecto_id: string
  proyecto: string
  perfil_id: string
  perfil?: string
  texto: string
}

export interface Criterio {
  id: string
  nombre: string
  pregunta: string
  rubrica: { valor: number; texto: string }[]
}

export interface Voto {
  proyecto_id: string
  ronda: number
  respuestas: Record<string, number>
  actualizado_at?: string
}

export interface ProgresoMesa {
  inscritos: number
  completos: number
  precierre: boolean
}

export interface RondaVivo {
  ronda: number
  n_votos: number
  promedios: Record<string, number> | null
  distribucion?: Record<string, Record<string, number>> | null
  t2m: number | null
  eje_x: number | null
  eje_y: number | null
  /** eje X + eje Y, calculado en el servidor (R4_CONTRATO C1). null sin votos o bajo el mínimo. */
  total?: number | null
  /** Hay votos, pero menos que `minimo_votos`: el servidor no entrega promedios ni punto. */
  bajo_minimo?: boolean
}

/** Misma forma que GET /api/tablero (recortada al alcance). Solo se muestra: el frontend nunca recalcula. */
export interface Resultados {
  version?: string
  sala?: { id: string; nombre: string; estado: EstadoSala; ronda_actual: number }
  alcance?: { tipo: 'mesa' | 'sala'; mesa_id?: string; mesa_nombre?: string }
  progreso?: { inscritos: number; completos: number; precierre: boolean; por_mesa?: (ProgresoMesa & { mesa_id: string; nombre: string })[] }
  ejes?: { x: { titulo: string; subtitulo?: string }; y: { titulo: string; subtitulo?: string } }
  criterios?: { id: string; nombre: string }[]
  proyectos_fijos?: { id: string; nombre: string; eje_x: number; eje_y: number; tam?: number }[]
  proyectos_vivos: { id: string; nombre: string; tam?: number; rondas: RondaVivo[] }[]
  preliminar?: boolean
  /** Votos mínimos por proyecto, ronda y alcance para mostrar resultados (R4_CONTRATO C3: 3). */
  minimo_votos?: number
}

export interface Yo {
  version: string
  participante: ParticipanteYo
  sala: { id: string; nombre: string; estado: EstadoSala; ronda_actual: number; pregunta_guiada?: PreguntaGuiada | null }
  config: {
    vista_participante: 'registrado' | 'en_vivo'
    alcance_resultados: 'mesa' | 'sala'
    revelar_hojas: boolean
    /** Sin dato, automático. */
    modo_preguntas?: ModoPreguntas
  }
  contenido: {
    caso: { titulo: string; descripcion_md: string; situacion_md: string }
    portafolio: ProyectoPortafolio[]
    hojas: HojaInfo[]
  }
  criterios: Criterio[]
  escala?: number[]
  mis_votos: Voto[]
  pendientes: string[]
  completo_ronda: boolean
  progreso_mesa: ProgresoMesa
  resultados: Resultados | null
}

export interface RespuestaVoto {
  voto: Voto
  completo_ronda: boolean
  progreso_mesa: ProgresoMesa
}

/** status 0 = sin red (fetch rechazado). */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public cuerpo?: unknown,
  ) {
    super(mensaje)
  }
  get esRed() {
    return this.status === 0
  }
}

interface Opciones {
  metodo?: string
  cuerpo?: unknown
  token?: string | null
  etag?: string | null
}

/** Una petición colgada (4G mala) no puede bloquear la cola ni el botón de guardar: se corta y cuenta como sin red. */
const TOPE_MS = 10_000

async function pedir(ruta: string, op: Opciones = {}): Promise<{ status: number; datos: unknown; etag: string | null }> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (op.cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (op.token) headers['X-Participante-Token'] = op.token
  if (op.etag) headers['If-None-Match'] = op.etag
  let r: Response
  const corte = typeof AbortController === 'undefined' ? null : new AbortController()
  const reloj = corte ? setTimeout(() => corte.abort(), TOPE_MS) : undefined
  try {
    r = await fetch(ruta, {
      method: op.metodo ?? 'GET',
      headers,
      body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo),
      cache: 'no-store',
      signal: corte?.signal,
    })
  } catch {
    throw new ErrorApi(0, 'SIN_RED', 'Sin conexión')
  } finally {
    clearTimeout(reloj)
  }
  if (r.status === 304) return { status: 304, datos: null, etag: op.etag ?? null }
  let datos: unknown = null
  try {
    datos = await r.json()
  } catch {
    datos = null
  }
  if (!r.ok) {
    const e = (datos as { error?: { codigo?: string; mensaje?: string } } | null)?.error
    throw new ErrorApi(r.status, e?.codigo ?? `HTTP_${r.status}`, e?.mensaje ?? 'Algo falló de nuestro lado', datos)
  }
  return { status: r.status, datos, etag: r.headers.get('ETag') }
}

export async function obtenerMesa(codigo: string): Promise<Mesa> {
  return (await pedir(`/api/mesas/${encodeURIComponent(codigo)}`)).datos as Mesa
}

/** 409 CORREO_YA_INSCRITO no es error: el servidor devuelve el mismo participante con token nuevo. */
export async function inscribirse(datos: {
  codigoMesa: string
  nombre: string
  correo: string
  version: string
}): Promise<Inscripcion & { yaInscrito: boolean }> {
  const cuerpo = { codigoMesa: datos.codigoMesa, nombre: datos.nombre, correo: datos.correo, consentimiento: { aceptado: true, version: datos.version } }
  try {
    const r = (await pedir('/api/inscripcion', { metodo: 'POST', cuerpo })).datos as Inscripcion
    return { ...r, yaInscrito: false }
  } catch (e) {
    if (e instanceof ErrorApi && e.codigo === 'CORREO_YA_INSCRITO') {
      const c = e.cuerpo as (Partial<Inscripcion> & { error?: Partial<Inscripcion> }) | null
      const token = c?.token ?? c?.error?.token
      const participante = c?.participante ?? c?.error?.participante
      if (token && participante) return { token, participante, yaInscrito: true }
    }
    throw e
  }
}

/** Devuelve null si no hubo cambios (304). */
export async function obtenerYo(token: string, etag: string | null): Promise<{ yo: Yo; etag: string | null } | null> {
  const r = await pedir('/api/yo', { token, etag })
  if (r.status === 304) return null
  return { yo: r.datos as Yo, etag: r.etag ?? (r.datos as Yo).version ?? null }
}

export async function guardarVoto(token: string, voto: { proyecto_id: string; ronda: number; respuestas: Record<string, number> }): Promise<RespuestaVoto> {
  return (await pedir('/api/votos', { metodo: 'PUT', cuerpo: voto, token })).datos as RespuestaVoto
}
