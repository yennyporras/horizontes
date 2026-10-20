import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { SalaDetalle } from '../tipos'
import type { ErrorSala } from '../useSala'
import { ESTADOS } from '../textos'

/** QA-A-24: cada sección tiene su título en la pestaña del navegador («Participantes · Taller X · Horizontes»). */
export function useTituloPagina(...partes: (string | null | undefined)[]) {
  const titulo = [...partes.filter(Boolean), 'Horizontes'].join(' · ')
  useEffect(() => {
    document.title = titulo
  }, [titulo])
}

/** Título común de las secciones de sala, con estados de carga y error. */
export function ConSala({ titulo, datos, error, children }: { titulo: string; datos: SalaDetalle | null; error: ErrorSala | null; children: (d: SalaDetalle) => ReactNode }) {
  useTituloPagina(titulo, datos?.sala.nombre)
  if (!datos) {
    return (
      <>
        <h1 tabIndex={-1}>{titulo}</h1>
        {error ? (
          <>
            <p className="alerta alerta--error" role="alert">
              No pudimos cargar la sala. {error.texto}
            </p>
            <Link className="hz-boton hz-boton--secundario" to="/admin/salas">
              Elegir otra sala
            </Link>
          </>
        ) : (
          <p role="status">Cargando sala…</p>
        )}
      </>
    )
  }
  return (
    <>
      <div className="encabezado-sala">
        <h1 tabIndex={-1}>{titulo}</h1>
        <p className="encabezado-sala__meta">
          <strong>{datos.sala.nombre}</strong>
          {datos.sala.tipo === 'ensayo' && <span className="etiqueta etiqueta--ensayo">Ensayo</span>}
          <span className="sin-corte">Código {datos.sala.codigo}</span>
          <span className={`estado estado--${datos.sala.estado}`}>{ESTADOS[datos.sala.estado]}</span>
        </p>
      </div>
      {/* F-5: solo un problema de red o del servidor es «conexión»; lo demás se dice tal cual. */}
      {error && (
        <p className={`alerta ${error.conexion ? 'alerta--aviso' : 'alerta--error'}`} role="status">
          {error.conexion ? `Se perdió la conexión con el servidor. Reintentamos cada 2,5 segundos. ${error.texto}` : error.texto}
        </p>
      )}
      {children(datos)}
    </>
  )
}
