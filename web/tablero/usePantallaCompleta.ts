import { useCallback, useEffect, useRef, useState } from 'react'
import type { Vista } from './tipos'

/**
 * true si la tecla viene de un campo editable (ahí no se interceptan atajos). El selector de alcance del tablero lleva
 * `data-atajos`: es un control de la proyección, no un campo, y no se come los atajos (Nicolai: con el selector
 * enfocado, M elegía «Mesa 1»).
 */
function enCampo(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null
  if (!t || t.dataset?.atajos !== undefined) return false
  return t.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(t.tagName)
}

/** Atajo de teclado del tablero → acción. Puro para poder probarlo. */
export type AccionTecla =
  | { tipo: 'pantalla' }
  | { tipo: 'detalle' }
  | { tipo: 'vista'; vista: Vista }
  | { tipo: 'matriz'; sola: boolean | null }
  | { tipo: 'avanzar'; paso: 1 | -1 }
  | { tipo: 'ayuda' }
  | { tipo: 'entera' }
  | { tipo: 'escape' }

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
      return { tipo: 'matriz', sola: false }
    case '1':
      return { tipo: 'vista', vista: 1 }
    case '2':
      return { tipo: 'vista', vista: 2 }
    case 'c':
      return { tipo: 'vista', vista: 'comparacion' }
    // Control de presentaciones (Nicolai): → y Página siguiente avanzan; ← y Página anterior retroceden.
    case 'arrowright':
    case 'pagedown':
      return { tipo: 'avanzar', paso: 1 }
    case 'arrowleft':
    case 'pageup':
      return { tipo: 'avanzar', paso: -1 }
    // Zoom de la matriz: 0 la vuelve a mostrar entera.
    case '0':
      return { tipo: 'entera' }
    case '?':
      return { tipo: 'ayuda' }
    case 'escape':
      return { tipo: 'escape' }
    default:
      return null
  }
}

export interface AtajosTablero {
  /** Lo que va a la pantalla completa: el lienzo de la matriz (o la cuadrícula de mesas); null si no hay matriz. */
  elemento: HTMLElement | null
  onVista: (v: Vista) => void
  onDetalle: () => void
  /** M alterna los modos «Gráfica» (true) y «Detallado» (false); G y D eligen uno. */
  onMatriz: (sola: boolean | null) => void
  /** → / Página siguiente (1) y ← / Página anterior (−1). */
  onAvanzar: (paso: 1 | -1) => void
  /** 0: la matriz vuelve a verse entera (sin zoom). */
  onVerEntera?: () => void
}

/**
 * Pantalla completa de la matriz (pedido de Paola, 21-oct): F o el botón «Pantalla completa» ponen SOLO el lienzo de
 * la matriz en la pantalla completa del navegador (Fullscreen API sobre ese elemento), en Gráfica y en Detallado; F,
 * Esc o el botón «Salir» salen. Las teclas siguen dentro: 1, 2 y C cambian de vista (C en Comparación repite la
 * animación); → y ← avanzan y retroceden; G, D y M cambian de modo; V alterna promedios y «Cómo votó»; 0 quita el zoom;
 * ? abre la ayuda de teclas y Esc la cierra. Esc fuera de la pantalla completa no hace nada (Nicolai: abría Detallado).
 * Si el navegador no deja usar la API, el lienzo se superpone a toda la ventana (`respaldo`) y Esc lo cierra.
 */
export function usePantallaCompleta({ elemento, onVista, onDetalle, onMatriz, onAvanzar, onVerEntera }: AtajosTablero) {
  const [real, setReal] = useState(false)
  const [respaldo, setRespaldo] = useState(false)
  const [ayuda, setAyuda] = useState(false)
  const activa = !!elemento && (real || respaldo)
  const activaRef = useRef(activa)
  activaRef.current = activa
  const ayudaRef = useRef(ayuda)
  ayudaRef.current = ayuda
  const elementoRef = useRef(elemento)
  elementoRef.current = elemento
  const enteraRef = useRef(onVerEntera)
  enteraRef.current = onVerEntera

  const salir = useCallback(() => {
    setRespaldo(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => setReal(false))
  }, [])

  const alternar = useCallback(() => {
    if (activaRef.current) return salir()
    const el = elementoRef.current
    if (!el) return
    if (typeof el.requestFullscreen === 'function') el.requestFullscreen().catch(() => setRespaldo(true))
    else setRespaldo(true)
  }, [salir])

  // Sin matriz (pregunta guiada, cambio de alcance), el respaldo se cierra solo; el navegador sale solo de la suya.
  useEffect(() => {
    if (!elemento) setRespaldo(false)
  }, [elemento])

  useEffect(() => {
    const cambio = () => setReal(!!document.fullscreenElement && document.fullscreenElement === elementoRef.current)
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
      if (a.tipo === 'escape') {
        // Esc cierra la ayuda; si no está abierta, sale de la pantalla completa; fuera de ella no hace nada.
        if (ayudaRef.current) setAyuda(false)
        else if (activaRef.current) salir()
        return
      }
      if (a.tipo === 'ayuda') return setAyuda((x) => !x)
      if (a.tipo === 'pantalla') alternar()
      else if (a.tipo === 'entera') enteraRef.current?.()
      else if (a.tipo === 'vista') onVista(a.vista)
      else if (a.tipo === 'avanzar') onAvanzar(a.paso)
      else if (a.tipo === 'detalle') onDetalle()
      else onMatriz(a.sola)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [alternar, salir, onVista, onDetalle, onMatriz, onAvanzar])

  return { activa, respaldo: activa && !real, alternar, salir, ayuda, setAyuda }
}
