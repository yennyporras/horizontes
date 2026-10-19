import { useCallback, useEffect, useState } from 'react'
import type { Vista } from './tipos'
import type { AccionZoom } from './zoom'

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
  | { tipo: 'zoom'; zoom: AccionZoom }
  | { tipo: 'matriz'; sola: boolean | null }

const TECLAS_ZOOM: Record<string, AccionZoom> = {
  '+': 'acercar',
  '=': 'acercar',
  '-': 'alejar',
  '0': 'ver_todo',
  arrowleft: 'izquierda',
  arrowright: 'derecha',
  arrowup: 'arriba',
  arrowdown: 'abajo',
}

export function accionDeTecla(tecla: string): AccionTecla | null {
  const zoom = TECLAS_ZOOM[tecla.toLowerCase()]
  if (zoom) return { tipo: 'zoom', zoom }
  switch (tecla.toLowerCase()) {
    case 'f':
      return { tipo: 'pantalla' }
    case 'd':
      return { tipo: 'detalle' }
    case 'm':
      return { tipo: 'matriz', sola: null }
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
  onVista: (v: Vista) => void
  onDetalle: () => void
  /** Devuelve false si no cambió nada: así una flecha sin zoom sigue desplazando la página. */
  onZoom: (a: AccionZoom) => boolean
  /** M alterna la matriz sola y la vista con datos (null); Esc vuelve a los datos (false). */
  onMatriz: (sola: boolean | null) => void
}

/**
 * Modo proyector: F alterna pantalla completa; 1, 2 y C cambian de vista; D alterna promedios y «Cómo votó»;
 * M muestra la matriz sola o con datos y Esc vuelve a los datos; +, − y 0 acercan, alejan y vuelven a
 * ver toda la matriz, y las flechas la mueven con zoom.
 * Si el navegador no permite la API de pantalla completa, F igual oculta los controles.
 */
export function usePantallaCompleta({ onVista, onDetalle, onZoom, onMatriz }: AtajosTablero) {
  const [activa, setActiva] = useState(false)

  const alternar = useCallback(() => {
    const doc = document as Document & { fullscreenElement?: Element | null }
    if (doc.fullscreenElement) {
      doc.exitFullscreen?.().catch(() => setActiva(false))
      return
    }
    const el = document.documentElement
    if (typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => setActiva((a) => !a))
    } else {
      setActiva((a) => !a)
    }
  }, [])

  useEffect(() => {
    const cambio = () => setActiva(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', cambio)
    return () => document.removeEventListener('fullscreenchange', cambio)
  }, [])

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || enCampo(e)) return
      const a = accionDeTecla(e.key)
      if (!a) return
      if (a.tipo === 'zoom') {
        if (onZoom(a.zoom)) e.preventDefault()
        return
      }
      e.preventDefault()
      if (a.tipo === 'pantalla') alternar()
      else if (a.tipo === 'detalle') onDetalle()
      else if (a.tipo === 'matriz') onMatriz(a.sola)
      else onVista(a.vista)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [alternar, onVista, onDetalle, onZoom, onMatriz])

  return { activa, alternar }
}
