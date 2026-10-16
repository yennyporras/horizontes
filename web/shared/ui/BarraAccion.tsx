import type { ReactNode } from 'react'

/** Barra inferior fija para la acción principal de la pantalla (zona del pulgar). */
export function BarraAccion({ children, nota }: { children: ReactNode; nota?: ReactNode }) {
  return (
    <div className="hz-barra-accion">
      <div className="hz-barra-accion__interior">
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
