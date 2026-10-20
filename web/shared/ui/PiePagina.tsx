import type { ReactNode } from 'react'
import { LogoEstratek } from './marca/LogoEstratek'
import { URL_ESTRATEK, URL_POLITICA } from '../estratek'

export interface EnlacePie {
  texto: string
  href: string
  /** Se abre en otra pestaña (sitios de Estratek). */
  externo?: boolean
}

/** Enlaces mínimos de todas las vistas: la política de datos y el sitio de Estratek. */
export const ENLACES_PIE: EnlacePie[] = [
  { texto: 'Política de datos', href: URL_POLITICA, externo: true },
  { texto: 'estratek.com.co', href: URL_ESTRATEK, externo: true },
]

/**
 * Pie común (docs/DISENO.md §Composición, 21-oct): la línea del degradado encima, el logo de Estratek, una línea
 * «Horizontes, una herramienta de Estratek» y los enlaces mínimos, en el mismo contenedor de página que la barra.
 * Va en la landing (debajo de su bloque final), el celular, el login, el panel y el tablero normal; nunca en la
 * pantalla completa de la matriz. `antes` agrega enlaces propios del área al principio (elementos <li>).
 */
export function PiePagina({ antes, className }: { antes?: ReactNode; className?: string }) {
  return (
    <footer className={['hz-pie', className].filter(Boolean).join(' ')}>
      <div className="hz-pie__fila hz-pagina">
        <LogoEstratek className="hz-pie__logo" />
        <p className="hz-pie__texto">
          Horizontes, una herramienta de Estratek{' '}
          <span className="hz-pie__flecha" aria-hidden="true">
            »
          </span>
        </p>
        <nav className="hz-pie__enlaces" aria-label="Pie de página">
          <ul>
            {antes}
            {ENLACES_PIE.map((e) => (
              <li key={e.href}>
                <a href={e.href} {...(e.externo ? { target: '_blank', rel: 'noreferrer' } : {})}>
                  {e.texto}
                  {e.externo && <span className="hz-visual-oculto"> (se abre en otra pestaña)</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
