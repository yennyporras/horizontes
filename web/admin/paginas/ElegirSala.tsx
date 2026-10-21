import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, lista } from '../api'
import type { SalaResumen } from '../tipos'
import { ESTADOS } from '../textos'
import { nombreSeccionSala } from '../secciones'
import { useTituloPagina } from './EncabezadoSala'
import { CabeceraPagina } from '../../shared/ui'

/**
 * Sección de sala sin sala elegida en este navegador (por ejemplo, un admin que entra por primera vez desde su equipo).
 * Lista las salas para abrir la sección directo en la que elija.
 */
export function ElegirSala() {
  const { seccion = 'vivo' } = useParams()
  const [salas, setSalas] = useState<SalaResumen[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const nombreSeccion = nombreSeccionSala(seccion)
  useTituloPagina('Elige una sala', nombreSeccion)

  useEffect(() => {
    api
      .get<unknown>('/api/admin/salas')
      .then((r) => setSalas(lista<SalaResumen>(r, 'salas')))
      .catch((e: Error) => setError(e.message))
  }, [])

  // Mismo esquema que las demás secciones: el título afuera y la lista en su tarjeta.
  return (
    <>
      <CabeceraPagina
        enfocable
        titulo="Elige una sala"
        contexto={`${nombreSeccion ? `${nombreSeccion} trabaja sobre una sala.` : 'Esta sección trabaja sobre una sala.'} Elige con cuál sigues; el panel la recuerda en este navegador.`}
      />
      <section className="panel" aria-label="Salas">
        {error ? (
          <p className="alerta alerta--error" role="alert">
            No pudimos cargar las salas. {error}
          </p>
        ) : !salas ? (
          <p role="status">Cargando salas…</p>
        ) : salas.length === 0 ? (
          <p className="vacio">
            Aún no hay salas. Crea la primera en <Link to="/admin/salas">Salas</Link>.
          </p>
        ) : (
          <ul className="lista-elegir">
            {salas.map((s) => (
              <li key={s.id}>
                <Link className="hz-boton hz-boton--secundario" to={`/admin/salas/${s.id}/${seccion}`}>
                  {s.nombre}
                </Link>
                <span className="pista">
                  {s.codigo} · {ESTADOS[s.estado]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
