// Cliente mínimo del contrato. Dueño: T1. Uso opcional: cada área puede seguir con su propio
// transporte, pero este maneja errores con forma de contrato, el token del participante y ETag/304.
import type {
  AccionSala,
  Admin,
  AdminYo,
  Config,
  CuerpoInscripcion,
  CuerpoVoto,
  DetalleSala,
  InfoMesa,
  RespuestaInscripcion,
  RespuestaVoto,
  SalaResumen,
  Tablero,
  Yo,
} from './contrato'

export * from './contrato'

export class ErrorApi extends Error {
  constructor(
    public status: number,
    public codigo: string,
    mensaje: string,
    public cuerpo?: unknown,
  ) {
    super(mensaje)
  }
}

export const INTERVALO_POLLING_MS = 2500
const LLAVE_TOKEN = 'hz_participante_token'

export const tokenParticipante = {
  leer: (): string | null => (typeof localStorage === 'undefined' ? null : localStorage.getItem(LLAVE_TOKEN)),
  guardar: (t: string) => localStorage.setItem(LLAVE_TOKEN, t),
  borrar: () => localStorage.removeItem(LLAVE_TOKEN),
}

interface Opciones {
  metodo?: string
  cuerpo?: unknown
  etag?: string
  participante?: boolean
}

/** `null` cuando el servidor responde 304 (sin cambios desde `etag`). */
export async function pedir<T>(ruta: string, op: Opciones = {}): Promise<{ datos: T | null; etag?: string; status: number }> {
  const headers: Record<string, string> = {}
  if (op.cuerpo !== undefined) headers['Content-Type'] = 'application/json'
  if (op.etag) headers['If-None-Match'] = op.etag
  if (op.participante) {
    const t = tokenParticipante.leer()
    if (t) headers['X-Participante-Token'] = t
  }
  let r: Response
  try {
    r = await fetch(ruta, { method: op.metodo ?? 'GET', headers, credentials: 'same-origin', body: op.cuerpo === undefined ? undefined : JSON.stringify(op.cuerpo) })
  } catch {
    throw new ErrorApi(0, 'SIN_CONEXION', 'No hay conexión. Revisa tu señal; seguimos intentando.')
  }
  if (r.status === 304) return { datos: null, etag: op.etag, status: 304 }
  const texto = await r.text()
  const cuerpo = texto && (r.headers.get('content-type') ?? '').includes('json') ? JSON.parse(texto) : texto
  if (!r.ok && !(r.status === 409 && cuerpo?.token)) {
    const e = cuerpo?.error ?? { codigo: 'ERROR_HTTP', mensaje: 'Algo falló. Intenta de nuevo.' }
    throw new ErrorApi(r.status, e.codigo, e.mensaje, cuerpo)
  }
  return { datos: cuerpo as T, etag: r.headers.get('ETag') ?? undefined, status: r.status }
}

const datos = async <T>(p: Promise<{ datos: T | null }>) => (await p).datos as T

export const api = {
  // Participante
  mesa: (codigo: string) => datos(pedir<InfoMesa>(`/api/mesas/${encodeURIComponent(codigo)}`)),
  /** Guarda el token en el dispositivo. También resuelve con 409 CORREO_YA_INSCRITO (recupera la sesión). */
  inscribir: async (c: CuerpoInscripcion) => {
    const r = await datos(pedir<RespuestaInscripcion>('/api/inscripcion', { metodo: 'POST', cuerpo: c }))
    tokenParticipante.guardar(r.token)
    return r
  },
  yo: (etag?: string) => pedir<Yo>('/api/yo', { participante: true, etag }),
  votar: (c: CuerpoVoto) => datos(pedir<RespuestaVoto>('/api/votos', { metodo: 'PUT', cuerpo: c, participante: true })),
  resultados: (ronda?: number, etag?: string) => pedir<Tablero>(`/api/resultados${ronda ? `?ronda=${ronda}` : ''}`, { participante: true, etag }),

  // Tablero
  tablero: (salaId: string, q: { alcance?: 'sala' | 'mesa'; mesa?: string; t?: string }, etag?: string) => {
    const s = new URLSearchParams(Object.entries(q).filter(([, v]) => v) as [string, string][])
    return pedir<Tablero>(`/api/tablero/${encodeURIComponent(salaId)}?${s}`, { etag })
  },

  // Admin
  login: (usuario: string, clave: string) => datos(pedir<{ ok: true; admin: Admin }>('/api/admin/login', { metodo: 'POST', cuerpo: { usuario, clave } })),
  logout: () => datos(pedir<{ ok: true }>('/api/admin/logout', { metodo: 'POST' })),
  adminYo: () => datos(pedir<AdminYo>('/api/admin/yo')),
  cambiarClave: (actual: string, nueva: string) => datos(pedir<{ ok: true }>('/api/admin/cambiar-clave', { metodo: 'POST', cuerpo: { actual, nueva } })),
  salas: () => datos(pedir<{ salas: (Omit<SalaResumen, 'config'> & { mesas: number; inscritos: number })[] }>('/api/admin/salas')),
  crearSala: (nombre: string, mesas: number) => datos(pedir<SalaResumen>('/api/admin/salas', { metodo: 'POST', cuerpo: { nombre, plantilla: 'foodsume_2026', mesas } })),
  /** Sala nueva para ensayos con las mismas mesas y configuración (sin inscritos). `nombre` por defecto: "<original> (copia)". */
  duplicarSala: (id: string, nombre?: string) => datos(pedir<SalaResumen>(`/api/admin/salas/${id}/duplicar`, { metodo: 'POST', cuerpo: nombre ? { nombre } : {} })),
  sala: (id: string, etag?: string) => pedir<DetalleSala>(`/api/admin/salas/${id}`, { etag }),
  config: (id: string, cambios: Partial<Config>) => datos(pedir<Config>(`/api/admin/salas/${id}/config`, { metodo: 'PATCH', cuerpo: cambios })),
  accion: (id: string, accion: AccionSala, ronda?: number) => datos(pedir<{ sala: SalaResumen }>(`/api/admin/salas/${id}/acciones`, { metodo: 'POST', cuerpo: { accion, ronda } })),
  agregarMesas: (id: string, cantidad: number) => datos(pedir<{ mesas: DetalleSala['mesas'] }>(`/api/admin/salas/${id}/mesas`, { metodo: 'POST', cuerpo: { cantidad } })),
  editarParticipante: (id: string, cambios: { perfil_id?: string; mesa_id?: string; activo?: boolean }) =>
    datos(pedir<unknown>(`/api/admin/participantes/${id}`, { metodo: 'PATCH', cuerpo: cambios })),
  admins: () => datos(pedir<{ admins: Admin[] }>('/api/admin/admins')),
  crearAdmin: (a: { usuario: string; nombre: string; correo?: string; clave_temporal: string }) => datos(pedir<Admin>('/api/admin/admins', { metodo: 'POST', cuerpo: a })),
  editarAdmin: (id: number, c: { activo?: boolean; nombre?: string; correo?: string; restablecer_clave?: boolean | string }) =>
    datos(pedir<Admin>(`/api/admin/admins/${id}`, { metodo: 'PATCH', cuerpo: c })),
  urlQr: (mesaId: string) => `/api/admin/mesas/${mesaId}/qr.svg`,
  urlExport: (salaId: string, archivo: 'inscritos.csv' | 'votos.csv') => `/api/admin/salas/${salaId}/export/${archivo}`,
}
