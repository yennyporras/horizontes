import { useCallback, useEffect, useRef, useState } from 'react'
import { consultar } from './api'
import type { SalaDetalle } from './tipos'

export const INTERVALO_POLLING_MS = 2500

/** Detalle de la sala con polling cada 2,5 s y If-None-Match (304 = sin cambios). */
export function useSala(salaId: string | undefined) {
  const [datos, setDatos] = useState<SalaDetalle | null>(null)
  const [error, setError] = useState<string | null>(null)
  const etag = useRef<string | undefined>(undefined)

  const recargar = useCallback(async () => {
    if (!salaId) return
    try {
      const r = await consultar<SalaDetalle>(`/api/admin/salas/${salaId}`, etag.current)
      setError(null)
      if (r) {
        etag.current = r.etag
        setDatos(r.datos)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la sala.')
    }
  }, [salaId])

  useEffect(() => {
    etag.current = undefined
    setDatos(null)
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
