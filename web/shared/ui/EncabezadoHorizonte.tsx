export interface EncabezadoHorizonteProps {
  sala: string
  meta?: string
}

/** Barra superior con los tres horizontes H1, H2 y H3 recortados en la esquina (decorativos). */
export function EncabezadoHorizonte({ sala, meta }: EncabezadoHorizonteProps) {
  return (
    <header className="hz-encabezado">
      <svg className="hz-encabezado__arcos" viewBox="0 0 132 96" preserveAspectRatio="xMaxYMin slice" aria-hidden="true" focusable="false">
        <circle cx="132" cy="0" r="128" fill="var(--hz-h1)" />
        <circle cx="132" cy="0" r="86" fill="var(--hz-h2)" />
        <circle cx="132" cy="0" r="44" fill="var(--hz-h3)" />
      </svg>
      <p className="hz-encabezado__sala">{sala}</p>
      {meta && <p className="hz-encabezado__meta">{meta}</p>}
    </header>
  )
}
