import seed from '../../data/seed_foodsume.json'
import { nombreCorto } from '../tablero/logica'
import type { CriterioId } from '../shared/api/contrato'
import type { Accion, EstadoSala, Pais, ZonaHoraria } from './tipos'

export const PERFILES: { id: string; nombre: string }[] = seed.perfiles

/** Los 6 criterios de la plantilla, en el orden del motor (el mismo de la hoja de votación). */
export const CRITERIOS = seed.motor.criterios.map((c) => ({ id: c.id as CriterioId, nombre: c.nombre, corto: nombreCorto(c.id, c.nombre), pregunta: c.pregunta }))

/** Los proyectos vivos que califica la sala (INSUMEX y NUTRIWHAT), en el orden de la plantilla. */
export const PROYECTOS_VIVOS = seed.plantilla.proyectos.filter((p) => p.modo === 'vivo').map((p) => ({ id: p.id, nombre: p.nombre }))

export const nombreProyecto = (id: string) => seed.plantilla.proyectos.find((p) => p.id === id)?.nombre ?? id

/** País de la sala (R4_CONTRATO C4) con su zona horaria por defecto. */
export const PAISES: Record<Pais, { nombre: string; zona: ZonaHoraria }> = {
  CO: { nombre: 'Colombia', zona: 'America/Bogota' },
  PE: { nombre: 'Perú', zona: 'America/Lima' },
  GT: { nombre: 'Guatemala', zona: 'America/Guatemala' },
}

// Ninguna de las tres zonas tiene horario de verano: el desfase es fijo.
export const ZONAS: Record<ZonaHoraria, { nombre: string; horas: number }> = {
  'America/Bogota': { nombre: 'Bogotá (UTC-5)', horas: -5 },
  'America/Lima': { nombre: 'Lima (UTC-5)', horas: -5 },
  'America/Guatemala': { nombre: 'Guatemala (UTC-6)', horas: -6 },
}

/** Zona de la sala: la configurada o la del país (Colombia si no hay ninguna). */
export const zonaSala = (c: { pais?: Pais; zona_horaria?: ZonaHoraria }): ZonaHoraria => c.zona_horaria ?? PAISES[c.pais ?? 'CO'].zona

/** ISO con zona → valor de <input type="datetime-local"> en la hora de la zona ("2026-10-20T18:00"). */
export function isoAHoraLocal(iso: string | null, zona: ZonaHoraria = 'America/Bogota'): string {
  if (!iso) return ''
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return ''
  return new Date(t + ZONAS[zona].horas * 3600 * 1000).toISOString().slice(0, 16)
}

/** Valor de <input type="datetime-local"> leído en la hora de la zona → ISO con su desfase ("-05:00"). */
export function horaLocalAIso(valor: string, zona: ZonaHoraria = 'America/Bogota'): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null
  return `${valor}:00-${String(-ZONAS[zona].horas).padStart(2, '0')}:00`
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

/** Estado de una mesa en el panel en vivo, coherente con el estado de la sala (no dice "Votando" si no hay ronda abierta). */
export function estadoMesa(
  estado: EstadoSala,
  mesa: { inscritos: number; precierre?: boolean },
): { texto: string; tono?: 'exito' | 'apagado' | 'aviso' } {
  if (mesa.inscritos === 0) return { texto: 'Sin inscritos', tono: 'apagado' }
  if (rondaAbierta(estado)) return mesa.precierre ? { texto: 'Precierre', tono: 'exito' } : { texto: 'Votando' }
  if (estado === 'r1_cerrada' || estado === 'r2_cerrada') return { texto: ESTADOS[estado], tono: 'apagado' }
  if (estado === 'cerrada') return { texto: 'Sala cerrada', tono: 'apagado' }
  return { texto: 'Esperando la ronda', tono: 'apagado' }
}

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

export const fechaHora = (iso: string | null, zona: ZonaHoraria = 'America/Bogota') =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: zona, dateStyle: 'medium', timeStyle: 'short' }) : 'Sin definir'

const TEXTO_EVENTO: Record<string, string> = {
  sala_creada: 'Sala creada',
  inscripcion_abierta: 'Inscripción abierta',
  inscripcion: 'Nueva inscripción',
  ronda_abierta: 'Ronda abierta',
  ronda_cerrada: 'Ronda cerrada',
  ronda_reabierta: 'Ronda reabierta',
  reinicio: 'Votos de la ronda reiniciados',
  sala_cerrada: 'Sala cerrada',
  sala_reabierta: 'Sala reabierta',
  precierre: 'Precierre',
  config: 'Configuración cambiada',
  participante_editado: 'Participante editado',
  cierre_programado: 'Cierre programado aplicado',
  cierre_programado_descartado: 'Cierre programado descartado',
  apertura_programada: 'Apertura programada aplicada',
  apertura_programada_descartada: 'Apertura programada descartada',
  pregunta_guiada: 'Pregunta guiada cambiada',
  rubrica_editada: 'Rúbrica editada',
}

/** Texto legible de un evento de la bitácora de la sala. */
export function textoEvento(ev: { tipo: string; detalle?: Record<string, unknown> | null; por: string }): string {
  const d = ev.detalle ?? {}
  if (typeof d.mensaje === 'string') return d.mensaje
  let t = TEXTO_EVENTO[ev.tipo] ?? ev.tipo.replace(/_/g, ' ')
  if (/^ronda_/.test(ev.tipo) && typeof d.ronda === 'number') t = t.replace('Ronda', `Ronda ${d.ronda}`)
  const por = ev.por === 'sistema' ? '' : ev.por === 'programado' ? ' · automático' : ` · ${ev.por.replace(/^admin:/, '')}`
  return t + por
}

/** Orden de las preguntas en modo guiado (C19-5): los proyectos vivos y, en cada uno, los 6 criterios. */
export const ORDEN_PREGUNTAS = PROYECTOS_VIVOS.flatMap((p) => CRITERIOS.map((c) => ({ proyecto_id: p.id, criterio_id: c.id })))

/** Aperturas y cierres programados de la sala (C19-4), en el orden del taller, para Sala en vivo. */
export function programaciones(c: Partial<Record<CampoProgramado, string | null>>): { texto: string; at: string }[] {
  const pasos: [string, CampoProgramado][] = [
    ['Abre la inscripción', 'apertura_programada_sala_at'],
    ['Abre la ronda 1', 'apertura_programada_r1_at'],
    ['Cierra la ronda 1', 'cierre_programado_r1_at'],
    ['Abre la ronda 2', 'apertura_programada_r2_at'],
    ['Cierra la ronda 2', 'cierre_programado_r2_at'],
    ['Cierra la sala', 'cierre_programado_sala_at'],
  ]
  return pasos.flatMap(([texto, campo]) => (c[campo] ? [{ texto, at: c[campo]! }] : []))
}

export type CampoProgramado =
  | 'apertura_programada_sala_at'
  | 'apertura_programada_r1_at'
  | 'cierre_programado_r1_at'
  | 'apertura_programada_r2_at'
  | 'cierre_programado_r2_at'
  | 'cierre_programado_sala_at'

/** C19-1: true si BASE_URL del servidor no es el origen desde el que se abre el panel. */
export function dominioDistinto(baseUrl: string, origen: string): boolean {
  try {
    return new URL(baseUrl).origin !== new URL(origen).origin
  } catch {
    return true
  }
}
