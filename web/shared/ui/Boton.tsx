import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type VarianteBoton = 'primario' | 'secundario' | 'fantasma'

export interface BotonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variante?: VarianteBoton
  bloque?: boolean
  /** Deshabilitado accesible: sigue enfocable y anunciado, pero no ejecuta onClick. */
  deshabilitado?: boolean
  /** Muestra el giro y cambia el texto por textoCargando ("Guardando…"). */
  cargando?: boolean
  textoCargando?: string
  children: ReactNode
}

export function Boton({ variante = 'primario', bloque, deshabilitado, cargando, textoCargando, className, onClick, type = 'button', children, ...resto }: BotonProps) {
  const inactivo = deshabilitado || cargando
  const clases = ['hz-boton', `hz-boton--${variante}`, bloque && 'hz-boton--bloque', className].filter(Boolean).join(' ')
  return (
    <button
      {...resto}
      type={type}
      className={clases}
      aria-disabled={deshabilitado || undefined}
      aria-busy={cargando || undefined}
      onClick={(e) => {
        if (inactivo) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
    >
      {cargando && <span className="hz-boton__giro" aria-hidden="true" />}
      {cargando && textoCargando ? textoCargando : children}
    </button>
  )
}
