import type { ReactNode } from 'react'

export interface CabeceraPaginaProps {
  /** Título de la página: el único h1 de la vista. */
  titulo: ReactNode
  /** Línea pequeña sobre el título. */
  antetitulo?: ReactNode
  /** Línea de contexto bajo el título (sala, código, estado). */
  contexto?: ReactNode
  /** Acciones de la página: a la derecha desde 768 px, debajo en el celular. */
  acciones?: ReactNode
  /** El h1 recibe el foco al cambiar de pantalla (lectores de pantalla). */
  enfocable?: boolean
  id?: string
  className?: string
}

/**
 * Cabecera de página común (docs/DISENO.md §Composición, 21-oct): el mismo título en las cuatro áreas, con una sola
 * escala (h1 en 900, de 24 a 32 px con `--hz-fs-h1`), la línea de contexto debajo y las acciones opcionales al lado.
 * La landing conserva su titular grande solo en el héroe.
 */
export function CabeceraPagina({ titulo, antetitulo, contexto, acciones, enfocable, id, className }: CabeceraPaginaProps) {
  return (
    <div className={['hz-cabecera-pagina', className].filter(Boolean).join(' ')}>
      <div className="hz-cabecera-pagina__textos">
        {antetitulo && <p className="hz-cabecera-pagina__ante">{antetitulo}</p>}
        <h1 id={id} className="hz-h1" tabIndex={enfocable ? -1 : undefined}>
          {titulo}
        </h1>
        {contexto && <div className="hz-cabecera-pagina__contexto">{contexto}</div>}
      </div>
      {acciones && <div className="hz-cabecera-pagina__acciones">{acciones}</div>}
    </div>
  )
}
