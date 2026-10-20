import type { CriterioId } from '../shared/api/contrato'
import type { Accion, EstadoSala, Pais, Sector, TipoSala, ZonaHoraria } from './tipos'
import { CONTENIDO_VACIO, nombreCriterio, nombrePerfil, nombreProyecto, numeroPregunta, type ContenidoSala } from './contenido'

/**
 * Largo mínimo de una clave de administrador. Es el que exige el servidor (LARGO_MINIMO_CLAVE en
 * server/dominio/admins.ts); el panel no importa el servidor, así que una prueba verifica que coincidan.
 */
export const LARGO_MINIMO_CLAVE = 8

/** País de la sala (acta del 16-oct, C4) con su zona horaria por defecto. */
export const PAISES: Record<Pais, { nombre: string; zona: ZonaHoraria }> = {
  CO: { nombre: 'Colombia', zona: 'America/Bogota' },
  PE: { nombre: 'Perú', zona: 'America/Lima' },
  GT: { nombre: 'Guatemala', zona: 'America/Guatemala' },
}

/** QA por roles del 20-oct (inversionista): los ensayos no cuentan en las métricas del negocio. */
export const TIPOS_SALA: Record<TipoSala, string> = {
  taller: 'Taller con cliente',
  ensayo: 'Ensayo',
}

/** Sectores de la empresa cliente (lista del contrato, migración 8). */
export const SECTORES: Record<Sector, string> = {
  alimentos: 'Alimentos',
  energia: 'Energía',
  financiero: 'Financiero',
  comercio: 'Comercio',
  salud: 'Salud',
  manufactura: 'Manufactura',
  otro: 'Otro',
}

/** Largo máximo del nombre de la empresa cliente (el que valida el servidor). */
export const LARGO_MAXIMO_EMPRESA = 80

/** Nombre del país por su código; si no es uno de los tres, el código. */
export const nombrePais = (codigo: string) => PAISES[codigo as Pais]?.nombre ?? codigo

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

/** Orden del ciclo del taller; también el de las acciones para corregir en Sala en vivo. */
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

/**
 * QA-A-01: el paso que sigue en el taller, el único botón principal de Sala en vivo. Nunca es una acción que deshace
 * (Reabrir). Con la ronda 2 cerrada, lo que sigue es cerrar la sala; con la sala cerrada, exportar (no es una acción
 * de la sala: el panel muestra el enlace a Exportar).
 */
export const PASO_SIGUIENTE: Record<EstadoSala, Accion | null> = {
  preparada: 'abrir_inscripcion',
  inscripcion: 'abrir_ronda_1',
  r1_abierta: 'cerrar_ronda_1',
  r1_cerrada: 'abrir_ronda_2',
  r2_abierta: 'cerrar_ronda_2',
  r2_cerrada: 'cerrar_sala',
  cerrada: null,
}

/** QA-A-05: lo posible en este estado que no es el paso que sigue; va aparte, en «Corregir». */
export const accionesParaCorregir = (estado: EstadoSala): Accion[] =>
  ORDEN_ACCIONES.filter((a) => ACCIONES_POR_ESTADO[estado].includes(a) && a !== PASO_SIGUIENTE[estado])

