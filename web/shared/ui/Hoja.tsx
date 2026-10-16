import type { ReactNode } from 'react'

export interface HojaProps {
  titulo: ReactNode
  extra?: ReactNode
  activa?: boolean
  children: ReactNode
}

/** Hoja de información de un proyecto. Solo la activa lleva elevación. */
export function Hoja({ titulo, extra, activa, children }: HojaProps) {
  return (
    <section className={['hz-hoja', activa && 'hz-hoja--activa'].filter(Boolean).join(' ')}>
      <h3 className="hz-hoja__titulo">
        <span>{titulo}</span>
        {extra}
      </h3>
      <div className="hz-hoja__texto">{children}</div>
    </section>
  )
}
