import type { MouseEvent, ReactNode } from 'react'
import { LogoHorizontes } from './marca/LogoHorizontes'

export interface EncabezadoProductoProps {
  /** Nombre de la herramienta. */
  nombre?: string
  /** Si se da, la marca es un enlace: al inicio (`/`) o, dentro del panel, a Salas. */
  href?: string
  /** Para navegar dentro de la SPA (o confirmar cambios sin guardar) en lugar de recargar la página. */
  onIr?: (e: MouseEvent<HTMLAnchorElement>) => void
  /** Lo que va a la derecha de la marca: navegación, sala, acciones. */
  children?: ReactNode
  className?: string
}

/**
 * Encabezado de producto de la familia Estratek (FAMILIA_ESTRATEK §6): logo de Horizontes (el sol sobre la línea
 * del horizonte, en el acento de la herramienta), nombre, firma «por Estratek »» con la » en azul y la línea del
 * degradado debajo. El fondo y la línea van de borde a borde; la fila usa el contenedor de página (`.hz-pagina`),
 * así el encabezado se alinea con el contenido.
 */
export function EncabezadoProducto({ nombre = 'Horizontes', href, onIr, children, className }: EncabezadoProductoProps) {
  const marca = (
    <>
      <LogoHorizontes className="hz-producto__glifo" />
      <span className="hz-producto__textos">
        <span className="hz-producto__nombre">{nombre}</span>
        <span className="hz-producto__firma">
          por Estratek <span className="hz-producto__flecha" aria-hidden="true">»</span>
        </span>
      </span>
    </>
  )
  return (
    <header className={['hz-producto', className].filter(Boolean).join(' ')}>
      <div className="hz-producto__fila hz-pagina">
        {href ? (
          <a className="hz-producto__marca" href={href} onClick={onIr}>
            {marca}
          </a>
        ) : (
          <div className="hz-producto__marca">{marca}</div>
        )}
        {children && <div className="hz-producto__extra">{children}</div>}
      </div>
    </header>
  )
}
