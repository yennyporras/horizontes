import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { matrizSVG } from './matriz/matriz.js'
import type { DatosTablero, Vista } from './tipos'

export interface MatrizHorizontesProps {
  /** Respuesta de GET /api/tablero o GET /api/resultados. Sin fetch interno. */
  datos: DatosTablero | null
  /** 1, 2 o 'comparacion' (R1 suave, R2 sólido y flecha). Por defecto, comparación. */
  vista?: Vista
  /**
   * Alto en px. Si se omite: con `llenar` usa el alto que le dé el CSS del contenedor;
   * sin `llenar`, un cuadrado del ancho disponible (mínimo 320 px).
   */
  alto?: number
  llenar?: boolean
  /** Multiplica el tamaño de letra de la matriz (1 = base; proyector ~1,3). */
  escalaTexto?: number
  /** Anima R1 → R2 cuando la vista cambia a Comparación (por defecto, sí). */
  animarComparacion?: boolean
  className?: string
}

/**
 * Matriz de burbujas embebible (la usa T2 en la vista en vivo del participante).
 * Se redibuja al cambiar de tamaño; si los datos no cambian, el DOM no se toca.
 */
export function MatrizHorizontes({ datos, vista = 'comparacion', alto, llenar = false, escalaTexto = 1, animarComparacion = true, className }: MatrizHorizontesProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [tam, setTam] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const idPrefijo = 'hzm' + useId().replace(/[^a-zA-Z0-9]/g, '')

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const w = Math.round(el.clientWidth)
      const h = Math.round(el.clientHeight)
      setTam((t) => (t.w === w && t.h === h ? t : { w, h }))
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    let pendiente = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(pendiente)
      pendiente = requestAnimationFrame(medir)
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(pendiente)
      ro.disconnect()
    }
  }, [])

  // Al pasar a Comparación, una sola animación R1 → R2; luego se redibuja sin ella para que el
  // polling o un cambio de tamaño no la repitan.
  const [animar, setAnimar] = useState(false)
  const vistaPrevia = useRef(vista)
  useEffect(() => {
    const antes = vistaPrevia.current
    vistaPrevia.current = vista
    if (!animarComparacion || antes === vista || vista !== 'comparacion') return
    setAnimar(true)
    const t = setTimeout(() => setAnimar(false), 1600)
    return () => clearTimeout(t)
  }, [vista, animarComparacion])

  const ancho = tam.w || 360
  const altoFinal = alto ?? (llenar && tam.h > 0 ? tam.h : Math.max(320, Math.min(ancho, 900)))
  const svg = useMemo(
    () => matrizSVG(datos, { ancho, alto: altoFinal, vista, idPrefijo, escalaTexto, animar: animar && vista === 'comparacion' }),
    [datos, ancho, altoFinal, vista, idPrefijo, escalaTexto, animar],
  )

  return (
    <div
      ref={ref}
      className={['hz-matriz-contenedor', className].filter(Boolean).join(' ')}
      style={llenar ? { width: '100%', height: '100%', overflow: 'hidden' } : { width: '100%' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default MatrizHorizontes
