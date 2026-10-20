import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vista } from './tipos'

/** true si la tecla viene de un campo editable (no se interceptan atajos ahí). */
function enCampo(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)
}

/** Atajo de teclado del tablero → acción. Puro para poder probarlo. */
export type AccionTecla =
  | { tipo: 'pantalla' }
  | { tipo: 'detalle' }
  | { tipo: 'vista'; vista: Vista }
  | { tipo: 'matriz'; sola: boolean | null }

export function accionDeTecla(tecla: string): AccionTecla | null {
  switch (tecla.toLowerCase()) {
    case 'f':
      return { tipo: 'pantalla' }
    case 'v':
      return { tipo: 'detalle' }
    case 'm':
      return { tipo: 'matriz', sola: null }
    case 'g':
      return { tipo: 'matriz', sola: true }
    case 'd':
    case 'escape':
      return { tipo: 'matriz', sola: false }
    case '1':
      return { tipo: 'vista', vista: 1 }
    case '2':
      return { tipo: 'vista', vista: 2 }
    case 'c':
      return { tipo: 'vista', vista: 'comparacion' }
    default:
      return null
  }
}

export interface AtajosTablero {
  /** Lo que se pone en pantalla completa: la página del tablero en el modo elegido (null mientras carga). */
  elemento: HTMLElement | null
  onVista: (v: Vista) => void
  onDetalle: () => void
  /** M alterna los modos «Gráfica» (true) y «Detallado» (false); G y D eligen uno; Esc pasa a Detallado. */
  onMatriz: (sola: boolean | null) => void
}

/**
 * Modo proyector: F o el botón «Pantalla completa» ponen el tablero, en el modo elegido («Gráfica»: solo la
 * matriz; «Detallado»: matriz, progreso y promedios), en la pantalla completa del navegador sin los controles
 * del encabezado; F, Esc o el mismo botón salen. 1, 2 y C cambian de vista; G, D y M de modo; V alterna
 * promedios y «Cómo votó» (votos). Si el navegador no deja usar la API, igual se ocultan los controles
 * (`activa` sigue siendo true) y Esc lo cierra.
 */
export function usePantallaCompleta({ elemento, onVista, onDetalle, onMatriz }: AtajosTablero) {
  const [real, setReal] = useState(false)
  const [respaldo, setRespaldo] = useState(false)
  const activa = real || respaldo
  const activaRef = useRef(activa)
  activaRef.current = activa
  const elementoRef = useRef(elemento)
  elementoRef.current = elemento

  const salir = useCallback(() => {
    setRespaldo(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => setReal(false))
  }, [])

  const alternar = useCallback(() => {
    if (activaRef.current) return salir()
    const el = elementoRef.current ?? document.documentElement
    if (typeof el.requestFullscreen === 'function') el.requestFullscreen().catch(() => setRespaldo(true))
    else setRespaldo(true)
  }, [salir])

  useEffect(() => {
    const cambio = () => setReal(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      // Una tecla sostenida no repite la acción (F entraba y salía de la pantalla completa sin parar).
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || enCampo(e)) return
      const a = accionDeTecla(e.key)
      if (!a) return
      e.preventDefault()
      // En pantalla completa, Esc solo sale de ella (no cambia de modo).
      if (e.key === 'Escape' && activaRef.current) return salir()
      if (a.tipo === 'pantalla') alternar()
      else if (a.tipo === 'vista') onVista(a.vista)
      else if (a.tipo === 'detalle') onDetalle()
      else onMatriz(a.sola)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [alternar, salir, onVista, onDetalle, onMatriz])

  return { activa, alternar, salir }
}
