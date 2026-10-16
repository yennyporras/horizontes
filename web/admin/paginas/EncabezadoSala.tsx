import type { ReactNode } from 'react'
import type { SalaDetalle } from '../tipos'
import { ESTADOS } from '../textos'

/** Título común de las secciones de sala, con estados de carga y error. */
export function ConSala({ titulo, datos, error, children }: { titulo: string; datos: SalaDetalle | null; error: string | null; children: (d: SalaDetalle) => ReactNode }) {
  if (!datos) {
    return (
      <>
        <h1>{titulo}</h1>
        {error ? (
          <p className="alerta alerta--error" role="alert">
            No pudimos cargar la sala. {error}
          </p>
        ) : (
          <p role="status">Cargando sala…</p>
        )}
      </>
    )
  }
  return (
    <>
      <div className="encabezado-sala">
        <h1>{titulo}</h1>
        <p>
          <strong>{datos.sala.nombre}</strong> · <span className="sin-corte">{datos.sala.codigo}</span>{' '}
          <span className="sin-corte">
            · <span className={`estado estado--${datos.sala.estado}`}>{ESTADOS[datos.sala.estado]}</span>
          </span>
        </p>
      </div>
      {error && (
        <p className="alerta alerta--aviso" role="status">
          Se perdió la conexión. Reintentando… ({error})
        </p>
      )}
      {children(datos)}
    </>
  )
}
