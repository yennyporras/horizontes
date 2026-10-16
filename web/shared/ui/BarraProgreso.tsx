export interface BarraProgresoProps {
  actual: number
  total: number
  /** Texto visible y anunciado, por ejemplo "5 de 7 completaron". */
  texto: string
  etiqueta?: string
}

export function BarraProgreso({ actual, total, texto, etiqueta }: BarraProgresoProps) {
  const max = Math.max(total, 0)
  const valor = Math.min(Math.max(actual, 0), max)
  const pct = max > 0 ? (valor / max) * 100 : 0
  return (
    <div className="hz-progreso">
      <p className="hz-progreso__texto">
        {etiqueta && <span>{etiqueta}</span>}
        <strong>{texto}</strong>
      </p>
      <div className="hz-progreso__pista" role="progressbar" aria-label={etiqueta ?? texto} aria-valuemin={0} aria-valuemax={max} aria-valuenow={valor} aria-valuetext={texto}>
        <div className="hz-progreso__relleno" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
