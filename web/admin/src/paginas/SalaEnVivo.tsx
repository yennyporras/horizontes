import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import type { Accion } from '../tipos'
import { ACCIONES, ACCIONES_POR_ESTADO, fechaHora } from '../textos'

const DESTRUCTIVAS: Accion[] = ['reiniciar_ronda', 'cerrar_sala']

export function SalaEnVivo() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  const ejecutar = async (accion: Accion) => {
    if (DESTRUCTIVAS.includes(accion) && !window.confirm(`¿Seguro? ${ACCIONES[accion]} no se puede deshacer desde aquí.`)) return
    setErrorAccion(null)
    try {
      await api.post(`/api/admin/salas/${salaId}/acciones`, { accion })
      await refrescar()
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo ejecutar la acción.')
    }
  }

  return (
    <ConSala titulo="Sala en vivo" datos={datos} error={error}>
      {(d) => {
        const enPrecierre = d.mesas.filter((m) => m.precierre)
        return (
          <>
            {enPrecierre.length > 0 && (
              <p className="alerta alerta--exito" role="status">
                Todos votaron en {enPrecierre.map((m) => m.nombre).join(', ')}. Puedes cerrar la ronda.
              </p>
            )}
            <section className="panel" aria-labelledby="t-control">
              <h2 id="t-control">Control de la sala</h2>
              <div className="acciones">
                {ACCIONES_POR_ESTADO[d.sala.estado].map((a) => (
                  <button key={a} className={DESTRUCTIVAS.includes(a) ? 'btn btn--peligro' : 'btn btn--primario'} onClick={() => ejecutar(a)}>
                    {ACCIONES[a]}
                  </button>
                ))}
              </div>
              {errorAccion && (
                <p className="alerta alerta--error" role="alert">
                  {errorAccion}
                </p>
              )}
            </section>

            <section className="panel" aria-labelledby="t-mesas">
              <h2 id="t-mesas">Mesas</h2>
              {d.mesas.length === 0 ? (
                <p className="vacio">Esta sala no tiene mesas.</p>
              ) : (
                <div className="tabla-envoltura">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Mesa</th>
                        <th scope="col">Código</th>
                        <th scope="col">Inscritos</th>
                        <th scope="col">Completos</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Enlaces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.mesas.map((m) => (
                        <tr key={m.id}>
                          <th scope="row">{m.nombre}</th>
                          <td>{m.codigo}</td>
                          <td>{m.inscritos}</td>
                          <td>
                            {m.completos} de {m.inscritos}
                          </td>
                          <td>{m.precierre ? <span className="etiqueta etiqueta--exito">Precierre</span> : 'Votando'}</td>
                          <td className="enlaces">
                            <a href={m.url_participante} target="_blank" rel="noreferrer">
                              Participante
                            </a>
                            <a href={m.url_tablero} target="_blank" rel="noreferrer">
                              Tablero
                            </a>
                            <a href={`/api/admin/mesas/${m.id}/qr.svg`} target="_blank" rel="noreferrer">
                              QR
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="panel" aria-labelledby="t-eventos">
              <h2 id="t-eventos">Bitácora de la sala</h2>
              {d.eventos.length === 0 ? (
                <p className="vacio">Aún no hay eventos.</p>
              ) : (
                <ol className="eventos">
                  {d.eventos.slice(0, 20).map((ev, i) => (
                    <li key={i}>
                      <time dateTime={ev.at}>{fechaHora(ev.at)}</time> · {ev.tipo.replace(/_/g, ' ')} · {ev.por}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )
      }}
    </ConSala>
  )
}
