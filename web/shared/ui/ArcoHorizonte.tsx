const LADO = 40
const MAX = LADO - 4

/**
 * Cuarto de círculo con radio proporcional al valor de la rúbrica (1 a 9), anclado en la esquina
 * inferior izquierda como el origen de la matriz. Misma geometría que las curvas H1/H2 del tablero.
 */
export function ArcoHorizonte({ valor }: { valor: number }) {
  const r = Math.max(4, (Math.min(Math.max(valor, 0), 9) / 9) * MAX)
  const x0 = 2
  const y0 = LADO - 2
  const forma = `M ${x0} ${y0} L ${x0} ${y0 - r} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`
  const guia = `M ${x0} ${y0 - MAX} A ${MAX} ${MAX} 0 0 1 ${x0 + MAX} ${y0}`
  return (
    <svg className="hz-arco" viewBox={`0 0 ${LADO} ${LADO}`} aria-hidden="true" focusable="false">
      <path className="hz-arco__guia" d={guia} />
      <path className="hz-arco__forma" d={forma} />
    </svg>
  )
}
