import { useCallback, useEffect, useState } from 'react'
import { consultar, salud, usaMocks, type Medicion } from '../api'
import { fechaHora } from '../textos'
import { useTituloPagina } from './EncabezadoSala'
import { CabeceraPagina } from '../../shared/ui'

/** Tiempo típico de respuesta: la mediana de las últimas consultas (menos sensible a una sola lenta). */
const tipico = (xs: number[]) => {
  if (xs.length === 0) return null
  const o = [...xs].sort((a, b) => a - b)
  return o[Math.floor((o.length - 1) / 2)]
}

/** Meta del taller: que el panel y los celulares respondan en menos de medio segundo. */
const LENTO_MS = 500

/**
 * QA-A-27: semáforo en lenguaje llano para un facilitador no técnico: «Todo bien: el servidor responde en 39 ms». Sin
 * p95, modos ni versiones vacías; la versión solo aparece si el servidor la dice.
 */
export function semaforo(estado: { ok?: unknown } | null, error: string | null, ms: number | null): { tono: 'exito' | 'aviso' | 'error'; titulo: string; texto: string } {
  if (error) return { tono: 'error', titulo: 'No responde', texto: `El servidor no responde. ${error} Si sigue así más de 3 minutos, pasa al plan B en papel (plantillas que entrega Estratek).` }
  if (!estado) return { tono: 'aviso', titulo: 'Revisando…', texto: 'Estamos preguntándole al servidor cómo está.' }
  if (!estado.ok) return { tono: 'aviso', titulo: 'Con problemas', texto: 'El servidor responde, pero dice que algo no está bien. Avísale al equipo técnico.' }
  if (ms !== null && ms > LENTO_MS) return { tono: 'aviso', titulo: 'Lento', texto: `El servidor responde, pero tarda ${ms} ms. Puede ser el wifi del salón.` }
  return { tono: 'exito', titulo: 'Todo bien', texto: ms === null ? 'El servidor responde.' : `El servidor responde en ${ms} ms.` }
}

/** Monitor de salud: estado del servidor, tiempo de respuesta que ve este navegador y último error. */
export function Salud() {
  const [estado, setEstado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mediciones, setMediciones] = useState<Medicion[]>([])
  useTituloPagina('Salud')

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
  const ms = tipico(tiempos)
  const ultimo = salud.ultimoError
  const version = estado && (estado.version ?? estado.commit ?? estado.source_commit)
  // Un commit completo (40 caracteres) se muestra corto, como en GitHub.
  const versionCorta = version ? (/^[0-9a-f]{40}$/i.test(String(version)) ? String(version).slice(0, 7) : String(version)) : null
  const s = semaforo(estado, error, ms)

  return (
    <>
      <CabeceraPagina enfocable titulo="Salud del sistema" contexto="Se revisa sola cada 5 segundos, desde este navegador." />
      {usaMocks() && <p className="alerta alerta--aviso">Estás en modo simulado: estos datos no son del servidor real.</p>}
      <section className={`alerta alerta--${s.tono} semaforo`} aria-labelledby="t-semaforo" role="status">
        <strong id="t-semaforo">{s.titulo}</strong>
        <p>{s.texto}</p>
      </section>
      <ul className="kpis" aria-label="Resumen de salud">
        <li className="kpi">
          <span className="kpi__rotulo">Respuesta típica</span>
          <span className="cifra">{ms === null ? 'Sin datos' : `${ms} ms`}</span>
        </li>
        <li className="kpi">
          <span className="kpi__rotulo">Última respuesta</span>
          <span className="cifra">{tiempos[0] === undefined ? 'Sin datos' : `${tiempos[0]} ms`}</span>
        </li>
        <li className="kpi">
          <span className="kpi__rotulo">Consultas medidas</span>
          <span className="cifra">{tiempos.length}</span>
        </li>
        <li className="kpi">
          <span className="kpi__rotulo">Versión instalada</span>
          <span className="cifra cifra--texto" title={version ? String(version) : undefined}>
            {versionCorta ?? 'Sin dato'}
          </span>
        </li>
      </ul>
      <section className="panel" aria-labelledby="t-error">
        <h2 id="t-error">Último error</h2>
        {ultimo ? (
          <p>
            {fechaHora(new Date(ultimo.at).toISOString())} · {ultimo.status === 0 ? 'sin conexión' : `el servidor respondió con error ${ultimo.status}`} · {ultimo.mensaje}
          </p>
        ) : (
          <p className="vacio">Sin errores desde que abriste el panel.</p>
        )}
        <p className="pista">«Todo bien» significa que el servidor responde en menos de medio segundo.</p>
      </section>
    </>
  )
}
