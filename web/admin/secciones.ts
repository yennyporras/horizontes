/**
 * Secciones del panel en el orden en que se usa el taller (pedido de Paola, 20-oct): preparar (Salas, Configuración,
 * Hojas, Mesas y QR), conducir (Sala en vivo, Participantes), después (Respuestas, Exportar) y el sistema (Salud y
 * Administradores). El menú, la guía de uso y «Elige una sala» leen esta lista: no hay otro orden en el panel.
 */
export type Grupo = 'preparar' | 'conducir' | 'despues' | 'sistema'

export interface Seccion {
  /** Texto del menú. */
  texto: string
  /** Tramo de la ruta: /admin/salas/{sala}/{ruta} si es de sala, /admin/{ruta} si no. */
  ruta: string
  deSala: boolean
  grupo: Grupo
  soloSuperadmin?: boolean
}

export const SECCIONES: Seccion[] = [
  { texto: 'Salas', ruta: 'salas', deSala: false, grupo: 'preparar' },
  { texto: 'Configuración', ruta: 'configuracion', deSala: true, grupo: 'preparar' },
  { texto: 'Hojas', ruta: 'hojas', deSala: true, grupo: 'preparar' },
  { texto: 'Mesas y QR', ruta: 'mesas', deSala: true, grupo: 'preparar' },
  { texto: 'Sala en vivo', ruta: 'vivo', deSala: true, grupo: 'conducir' },
  { texto: 'Participantes', ruta: 'participantes', deSala: true, grupo: 'conducir' },
  { texto: 'Respuestas', ruta: 'respuestas', deSala: true, grupo: 'despues' },
  { texto: 'Exportar', ruta: 'export', deSala: true, grupo: 'despues' },
  { texto: 'Salud', ruta: 'salud', deSala: false, grupo: 'sistema' },
  { texto: 'Administradores', ruta: 'administradores', deSala: false, grupo: 'sistema', soloSuperadmin: true },
]

/** Nombre de cada grupo para los lectores de pantalla (en pantalla los separa una línea, sin rótulo). */
export const GRUPOS: Record<Grupo, string> = {
  preparar: 'Preparar el taller',
  conducir: 'Conducir el taller',
  despues: 'Después del taller',
  sistema: 'Sistema',
}

/** Las secciones que ve cada rol, en el orden del menú. */
export const seccionesDe = (esSuperadmin: boolean) => SECCIONES.filter((s) => esSuperadmin || !s.soloSuperadmin)

/** Nombre de una sección de sala por su tramo de ruta («respuestas» → «Respuestas»). */
export const nombreSeccionSala = (ruta: string) => SECCIONES.find((s) => s.deSala && s.ruta === ruta)?.texto ?? null
