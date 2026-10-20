// Cliente del participante para el contrato v1 (docs/CONTRATO_API.md). Los tipos son los del contrato
// compartido (web/shared/api/contrato.ts); aquí solo viven el transporte del celular y sus alias de nombre.
import type {
  Criterio,
  CuerpoVoto,
  EstadoSala,
  HojaPerfil,
  InfoMesa,
  ModoPreguntas,
  Pais,
  ParticipantePublico,
  PreguntaGuiada,
  ProgresoMesa,
  RespuestaInscripcion,
  RespuestaVoto,
  RondaVivo,
  Tablero,
  Valor,
  Voto,
  Yo,
} from '../shared/api/contrato'

export type { Criterio, EstadoSala, ModoPreguntas, Pais, PreguntaGuiada, ProgresoMesa, RespuestaVoto, RondaVivo, Valor, Voto, Yo }

/** GET /api/mesas/{codigo}. */
export type Mesa = InfoMesa
export type ParticipanteYo = ParticipantePublico
export type HojaInfo = HojaPerfil
export type ProyectoPortafolio = Yo['contenido']['portafolio'][number]
/** Resultado del alcance en `/api/yo`: la misma forma que GET /api/tablero. Solo se muestra; el celular nunca recalcula. */
export type Resultados = Tablero
/** Inscripción y canje de un acceso nuevo: token y participante. */
export type Sesion = Pick<RespuestaInscripcion, 'token' | 'participante'>

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

/**
 * POST /api/inscripcion. Un 409 `CORREO_YA_INSCRITO` es un error más (decisión D1 del 20-oct): ya no trae token,
 * y quien perdió la sesión entra con el acceso nuevo que le da el facilitador.
 */
export async function inscribirse(datos: { codigoMesa: string; nombre: string; correo: string; version: string }): Promise<Sesion> {
  const cuerpo = { codigoMesa: datos.codigoMesa, nombre: datos.nombre, correo: datos.correo, consentimiento: { aceptado: true, version: datos.version } }
  const r = (await pedir('/api/inscripcion', { metodo: 'POST', cuerpo })).datos as Sesion
  return { token: r.token, participante: r.participante }
}

/**
 * POST /api/acceso (D1): canjea el enlace de un solo uso que genera «Dar acceso de nuevo» en el panel
 * por una sesión nueva. 410 `ACCESO_VENCIDO`, 404 `ACCESO_INVALIDO`.
 */
export async function canjearAcceso(acceso: string): Promise<Sesion> {
  const r = (await pedir('/api/acceso', { metodo: 'POST', cuerpo: { acceso } })).datos as Sesion
  return { token: r.token, participante: r.participante }
}

/** Devuelve null si no hubo cambios (304). */
export async function obtenerYo(token: string, etag: string | null): Promise<{ yo: Yo; etag: string | null } | null> {
  const r = await pedir('/api/yo', { token, etag })
  if (r.status === 304) return null
  return { yo: r.datos as Yo, etag: r.etag ?? (r.datos as Yo).version ?? null }
}

/** PUT /api/votos con el voto completo. Lo marcado vive en el celular como `Record<string, number>` hasta aquí. */
export async function guardarVoto(token: string, voto: { proyecto_id: string; ronda: number; respuestas: Record<string, number> }): Promise<RespuestaVoto> {
  return (await pedir('/api/votos', { metodo: 'PUT', cuerpo: voto as CuerpoVoto, token })).datos as RespuestaVoto
}