/** Qué pasa al pulsar cada acción, en una línea, junto al botón. */
export const QUE_PASA: Record<Accion, string> = {
  abrir_inscripcion: 'Los QR empiezan a funcionar: cada persona se inscribe, recibe su perfil y lee el caso.',
  abrir_ronda_1: 'Cada persona califica INSUMEX y NUTRIWHAT sola y en silencio, con la hoja de su perfil.',
  cerrar_ronda_1: 'Nadie más responde la ronda 1 y queda su resultado final.',
  abrir_ronda_2: 'Se abren las 6 hojas para todos. Cada mesa conversa y vuelve a calificar.',
  cerrar_ronda_2: 'Nadie más responde la ronda 2. Después pon el tablero en Comparación (tecla C).',
  reabrir_ronda: 'La última ronda vuelve a recibir votos. Los que ya llegaron siguen ahí.',
  reiniciar_ronda: 'Borra todos los votos de la ronda actual. Solo para ensayos.',
  cerrar_sala: 'El taller termina: nadie más se inscribe ni vota, y los resultados quedan a la vista.',
  reabrir_sala: 'La sala vuelve a quedar con la ronda 2 cerrada, como antes de cerrarla.',
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

/** Acciones que borran o cierran: en rojo (contorno), aparte del paso que sigue. */
export const ES_DESTRUCTIVA: Partial<Record<Accion, true>> = { reiniciar_ronda: true, cerrar_sala: true }

/**
 * QA-A-06: cerrar la ronda con personas sin terminar pide confirmación. Devuelve null si todas terminaron.
 * `pendientes` son las personas activas que aún no completan la ronda.
 */
export function confirmacionCierreRonda(ronda: number, pendientes: number, inscritos: number): { titulo: string; texto: string; boton: string } | null {
  if (pendientes <= 0) return null
  const quien = pendientes === 1 ? '1 persona' : `${pendientes} personas`
  return {
    titulo: `¿Cerrar la ronda ${ronda} con ${quien} sin terminar?`,
    texto:
      `${quien[0].toUpperCase()}${quien.slice(1)} de ${inscritos} ${pendientes === 1 ? 'no ha' : 'no han'} terminado de votar. Si cierras ahora, ya no ` +
      `${pendientes === 1 ? 'puede' : 'pueden'} responder la ronda ${ronda}` +
      (ronda === 2 ? ' y la comparación R1 y R2 mezcla grupos de distinto tamaño.' : '.') +
      ' Si te equivocas, puedes reabrir la ronda.',
    boton: `Sí, cerrar la ronda ${ronda}`,
  }
}

/** QA-A-16: agrega el punto final sin duplicarlo («11:39 p. m.» ya termina en punto). */
export const conPunto = (t: string) => (/[.!?…]$/.test(t.trim()) ? t.trim() : `${t.trim()}.`)

/** QA-A-11 y QA-A-29: nombre de la copia de ensayo, sin «(ensayo) (ensayo)» y dentro de los 120 caracteres. */
export function nombreEnsayo(nombre: string, maximo = 120): string {
  const sufijo = ' (ensayo)'
  const base = nombre.replace(/(\s*\((ensayo|copia)\))+\s*$/i, '').trim()
  return `${base.slice(0, maximo - sufijo.length).trimEnd()}${sufijo}`
}

/** Ronda abierta según el estado (null si no hay ronda abierta). */
export const rondaAbierta = (e: EstadoSala) => (e === 'r1_abierta' ? 1 : e === 'r2_abierta' ? 2 : null)

/** Estado de una mesa en el panel en vivo, coherente con el estado de la sala (no dice "Votando" si no hay ronda abierta). */
export function estadoMesa(
  estado: EstadoSala,
  mesa: { inscritos: number; precierre?: boolean },
): { texto: string; tono?: 'exito' | 'apagado' | 'aviso' } {
  if (mesa.inscritos === 0) return { texto: 'Sin inscritos', tono: 'apagado' }
  // Paula (QA por roles): «Precierre» es jerga del equipo; la insignia dice lo que pasó.
  if (rondaAbierta(estado)) return mesa.precierre ? { texto: 'Todos votaron', tono: 'exito' } : { texto: 'Votando' }
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

/**
 * Enlace para abrir desde el panel: misma ruta en el servidor donde está abierto el panel. Las URL que manda el
 * servidor usan BASE_URL (la de los QR); si BASE_URL apunta a otro ambiente, el tablero se abriría allá y no
 * encontraría la sala.
 */
export function enEsteServidor(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url, 'http://x')
    return `${u.pathname}${u.search}${u.hash}`
  } catch {
    return null
  }
}

/** Modos de proyección del tablero de la sala, con su nombre en el panel y su tecla en el tablero. */
export type ModoTablero = 'grafica' | 'detallado'
export const MODOS_TABLERO: { modo: ModoTablero; nombre: string; tecla: string; ayuda: string }[] = [
  { modo: 'grafica', nombre: 'Gráfica', tecla: 'G', ayuda: 'solo la matriz moviéndose, a toda la pantalla' },
  { modo: 'detallado', nombre: 'Detallado', tecla: 'D', ayuda: 'la matriz con el progreso y los promedios' },
]

