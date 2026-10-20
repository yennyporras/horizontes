import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { LogoHorizontes } from './marca/LogoHorizontes'

/** Desde este ancho el menú va abierto en la barra y la franja se ve; por debajo, se pliegan en «Menú» (64 rem). */
export const ANCHO_MENU_ABIERTO = 1024

export interface EncabezadoProductoProps {
  /** Nombre de la herramienta. */
  nombre?: string
  /** Si se da, la marca es un enlace: al inicio (`/`) o, dentro del panel, a Salas. */
  href?: string
  /** Para navegar dentro de la SPA (o confirmar cambios sin guardar) en lugar de recargar la página. */
  onIr?: (e: MouseEvent<HTMLAnchorElement>) => void
  /** Siempre a la vista, a la derecha de la barra (por ejemplo, el logo de Estratek en el tablero). */
  children?: ReactNode
  /**
   * Lo propio del área (secciones, cuenta, acciones): a la derecha de la barra desde 1024 px; por debajo, dentro del
   * menú plegable que abre el botón «Menú». Es el mismo patrón en la landing, el panel y el resto.
   */
  menu?: ReactNode
  /**
   * Segunda franja clara bajo la barra, de 56 px: las pestañas del panel o los controles del tablero. Una sola fila;
   * si no cabe, se desliza de lado (nunca se parte en varias filas).
   */
  franja?: ReactNode
  /** Bajo 1024 px la franja va dentro del menú plegable (panel). Si no, queda como fila deslizable (tablero). */
  franjaEnMenu?: boolean
  /** Texto del botón del menú (por defecto «Menú»; el panel le suma la sección actual). */
  etiquetaMenu?: string
  /** Estado controlado del menú plegable (el panel lo cierra al cambiar de sección). */
  menuAbierto?: boolean
  onMenu?: (abierto: boolean) => void
  className?: string
}

/**
 * Encabezado de producto de la familia Estratek (FAMILIA_ESTRATEK §6 y docs/DISENO.md §Composición): la barra
 * superior carbón de todas las vistas, con la misma altura (64 px en celular, 72 px desde 1024 px) y el mismo
 * contenedor de página. Logo de Horizontes, nombre, firma «por Estratek »» y la línea del degradado debajo. El
 * <header> lleva `data-tema="carbon"`: la barra y el menú plegable toman el tema carbón aunque la página sea clara; la
 * franja lleva su propio `data-tema="claro"`.
 *
 * Lo de cada área entra con el mismo patrón: `menu` a la derecha desde 1024 px y, por debajo, en el menú plegable (se
 * cierra al elegir, con Escape, con el mismo botón o tocando fuera); `franja` como segunda franja de 56 px.
 * El contenido del menú y de la franja existe una sola vez en el documento: al abrir el menú se muda al desplegable.
 */
export function EncabezadoProducto({
  nombre = 'Horizontes',
  href,
  onIr,
  children,
  menu,
  franja,
  franjaEnMenu = false,
  etiquetaMenu = 'Menú',
  menuAbierto,
  onMenu,
  className,
}: EncabezadoProductoProps) {
  const [abiertoPropio, setAbiertoPropio] = useState(false)
  const abierto = menuAbierto ?? abiertoPropio
  const setAbierto = (v: boolean) => {
    if (menuAbierto === undefined) setAbiertoPropio(v)
    onMenu?.(v)
  }
  const setRef = useRef(setAbierto)
  setRef.current = setAbierto
  const boton = useRef<HTMLButtonElement>(null)
  const cabecera = useRef<HTMLElement>(null)
  const idMenu = useId()
  const conMenu = Boolean(menu || (franja && franjaEnMenu))

  useEffect(() => {
    if (!abierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setRef.current(false)
      boton.current?.focus()
    }
    // Un toque fuera del encabezado también lo cierra: el desplegable tapa parte de la página.
    const alTocar = (e: PointerEvent) => {
      if (!cabecera.current?.contains(e.target as Node)) setRef.current(false)
    }
    // Si la ventana crece hasta 1024 px, el menú vuelve a la barra y el desplegable se cierra.
    const ancho = typeof window.matchMedia === 'function' ? window.matchMedia(`(min-width: ${ANCHO_MENU_ABIERTO}px)`) : null
    const alCrecer = () => ancho?.matches && setRef.current(false)
    document.addEventListener('keydown', alTeclear)
    document.addEventListener('pointerdown', alTocar)
    ancho?.addEventListener?.('change', alCrecer)
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.removeEventListener('pointerdown', alTocar)
      ancho?.removeEventListener?.('change', alCrecer)
    }
  }, [abierto])

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
  // Elegir un enlace o un botón dentro del desplegable lo cierra (salvo controles de formulario).
  const alElegir = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a, button')) setAbierto(false)
  }
  const franjaVisible = franja && !(franjaEnMenu && abierto)
  return (
    <header
      ref={cabecera}
      className={['hz-encabezado', abierto && 'hz-encabezado--abierto', className].filter(Boolean).join(' ')}
      data-tema="carbon"
    >
      <div className="hz-producto">
        <div className="hz-producto__fila hz-pagina">
          {href ? (
            <a className="hz-producto__marca" href={href} onClick={onIr}>
              {marca}
            </a>
          ) : (
            <div className="hz-producto__marca">{marca}</div>
          )}
          {menu && !abierto && <div className="hz-producto__menu">{menu}</div>}
          {children && <div className="hz-producto__extra">{children}</div>}
          {conMenu && (
            <button
              ref={boton}
              type="button"
              className="hz-boton hz-boton--secundario hz-producto__menu-boton"
              aria-expanded={abierto}
              aria-controls={idMenu}
              onClick={() => setAbierto(!abierto)}
            >
              {etiquetaMenu}
            </button>
          )}
        </div>
      </div>
      {conMenu && abierto && (
        <div id={idMenu} className="hz-producto__desplegable" onClick={alElegir}>
          <div className="hz-pagina hz-producto__desplegable-interior">
            {franjaEnMenu && franja}
            {menu}
          </div>
        </div>
      )}
      {franjaVisible && (
        <div className={['hz-franja-pagina', franjaEnMenu && 'hz-franja-pagina--plegable'].filter(Boolean).join(' ')} data-tema="claro">
          <div className="hz-franja-pagina__fila hz-pagina">{franja}</div>
        </div>
      )}
    </header>
  )
}
