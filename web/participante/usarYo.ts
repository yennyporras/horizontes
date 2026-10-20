import { useCallback, useEffect, useRef, useState } from 'react'
import { ErrorApi, obtenerYo, type Yo } from './api'

export const INTERVALO_MS = 2500
const ESPERA_MAX_MS = 10000

export interface EstadoYo {
  yo: Yo | null
  /** Error que impide seguir (401, 403, 404 del participante). El polling se detiene. */
  fatal: ErrorApi | null
  /** Error de la primera carga (sin datos aún): 5xx o red. */
  errorCarga: ErrorApi | null
  /** El polling falló 2 veces seguidas. */
  sinConexion: boolean
  /** Se recuperó la conexión hace menos de 3 s. */
  recuperada: boolean
}

const esFatal = (e: ErrorApi) => e.status === 401 || e.status === 403 || e.status === 404

/**
 * Polling de GET /api/yo cada 2,5 s con If-None-Match (304 = sin cambios).
 * Con fallos de red o del servidor espera más (hasta 10 s) y avisa "Sin conexión" al segundo fallo seguido.
 */
export function usarYo(token: string | null) {
  const [estado, setEstado] = useState<EstadoYo>({ yo: null, fatal: null, errorCarga: null, sinConexion: false, recuperada: false })
  const etag = useRef<string | null>(null)
  const fallos = useRef(0)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const recuperacion = useRef<ReturnType<typeof setTimeout> | null>(null)
  const vivo = useRef(true)
  const ciclo = useRef<() => void>(() => {})
  // Consultas numeradas: el polling, «refrescar» tras guardar y el regreso a la pestaña pueden cruzarse, y una
  // respuesta vieja que llega tarde no debe pisar a una más nueva.
  const pedidas = useRef(0)
  const atendida = useRef(0)

  const programar = useCallback((ms: number) => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => ciclo.current(), ms)
  }, [])

  const consultar = useCallback(
    async (forzar = false) => {
      if (!token) return
      const n = ++pedidas.current
      try {
        const r = await obtenerYo(token, forzar ? null : etag.current)
        if (!vivo.current || n < atendida.current) return
        atendida.current = n
        const veniaSinConexion = fallos.current >= 2
        fallos.current = 0
        if (veniaSinConexion) {
          if (recuperacion.current) clearTimeout(recuperacion.current)
          recuperacion.current = setTimeout(() => vivo.current && setEstado((s) => ({ ...s, recuperada: false })), 3000)
        }
        // Misma versión que la que ya teníamos: se conserva lo aplicado en local (voto recién guardado).
        const igual = Boolean(r && r.etag && r.etag === etag.current)
        setEstado((s) => ({
          yo: r && !(igual && s.yo) ? r.yo : s.yo,
          fatal: null,
          errorCarga: null,
          sinConexion: false,
          recuperada: veniaSinConexion || s.recuperada,
        }))
        if (r) etag.current = r.etag
        programar(INTERVALO_MS)
      } catch (err) {
        if (!vivo.current || n < atendida.current) return
        atendida.current = n
        const e = err instanceof ErrorApi ? err : new ErrorApi(0, 'SIN_RED', 'Sin conexión')
        if (esFatal(e)) {
          setEstado((s) => ({ ...s, fatal: e }))
          return
        }
        fallos.current += 1
        setEstado((s) => ({ ...s, errorCarga: s.yo ? null : e, sinConexion: fallos.current >= 2, recuperada: false }))
        programar(Math.min(INTERVALO_MS * 2 ** (fallos.current - 1), ESPERA_MAX_MS))
      }
    },
    [token, programar],
  )

  useEffect(() => {
    ciclo.current = () => {
      // Pestaña oculta: no gasta datos ni batería; revisa de nuevo en el siguiente intervalo.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return programar(INTERVALO_MS)
      void consultar()
    }
  }, [consultar, programar])

  useEffect(() => {
    vivo.current = true
    etag.current = null
    fallos.current = 0
    atendida.current = pedidas.current
    setEstado({ yo: null, fatal: null, errorCarga: null, sinConexion: false, recuperada: false })
    if (token) void consultar(true)
    const alVolver = () => document.visibilityState === 'visible' && void consultar()
    // Volvió la señal: no espera el resto del backoff.
    const alConectar = () => void consultar()
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('online', alConectar)
    return () => {
      vivo.current = false
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('online', alConectar)
      if (temporizador.current) clearTimeout(temporizador.current)
      if (recuperacion.current) clearTimeout(recuperacion.current)
    }
  }, [token, consultar])

  /** Consulta ya, sin esperar el intervalo (tras guardar un voto o al reintentar). */
  const refrescar = useCallback(() => consultar(true), [consultar])

  /** Aplica en local la respuesta de una escritura (voto guardado) hasta que llegue la siguiente versión. */
  const aplicar = useCallback((cambio: (yo: Yo) => Yo) => setEstado((s) => (s.yo ? { ...s, yo: cambio(s.yo) } : s)), [])

  return { ...estado, refrescar, aplicar }
}