/**
 * Teclas del tablero para «Proyectar el tablero» (pedido de Nicolai, QA por roles del 20-oct): una lista visual en vez
 * de un párrafo. Los mismos textos de la ayuda del tablero (tecla ?), en el orden en que se usan durante el taller.
 */
export const TECLAS_TABLERO: { teclas: string[]; texto: string }[] = [
  { teclas: ['F'], texto: 'Pantalla completa (entra y sale)' },
  { teclas: ['G'], texto: 'Gráfica: solo la matriz' },
  { teclas: ['D'], texto: 'Detallado: la matriz con los promedios' },
  { teclas: ['M'], texto: 'Cambia entre Gráfica y Detallado' },
  { teclas: ['V'], texto: 'Promedios o «Cómo votó»' },
  { teclas: ['1'], texto: 'Ronda 1' },
  { teclas: ['2'], texto: 'Ronda 2' },
  { teclas: ['C'], texto: 'Comparación; otra vez, repite la animación' },
  { teclas: ['→', '←'], texto: 'Vista siguiente o anterior, también con el control de presentaciones' },
  { teclas: ['?'], texto: 'La ayuda de teclas en el tablero' },
]

/**
 * Modos de proyección del tablero (pedido de Nicolai, 20-oct; nombres del 20-oct en la tarde): `grafica`, solo la
 * matriz moviéndose a toda la pantalla, o `detallado`, la matriz con el progreso y los promedios. Se elige por evento
 * desde Ver en vivo.
 */
export function conModo(url: string | null | undefined, modo: ModoTablero): string | null {
  if (!url) return null
  const u = new URL(url, 'http://x')
  u.searchParams.set('modo', modo)
  return `${u.pathname}${u.search}${u.hash}`
}

/**
 * QA-A-04: la vista previa del celular de una mesa, en este servidor y en modo de solo lectura (`?vista=previa`): el
 * facilitador mira sin inscribirse.
 */
export function urlVistaPrevia(urlParticipante: string | null | undefined): string | null {
  const ruta = enEsteServidor(urlParticipante)
  if (!ruta) return null
  const u = new URL(ruta, 'http://x')
  u.searchParams.set('vista', 'previa')
  return `${u.pathname}${u.search}${u.hash}`
}

/**
 * Ruta interna del tablero (sin dominio) para pedir su JSON: /tablero/HZ7K2?mesa=m1&t=TOKEN → /api/tablero/{salaId}?...
 * `vista=panel` (con la sesión de admin): el panel sí recibe el resultado preliminar de la ronda 1, que el tablero
 * público y los celulares reciben oculto mientras la ronda está abierta (decisión de Paola del 20-oct).
 */
export function rutaApiTablero(salaId: string, urlTablero: string, mesaId?: string): string {
  const u = new URL(urlTablero, 'http://x')
  const q = new URLSearchParams()
  q.set('alcance', mesaId ? 'mesa' : 'sala')
  if (mesaId) q.set('mesa', mesaId)
  const t = u.searchParams.get('t')
  if (t) q.set('t', t)
  q.set('vista', 'panel')
  return `/api/tablero/${salaId}?${q.toString()}`
}

export const decimal = (n: number | null | undefined, d = 2) =>
  n === null || n === undefined ? 'Sin votos' : n.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d })

export const fechaHora = (iso: string | null, zona: ZonaHoraria = 'America/Bogota') =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: zona, dateStyle: 'medium', timeStyle: 'short' }) : 'Sin definir'

/** Fecha corta sin año para tablas densas (Respuestas): «20 de oct, 6:54 a. m.». El export trae la fecha completa. */
export const fechaCorta = (iso: string | null, zona: ZonaHoraria = 'America/Bogota') =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: zona, day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : 'Sin definir'

