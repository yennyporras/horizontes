import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, lista } from '../api'
import type { SalaResumen } from '../tipos'
import { ESTADOS } from '../textos'

/**
 * Sección de sala sin sala elegida en este navegador (por ejemplo, un admin que entra por primera vez desde su equipo).
 * Lista las salas para abrir la sección directo en la que elija.
 */
export function ElegirSala() {
  const { seccion = 'vivo' } = useParams()
  const [salas, setSalas] = useState<SalaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<unknown>('/api/admin/salas')
      .then((r) => setSalas(lista<SalaResumen>(r, 'salas')))
      .catch((e: Error) => setError(e.message))
  }, [])

  return (
    <section className="panel" aria-labelledby="t-elegir">
      <h1 id="t-elegir">Elige una sala</h1>
      <p>Esta sección trabaja sobre una sala. Elige con cuál sigues.</p>
      {error ? (
        <p className="alerta alerta--error" role="alert">
          No pudimos cargar las salas. {error}
        </p>
      ) : !salas ? (
        <p role="status">Cargando salas…</p>
      ) : salas.length === 0 ? (
        <p className="vacio">Aún no hay salas. Crea la primera en Salas.</p>
      ) : (
        <ul className="lista-elegir">
          {salas.map((s) => (
            <li key={s.id}>
              <Link className="btn" to={`/admin/salas/${s.id}/${seccion}`}>
                {s.nombre}
              </Link>
              <span className="pista">
                {s.codigo} · {ESTADOS[s.estado]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link to="/admin/salas">Ir a Salas</Link>
    </section>
  )
}
