import { useId, type ReactNode } from 'react'

export interface CasillaProps {
  marcada: boolean
  onCambio: (marcada: boolean) => void
  children: ReactNode
  nombre?: string
}

/** Casilla de 24 px con área táctil de 48 px y el texto como etiqueta. El texto puede incluir enlaces. */
export function Casilla({ marcada, onCambio, children, nombre }: CasillaProps) {
  const id = useId()
  return (
    <div className="hz-casilla">
      <label htmlFor={id} className="hz-casilla__toque">
        <input id={id} name={nombre} type="checkbox" className="hz-casilla__input" checked={marcada} onChange={(e) => onCambio(e.target.checked)} />
      </label>
      <label htmlFor={id} className="hz-casilla__texto">
        {children}
      </label>
    </div>
  )
}
