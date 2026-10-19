import { useEffect, useRef, useState } from 'react'
import type { DatosTablero } from './tipos'
import { INTERVALO_POLLING_MS, esSinPermiso, pedirTablero } from './logica'

export interface EstadoPolling {
  datos: DatosTablero | null
  error: { status: number; codigo: string; mensaje: string } | null
  cargando: boolean
}

/**
 * Pide la URL cada 2,5 s con If-None-Match. Con 304 no toca el estado (sin parpadeo).
 * Ante un error conserva los últimos datos y muestra el aviso; reintenta solo, salvo ante 401 o 403
 * (enlace sin permiso: reintentar no lo arregla).
 */
export function usePollingTablero(url: string | null, intervalo = INTERVALO_POLLING_MS): EstadoPolling {
  const [estado, setEstado] = useState<EstadoPolling>({ datos: null, error: null, cargando: !!url })
  const etag = useRef<string | null>(null)

  useEffect(() => {
    if (!url) return
    etag.current = null
    // Conserva los datos anteriores mientras llega el nuevo alcance: la página no se desmonta
    // (el selector de alcance mantiene el foco y la vista elegida no se pierde).
    setEstado((e) => ({ ...e, error: null, cargando: true }))
    const ctrl = new AbortController()
    let temporizador: ReturnType<typeof setTimeout> | undefined
    let vivo = true

    const ciclo = async () => {
      try {
        const r = await pedirTablero(url, etag.current, fetch, ctrl.signal)
        if (!vivo) return
        if (r.tipo === 'nuevo') {
          etag.current = r.etag
          setEstado({ datos: r.datos, error: null, cargando: false })
        } else if (r.tipo === 'igual') {
          setEstado((e) => (e.error || e.cargando ? { ...e, error: null, cargando: false } : e))
        } else {
          setEstado((e) => ({ ...e, error: { status: r.status, codigo: r.codigo, mensaje: r.mensaje }, cargando: false }))
          if (esSinPermiso(r.status)) return
        }
      } catch {
        if (!vivo) return
      }
      temporizador = setTimeout(ciclo, intervalo)
    }
    ciclo()
    return () => {
      vivo = false
      ctrl.abort()
      clearTimeout(temporizador)
    }
  }, [url, intervalo])

  return estado
}
