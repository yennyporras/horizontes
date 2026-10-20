import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { matrizSVG } from './matriz/matriz.js'
import type { DatosTablero, Vista } from './tipos'
import { viewBoxDe, type Encuadre } from './zoom'

/** Animación R1 → R2: 1,2 s de movimiento y la flecha y las etiquetas aparecen hasta 1,4 s. */
const DURACION_ANIMACION_MS = 1600

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
  /** Zoom vectorial (tablero): parte visible del lienzo. Sin él, la matriz completa. */
  encuadre?: Encuadre
  className?: string
}

/**
 * Matriz de burbujas embebible (la usa T2 en la vista en vivo del participante).
 * Se redibuja al cambiar de tamaño; si los datos no cambian, el DOM no se toca.
 */
export function MatrizHorizontes({ datos, vista = 'comparacion', alto, llenar = false, escalaTexto = 1, animarComparacion = true, encuadre, className }: MatrizHorizontesProps) {
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

  // Al pasar a Comparación, una sola animación R1 → R2. Arranca en el mismo render que cambia la
  // vista (sin un cuadro previo con la comparación quieta). Si el SVG se redibuja mientras dura
  // (el encabezado cambia de alto al cerrar la ronda, llegan datos nuevos), sigue donde iba en vez de
  // volver a R1. Al terminar se redibuja sin ella para que el polling o un cambio de tamaño no la repitan.
  const [vistaPrevia, setVistaPrevia] = useState(vista)
  const [inicioAnimacion, setInicioAnimacion] = useState<number | null>(null)
  if (vistaPrevia !== vista) {
    setVistaPrevia(vista)
    setInicioAnimacion(animarComparacion && vista === 'comparacion' ? performance.now() : null)
  }
  useEffect(() => {
    if (inicioAnimacion === null) return
    const t = setTimeout(() => setInicioAnimacion(null), DURACION_ANIMACION_MS)
    return () => clearTimeout(t)
  }, [inicioAnimacion])

  const ancho = tam.w || 360
  const altoFinal = alto ?? (llenar && tam.h > 0 ? tam.h : Math.max(320, Math.min(ancho, 900)))
  const svg = useMemo(
    () =>
      matrizSVG(datos, {
        ancho,
        alto: altoFinal,
        vista,
        idPrefijo,
        escalaTexto,
        animar: inicioAnimacion !== null,
        animarDesdeMs: inicioAnimacion === null ? 0 : performance.now() - inicioAnimacion,
      }),
    [datos, ancho, altoFinal, vista, idPrefijo, escalaTexto, inicioAnimacion],
  )

  // El zoom cambia solo el viewBox del SVG ya dibujado: no reemplaza el nodo ni reinicia la animación.
  // Se vuelve a aplicar cuando el polling o un cambio de tamaño traen un SVG nuevo.
  useLayoutEffect(() => {
    const el = ref.current?.querySelector('svg')
    if (!el || !encuadre) return
    el.setAttribute('viewBox', viewBoxDe(encuadre, Number(el.getAttribute('width')), Number(el.getAttribute('height'))))
  }, [svg, encuadre])

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
