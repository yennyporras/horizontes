import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, consultar } from './api'
import { olvidarSala } from './memoria'
import type { SalaDetalle } from './tipos'

export const INTERVALO_POLLING_MS = 2500

/**
 * Error al leer la sala. `conexion`: sin red o el servidor falló (5xx); el panel sigue reintentando y conserva lo último
 * que leyó. Si no, el servidor respondió que no (404, 403…) y el texto es el suyo.
 */
export interface ErrorSala {
  texto: string
  conexion: boolean
}

/** Detalle de la sala con polling cada 2,5 s y If-None-Match (304 = sin cambios). */
export function useSala(salaId: string | undefined) {
  const [datos, setDatos] = useState<SalaDetalle | null>(null)
  const [error, setError] = useState<ErrorSala | null>(null)
  const etag = useRef<string | undefined>(undefined)
  // F-10: una respuesta de la sala anterior (lenta o en vuelo al cambiar de sala) no pisa a la sala actual.
  const vigente = useRef(salaId)
  vigente.current = salaId

  const recargar = useCallback(async () => {
    if (!salaId) return
    try {
      const r = await consultar<SalaDetalle>(`/api/admin/salas/${salaId}`, etag.current)
      if (vigente.current !== salaId) return
      setError(null)
      if (r && r.datos?.sala?.id === salaId) {
        etag.current = r.etag
        setDatos(r.datos)
      }
    } catch (e) {
      if (vigente.current !== salaId) return
      if (e instanceof ApiError && e.status === 404) olvidarSala(salaId)
      const conexion = !(e instanceof ApiError) || e.status === 0 || e.status >= 500 || e.status === 429
      setError({ texto: e instanceof Error ? e.message : 'No se pudo cargar la sala.', conexion })
    }
  }, [salaId])

  useEffect(() => {
    etag.current = undefined
    setDatos(null)
    setError(null)
    recargar()
    const id = setInterval(recargar, INTERVALO_POLLING_MS)
    return () => clearInterval(id)
  }, [recargar])

  /** Fuerza una lectura completa (tras una acción propia). */
  const refrescar = useCallback(async () => {
    etag.current = undefined
    await recargar()
  }, [recargar])

  return { datos, error, refrescar }
}