const TEXTO_EVENTO: Record<string, string> = {
  token_tablero_regenerado: 'Enlace del tablero cambiado: los anteriores dejaron de funcionar',
  sala_creada: 'Sala creada',
  sala_duplicada: 'Sala creada como copia para ensayo',
  sala_reiniciada: 'Sala reiniciada',
  inscripcion_abierta: 'Inscripción abierta',
  inscripcion: 'Nueva inscripción',
  ronda_abierta: 'Ronda abierta',
  ronda_cerrada: 'Ronda cerrada',
  ronda_reabierta: 'Ronda reabierta',
  reinicio: 'Votos de la ronda reiniciados',
  sala_cerrada: 'Sala cerrada',
  sala_reabierta: 'Sala reabierta',
  precierre: 'Todos votaron',
  config: 'Configuración cambiada',
  participante_editado: 'Participante editado',
  cierre_programado: 'Cierre programado aplicado',
  cierre_programado_descartado: 'Cierre programado descartado: a esa hora no aplicaba',
  apertura_programada: 'Apertura programada aplicada',
  apertura_programada_descartada: 'Apertura programada descartada: a esa hora no aplicaba',
  pregunta_guiada: 'Pregunta en pantalla',
  rubrica_editada: 'Rúbrica editada',
  mesas_agregadas: 'Mesas agregadas',
  acceso_reemitido: 'Acceso de nuevo',
  acceso_canjeado: 'Volvió a entrar con el acceso de nuevo',
  voto: 'Voto recibido',
}

/** Nombres de los campos de configuración, para decir qué cambió («Configuración: país y zona horaria»). */
const CAMPO_CONFIG: Record<string, string> = {
  alcance_resultados: 'qué resultado ven',
  vista_participante: 'qué ven tras votar',
  revelar_hojas: 'hojas de información',
  pais: 'país',
  zona_horaria: 'zona horaria',
  modo_preguntas: 'preguntas en el celular',
  apertura_programada_sala_at: 'apertura programada de la inscripción',
  cierre_programado_sala_at: 'cierre programado de la sala',
  apertura_programada_r1_at: 'apertura programada de la ronda 1',
  cierre_programado_r1_at: 'cierre programado de la ronda 1',
  apertura_programada_r2_at: 'apertura programada de la ronda 2',
  cierre_programado_r2_at: 'cierre programado de la ronda 2',
  cierre_programado_ronda_at: 'cierre programado de la ronda',
  tipo: 'tipo de sala',
  empresa: 'empresa cliente',
  sector: 'sector',
}

