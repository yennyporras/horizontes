import { useCallback, useEffect, useState } from 'react'
import type { Vista } from './tipos'

/** true si la tecla viene de un campo editable (no se interceptan atajos ahí). */
function enCampo(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t) return false
  return t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)
}

/** Atajo de teclado del tablero → acción. Puro para poder probarlo. */
export function accionDeTecla(tecla: string): { tipo: 'pantalla' } | { tipo: 'vista'; vista: Vista } | null {
  switch (tecla.toLowerCase()) {
    case 'f':
      return { tipo: 'pantalla' }
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

/**
 * Modo proyector: F alterna pantalla completa; 1, 2 y C cambian de vista.
 * Si el navegador no permite la API de pantalla completa, F igual oculta los controles.
 */
export function usePantallaCompleta(onVista: (v: Vista) => void) {
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
      e.preventDefault()
      if (a.tipo === 'pantalla') alternar()
      else onVista(a.vista)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [alternar, onVista])

  return { activa, alternar }
}
