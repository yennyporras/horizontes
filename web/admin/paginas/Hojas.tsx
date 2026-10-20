import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import type { HojasSala } from '../tipos'

/**
 * Las 6 hojas de cada proyecto vivo, de solo lectura: el facilitador sabe qué información tuvo cada perfil,
 * aunque los celulares todavía no las vean todas.
 */
export function Hojas() {
  const { salaId } = useParams()
  const { datos, error } = useSala(salaId)
  const [hojas, setHojas] = useState<HojasSala['hojas'] | null>(null)
  const [errorHojas, setErrorHojas] = useState<string | null>(null)

  useEffect(() => {
    if (!salaId) return
    api
      .get<HojasSala>(`/api/admin/salas/${salaId}/hojas`)
      .then((r) => setHojas(r.hojas))
      .catch((e: Error) => setErrorHojas(e.message))
  }, [salaId])

  const proyectos = [...new Map((hojas ?? []).map((h) => [h.proyecto_id, h.proyecto])).entries()]
  return (
    <ConSala titulo="Hojas de los perfiles" datos={datos} error={error}>
      {(d) => (
        <>
          {/* Una sola introducción: qué es la sección y qué ven hoy los celulares. */}
          <p className="intro">
            Lo que sabe cada perfil de cada proyecto que se califica, de solo lectura.{' '}
            {d.sala.config.revelar_hojas
              ? 'Los celulares ya muestran las 6 hojas a todos.'
              : 'Hoy cada persona ve en su celular solo la hoja de su perfil; las 6 se abren para todos al iniciar la ronda 2.'}
          </p>
          {errorHojas ? (
            <p className="alerta alerta--error" role="alert">
              No pudimos cargar las hojas. {errorHojas}
            </p>
          ) : !hojas ? (
            <p role="status">Cargando hojas…</p>
          ) : hojas.length === 0 ? (
            <p className="vacio">Esta sala no tiene hojas de perfiles.</p>
          ) : (
            proyectos.map(([id, nombre]) => (
              <section key={id} className="panel" aria-labelledby={`t-hojas-${id}`}>
                <h2 id={`t-hojas-${id}`}>{nombre}</h2>
                <div className="rejilla rejilla--columnas">
                  {hojas
                    .filter((h) => h.proyecto_id === id)
                    .map((h) => (
                      <article key={h.perfil_id} className="hoja-perfil" aria-labelledby={`t-hoja-${id}-${h.perfil_id}`}>
                        <h3 id={`t-hoja-${id}-${h.perfil_id}`}>{h.perfil}</h3>
                        <p>{h.texto}</p>
                      </article>
                    ))}
                </div>
              </section>
            ))
          )}
        </>
      )}
    </ConSala>
  )
}
