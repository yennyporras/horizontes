import seed from '../../data/seed_foodsume.json'
import type { Accion, EstadoSala } from './tipos'

export const PERFILES: { id: string; nombre: string }[] = seed.perfiles

// Bogotá es UTC-5 todo el año (sin horario de verano).
const BOGOTA_MS = 5 * 3600 * 1000

/** ISO con zona → valor de <input type="datetime-local"> en hora Bogotá ("2026-10-20T18:00"). */
export function isoABogotaLocal(iso: string | null): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t - BOGOTA_MS).toISOString().slice(0, 16)
}

/** Valor de <input type="datetime-local"> leído como hora Bogotá → ISO con zona -05:00. */
export function bogotaLocalAIso(valor: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null
  return `${valor}:00-05:00`
}

export const nombrePerfil = (id: string) => PERFILES.find((p) => p.id === id)?.nombre ?? id

export const ESTADOS: Record<EstadoSala, string> = {
  preparada: 'Preparada',
  inscripcion: 'Inscripción abierta',
  r1_abierta: 'Ronda 1 abierta',
  r1_cerrada: 'Ronda 1 cerrada',
  r2_abierta: 'Ronda 2 abierta',
  r2_cerrada: 'Ronda 2 cerrada',
  cerrada: 'Sala cerrada',
}

export const ACCIONES: Record<Accion, string> = {
  abrir_inscripcion: 'Abrir inscripción',
  abrir_ronda_1: 'Abrir ronda 1',
  cerrar_ronda_1: 'Cerrar ronda 1',
  abrir_ronda_2: 'Abrir ronda 2',
  cerrar_ronda_2: 'Cerrar ronda 2',
  reabrir_ronda: 'Reabrir ronda',
  reiniciar_ronda: 'Reiniciar votos de la ronda',
  cerrar_sala: 'Cerrar sala',
  reabrir_sala: 'Reabrir sala',
}

/** Orden fijo de los botones en Sala en vivo: el admin siempre ve el ciclo completo. */
export const ORDEN_ACCIONES: Accion[] = [
  'abrir_inscripcion',
  'abrir_ronda_1',
  'cerrar_ronda_1',
  'abrir_ronda_2',
  'cerrar_ronda_2',
  'reabrir_ronda',
  'reiniciar_ronda',
  'cerrar_sala',
  'reabrir_sala',
]

/** Acciones que la máquina de estados (SPEC §3) permite desde cada estado. El servidor es quien valida. */
export const ACCIONES_POR_ESTADO: Record<EstadoSala, Accion[]> = {
  preparada: ['abrir_inscripcion', 'cerrar_sala'],
  inscripcion: ['abrir_ronda_1', 'cerrar_sala'],
  r1_abierta: ['cerrar_ronda_1', 'reiniciar_ronda', 'cerrar_sala'],
  r1_cerrada: ['abrir_ronda_2', 'reabrir_ronda', 'reiniciar_ronda', 'cerrar_sala'],
  r2_abierta: ['cerrar_ronda_2', 'reiniciar_ronda', 'cerrar_sala'],
  r2_cerrada: ['reabrir_ronda', 'reiniciar_ronda', 'cerrar_sala'],
  cerrada: ['reabrir_sala'],
}

/** Acciones que piden confirmación: título, texto y botón del diálogo. */
export const CONFIRMACIONES: Partial<Record<Accion, { titulo: string; texto: string; boton: string }>> = {
  reiniciar_ronda: {
    titulo: '¿Reiniciar los votos de la ronda?',
    texto: 'Se borran todos los votos de la ronda actual en todas las mesas. Úsalo solo en ensayos. Queda registrado en la bitácora de la sala.',
    boton: 'Sí, reiniciar votos',
  },
  cerrar_sala: {
    titulo: '¿Cerrar la sala?',
    texto: 'Nadie más podrá inscribirse ni votar. Los resultados quedan visibles. Puedes reabrirla después si lo necesitas.',
    boton: 'Sí, cerrar la sala',
  },
}

/** Ronda abierta según el estado (null si no hay ronda abierta). */
export const rondaAbierta = (e: EstadoSala) => (e === 'r1_abierta' ? 1 : e === 'r2_abierta' ? 2 : null)

/** Texto de cuenta regresiva: "1 h 05 min", "4 min 09 s". */
export function faltan(ms: number): string {
  if (ms <= 0) return 'ya'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const seg = s % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return `${m} min ${String(seg).padStart(2, '0')} s`
}

/** URL del tablero de toda la sala. Usa sala.url_tablero si el servidor la envía; si no, la deriva del tablero de una mesa. */
export function urlTableroSala(urlSala: string | undefined, urlMesa: string | undefined): string | null {
  if (urlSala) return urlSala
  if (!urlMesa) return null
  try {
    const u = new URL(urlMesa, 'http://x')
    u.searchParams.delete('mesa')
    return urlMesa.startsWith('http') ? u.toString() : `${u.pathname}${u.search}`
  } catch {
    return null
  }
}

/** Ruta interna del tablero (sin dominio) para pedir su JSON: /tablero/HZ7K2?mesa=m1&t=TOKEN → /api/tablero/{salaId}?... */
export function rutaApiTablero(salaId: string, urlTablero: string, mesaId?: string): string {
  const u = new URL(urlTablero, 'http://x')
  const q = new URLSearchParams()
  q.set('alcance', mesaId ? 'mesa' : 'sala')
  if (mesaId) q.set('mesa', mesaId)
  const t = u.searchParams.get('t')
  if (t) q.set('t', t)
  return `/api/tablero/${salaId}?${q.toString()}`
}

export const decimal = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? 'Sin votos' : n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : 'Sin definir'
