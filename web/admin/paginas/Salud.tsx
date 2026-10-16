import { useCallback, useEffect, useState } from 'react'
import { consultar, salud, usaMocks, type Medicion } from '../api'
import { fechaHora } from '../textos'

const p95 = (xs: number[]) => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.min(o.length - 1, Math.ceil(o.length * 0.95) - 1)]
}

/** Monitor de salud: estado del servidor, versión desplegada, latencia del panel y último error. */
export function Salud() {
  const [estado, setEstado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mediciones, setMediciones] = useState<Medicion[]>([])

  const revisar = useCallback(async () => {
    try {
      const r = await consultar<Record<string, unknown>>('/api/health')
      setEstado(r?.datos ?? null)
      setError(null)
    } catch (e) {
      setEstado(null)
      setError(e instanceof Error ? e.message : 'El servidor no respondió.')
    }
    setMediciones([...salud.mediciones])
  }, [])

  useEffect(() => {
    revisar()
    const id = setInterval(revisar, 5000)
    return () => clearInterval(id)
  }, [revisar])

  const tiempos = mediciones.filter((m) => m.status > 0).map((m) => m.ms)
  const ultimo = salud.ultimoError
  const version = estado && (estado.version ?? estado.commit ?? estado.source_commit)

  return (
    <>
      <h1>Salud del sistema</h1>
      <p className="pista">Se revisa cada 5 segundos. La latencia es la que ve este navegador en sus últimas {mediciones.length} peticiones.</p>
      {usaMocks() && <p className="alerta alerta--aviso">Estás en modo simulado: estos datos no son del servidor real.</p>}
      <div className="rejilla">
        <section className="panel" aria-labelledby="t-servidor">
          <h2 id="t-servidor">Servidor</h2>
          {error ? (
            <p className="alerta alerta--error" role="alert">
              No responde. {error}
            </p>
          ) : !estado ? (
            <p role="status">Revisando…</p>
          ) : (
            <>
              <p>
                <span className="etiqueta etiqueta--exito">{estado.ok ? 'En línea' : 'Con problemas'}</span>
              </p>
              <p>Modo: {String(estado.modo ?? 'sin dato')}</p>
              <p>Versión desplegada: {version ? String(version) : 'sin dato'}</p>
            </>
          )}
        </section>
        <section className="panel" aria-labelledby="t-latencia">
          <h2 id="t-latencia">Latencia</h2>
          {tiempos.length === 0 ? (
            <p className="vacio">Aún no hay mediciones.</p>
          ) : (
            <div className="estado-grande">
              <div>
                <span className="pista">p95</span>
                <div className="cifra">{p95(tiempos)} ms</div>
              </div>
              <div>
                <span className="pista">Última</span>
                <div className="cifra">{tiempos[0]} ms</div>
              </div>
            </div>
          )}
          <p className="pista">Meta del taller: menos de 500 ms en p95.</p>
        </section>
        <section className="panel" aria-labelledby="t-error">
          <h2 id="t-error">Último error</h2>
          {ultimo ? (
            <p>
              {fechaHora(new Date(ultimo.at).toISOString())} · {ultimo.metodo} {ultimo.ruta} · {ultimo.status === 0 ? 'sin conexión' : `HTTP ${ultimo.status}`} · {ultimo.mensaje}
            </p>
          ) : (
            <p className="vacio">Sin errores desde que abriste el panel.</p>
          )}
        </section>
      </div>
    </>
  )
}
