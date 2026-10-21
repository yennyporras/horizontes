import type { ReactNode } from 'react'

/**
 * Barra inferior fija para la acción principal de la pantalla (zona del pulgar). El fondo va de borde a borde; el
 * interior es la columna de lectura del celular (`.hz-pagina--lectura`), centrada como el contenido.
 */
export function BarraAccion({ children, nota }: { children: ReactNode; nota?: ReactNode }) {
  return (
    <div className="hz-barra-accion">
      <div className="hz-barra-accion__interior hz-pagina hz-pagina--lectura">
        {nota && (
          <p className="hz-barra-accion__nota" aria-live="polite">
            {nota}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
