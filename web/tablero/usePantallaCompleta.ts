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
    case '?':
      return { tipo: 'ayuda' }
    case 'escape':
      return { tipo: 'escape' }
    default:
      return null
  }
}

export interface AtajosTablero {
  /** Lo que se pone en pantalla completa: la página del tablero en el modo elegido (null mientras carga). */
  elemento: HTMLElement | null
  onVista: (v: Vista) => void
  onDetalle: () => void
  /** M alterna los modos «Gráfica» (true) y «Detallado» (false); G y D eligen uno. */
  onMatriz: (sola: boolean | null) => void
  /** → / Página siguiente (1) y ← / Página anterior (−1). */
  onAvanzar: (paso: 1 | -1) => void
}

/**
 * Pantalla completa del navegador con F11: el navegador lo dice con `display-mode: fullscreen`; si no, la ventana tapa
 * también la barra de tareas (su alto pasa del alto disponible de la pantalla). Un navegador sin ventana (pruebas) no
 * cuenta: su pantalla mide lo mismo que la ventana y no tiene barra de tareas.
 */
function pantallaF11(): boolean {
  if (typeof window === 'undefined' || document.fullscreenElement) return false
  if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true
  const s = window.screen
  if (!s?.height || !s?.width || !s.availHeight || s.availHeight >= s.height) return false
  return window.innerHeight >= s.height - 1 && window.innerWidth >= s.width - 1
}

/**
 * Modo proyector: F o el botón «Pantalla completa» ponen el tablero, en el modo elegido («Gráfica»: solo la
 * matriz; «Detallado»: matriz, progreso y promedios), en la pantalla completa del navegador sin los controles
 * del encabezado; F, Esc o el mismo botón salen. Con F11 (pantalla completa del navegador) los controles también se
 * ocultan. 1, 2 y C cambian de vista; → y ← (o Página siguiente y anterior) avanzan y retroceden; G, D y M cambian de
 * modo; V alterna promedios y «Cómo votó»; ? abre la ayuda de teclas y Esc la cierra. Esc fuera de la pantalla
 * completa no hace nada (Nicolai: abría Detallado). Si el navegador no deja usar la API, igual se ocultan los
 * controles (`activa` sigue siendo true) y Esc lo cierra.
 */
export function usePantallaCompleta({ elemento, onVista, onDetalle, onMatriz, onAvanzar }: AtajosTablero) {
  const [real, setReal] = useState(false)
  const [respaldo, setRespaldo] = useState(false)
  const [f11, setF11] = useState(pantallaF11)
  const [ayuda, setAyuda] = useState(false)
  const propia = real || respaldo
  const activa = propia || f11
  const propiaRef = useRef(propia)
  propiaRef.current = propia
  const ayudaRef = useRef(ayuda)
  ayudaRef.current = ayuda
  const elementoRef = useRef(elemento)
  elementoRef.current = elemento

  const salir = useCallback(() => {
    setRespaldo(false)
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => setReal(false))
  }, [])

  const alternar = useCallback(() => {
    if (propiaRef.current) return salir()
    const el = elementoRef.current ?? document.documentElement
    if (typeof el.requestFullscreen === 'function') el.requestFullscreen().catch(() => setRespaldo(true))
    else setRespaldo(true)
  }, [salir])

  useEffect(() => {
    const cambio = () => setReal(!!document.fullscreenElement)
    const tamano = () => setF11(!document.fullscreenElement && pantallaF11())
    document.addEventListener('fullscreenchange', cambio)
    window.addEventListener('resize', tamano)
    return () => {
      document.removeEventListener('fullscreenchange', cambio)
      window.removeEventListener('resize', tamano)
    }
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
        else if (propiaRef.current) salir()
        return
      }
      if (a.tipo === 'ayuda') return setAyuda((x) => !x)
      if (a.tipo === 'pantalla') alternar()
      else if (a.tipo === 'vista') onVista(a.vista)
      else if (a.tipo === 'avanzar') onAvanzar(a.paso)
      else if (a.tipo === 'detalle') onDetalle()
      else onMatriz(a.sola)
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [alternar, salir, onVista, onDetalle, onMatriz, onAvanzar])

  return { activa, f11: f11 && !propia, alternar, salir, ayuda, setAyuda }
}
