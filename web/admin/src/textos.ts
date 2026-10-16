import seed from '../../../data/seed_foodsume.json'
import type { Accion, EstadoSala } from './tipos'

export const PERFILES: { id: string; nombre: string }[] = seed.perfiles

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

/** Acciones que la máquina de estados (SPEC §3) permite desde cada estado. El servidor es quien valida. */
export const ACCIONES_POR_ESTADO: Record<EstadoSala, Accion[]> = {
  preparada: ['abrir_inscripcion', 'cerrar_sala'],
  inscripcion: ['abrir_ronda_1', 'cerrar_sala'],
  r1_abierta: ['cerrar_ronda_1', 'reiniciar_ronda', 'cerrar_sala'],
  r1_cerrada: ['abrir_ronda_2', 'reabrir_ronda', 'cerrar_sala'],
  r2_abierta: ['cerrar_ronda_2', 'reiniciar_ronda', 'cerrar_sala'],
  r2_cerrada: ['reabrir_ronda', 'cerrar_sala'],
  cerrada: ['reabrir_sala'],
}

export const fechaHora = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }) : 'Sin definir'