/** «a, b y c». */
export const enumerar = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`)

/** Lo que la bitácora necesita de la sala para decir nombres en vez de identificadores. */
export interface ContextoEvento {
  mesas?: { id: string; nombre: string }[]
  participantes?: { id: string; nombre: string }[]
  /** Criterios, proyectos vivos y perfiles de la sala (contenido.ts). */
  contenido?: ContenidoSala
}

/**
 * QA-A-15: texto legible de un evento de la bitácora: qué cambió, quién y dónde. Los textos del servidor en imperativo
 * («Puedes cerrar la ronda») se reescriben como hechos, con el número de ronda.
 */
export function textoEvento(ev: { tipo: string; detalle?: Record<string, unknown> | null; por: string }, ctx: ContextoEvento = {}): string {
  const d = ev.detalle ?? {}
  const mesa = (id: unknown) => ctx.mesas?.find((m) => m.id === id)?.nombre
  const persona = (id: unknown) => ctx.participantes?.find((p) => p.id === id)?.nombre
  const ronda = typeof d.ronda === 'number' ? d.ronda : null
  const c = ctx.contenido ?? CONTENIDO_VACIO
  const por = ev.por === 'sistema' || ev.por === 'participante' ? '' : ev.por === 'programado' ? ' · a la hora programada' : ` · ${ev.por.replace(/^admin:/, '')}`
  let t = TEXTO_EVENTO[ev.tipo] ?? `${ev.tipo.charAt(0).toUpperCase()}${ev.tipo.slice(1).replace(/_/g, ' ')}`

  switch (ev.tipo) {
    case 'ronda_abierta':
    case 'ronda_cerrada':
    case 'ronda_reabierta':
      if (ronda) t = t.replace('Ronda', `Ronda ${ronda}`)
      break
    case 'reinicio':
      if (ronda) t = `Votos de la ronda ${ronda} reiniciados`
      if (typeof d.votos_borrados === 'number') t += ` (${d.votos_borrados} ${d.votos_borrados === 1 ? 'borrado' : 'borrados'})`
      break
    case 'precierre': {
      const delMensaje = typeof d.mensaje === 'string' ? /en (.+?)\./.exec(d.mensaje)?.[1] : undefined
      const donde = d.alcance === 'sala' ? 'la sala' : (mesa(d.mesa_id) ?? delMensaje ?? 'una mesa')
      t = `Todos votaron en ${donde}${ronda ? ` (ronda ${ronda})` : ''}`
      break
    }
    case 'inscripcion': {
      const quien = persona(d.participante_id)
      const donde = mesa(d.mesa_id)
      t = quien ? `${quien} se inscribió${donde ? ` en ${donde}` : ''}` : `Nueva inscripción${donde ? ` en ${donde}` : ''}`
      break
    }
    case 'config': {
      const campos = Object.keys(d).map((k) => CAMPO_CONFIG[k]).filter(Boolean)
      if (campos.length) t = `Configuración: ${enumerar([...new Set(campos)])}`
      break
    }
    case 'participante_editado': {
      const quien = persona(d.participante_id ?? d.id) ?? 'Un participante'
      const cambios: string[] = []
      if (d.mesa_id !== undefined) cambios.push(`pasó a ${mesa(d.mesa_id) ?? 'otra mesa'}`)
      if (typeof d.perfil_id === 'string') cambios.push(`ahora tiene el perfil ${nombrePerfil(c, d.perfil_id)}`)
      if (d.activo === false) cambios.push('quedó inactivo')
      if (d.activo === true) cambios.push('volvió a estar activo')
      t = cambios.length ? `${quien} ${enumerar(cambios)}` : `${quien}: datos editados`
      break
    }
    case 'pregunta_guiada':
      t =
        typeof d.proyecto_id === 'string' && typeof d.criterio_id === 'string'
          ? `Pregunta en pantalla: ${nombreProyecto(c, d.proyecto_id)} · ${numeroPregunta({ criterio_id: d.criterio_id as CriterioId }, c.criterios).texto}`
          : 'Pregunta quitada: vuelve la matriz'
      break
    case 'mesas_agregadas':
      if (typeof d.cantidad === 'number') t = d.cantidad === 1 ? 'Se agregó 1 mesa' : `Se agregaron ${d.cantidad} mesas`
      break
    case 'rubrica_editada':
      if (typeof d.criterio_id === 'string') t = `Rúbrica editada: ${nombreCriterio(c, d.criterio_id)}`
      break
    case 'acceso_reemitido': {
      const quien = persona(d.participante_id)
      t = quien ? `Acceso de nuevo para ${quien}` : 'Acceso de nuevo para un participante'
      break
    }
    case 'acceso_canjeado': {
      const quien = persona(d.participante_id)
      t = `${quien ?? 'Un participante'} volvió a entrar con el acceso de nuevo`
      break
    }
  }
  return t + por
}

export interface LineaBitacora {
  at: string
  texto: string
  /** Cuántos eventos seguidos iguales resume esta línea. */
  veces: number
}

/** Transiciones que puede aplicar la programación; su evento «… programada aplicada» las repite. */
const TRANSICIONES = new Set(['inscripcion_abierta', 'ronda_abierta', 'ronda_cerrada', 'sala_cerrada'])

/**
 * QA-A-15: la bitácora en orden, lo más reciente primero, sin ruido: los eventos seguidos con el mismo texto van en una
 * sola línea («12 veces») y «Apertura programada aplicada» no repite la transición que ya dice «a la hora programada».
 */
export function bitacora(eventos: { at: string; tipo: string; detalle?: Record<string, unknown> | null; por: string }[], ctx: ContextoEvento = {}): LineaBitacora[] {
  const cerca = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) <= 5000
  const utiles = eventos.filter(
    (ev, i) =>
      !(
        (ev.tipo === 'apertura_programada' || ev.tipo === 'cierre_programado') &&
        [eventos[i - 1], eventos[i + 1]].some((o) => o && o.por === 'programado' && TRANSICIONES.has(o.tipo) && cerca(o.at, ev.at))
      ),
  )
  const lineas: LineaBitacora[] = []
  for (const ev of utiles) {
    const texto = textoEvento(ev, ctx)
    const ultima = lineas[lineas.length - 1]
    if (ultima && ultima.texto === texto) ultima.veces += 1
    else lineas.push({ at: ev.at, texto, veces: 1 })
  }
  return lineas
}

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
