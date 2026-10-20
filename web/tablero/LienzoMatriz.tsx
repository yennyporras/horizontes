import { useCallback, useEffect, useRef, useState } from 'react'
import { MatrizHorizontes } from './MatrizHorizontes'
import { ENTERA, acercarEn, desplazar, esEntera, factorRueda, puntoEn, type Encuadre } from './zoom'
import type { DatosTablero, Vista } from './tipos'

/**
 * Zoom de la matriz sobre el elemento `el`: la rueda del mouse o el pellizco acercan centrado en el puntero (1× a 4×),
 * arrastrar mueve cuando hay zoom y el doble clic acerca al doble. Responde en pantalla completa (`siempre`) o, fuera de
 * ella, cuando la matriz tiene el foco: así la rueda sigue desplazando la página como siempre.
 */
export function useZoomMatriz(el: HTMLElement | null, siempre: boolean) {
  const [encuadre, setEncuadreEstado] = useState<Encuadre>(ENTERA)
  const [arrastrando, setArrastrando] = useState(false)
  const encRef = useRef(encuadre)
  const setEncuadre = useCallback((e: Encuadre) => {
    encRef.current = e
    setEncuadreEstado(e)
  }, [])
  const siempreRef = useRef(siempre)
  siempreRef.current = siempre

  useEffect(() => {
    if (!el) return
    const activo = () => siempreRef.current || el.contains(document.activeElement)
    // Posición del puntero en fracción de la caja del dibujo (el SVG; sin él, el contenedor).
    const fraccion = (x: number, y: number) => {
      const r = (el.querySelector('svg') ?? el).getBoundingClientRect()
      return { fx: r.width ? (x - r.left) / r.width : 0.5, fy: r.height ? (y - r.top) / r.height : 0.5, w: r.width || 1, h: r.height || 1 }
    }
    const acercar = (factor: number, x: number, y: number) => {
      const { fx, fy } = fraccion(x, y)
      const p = puntoEn(encRef.current, fx, fy)
      setEncuadre(acercarEn(encRef.current, factor, p.x, p.y))
    }

    const rueda = (e: WheelEvent) => {
      if (!activo()) return
      e.preventDefault()
      acercar(factorRueda(e.deltaY, e.deltaMode), e.clientX, e.clientY)
    }
    const doble = (e: MouseEvent) => {
      if (!activo() || (e.target as Element | null)?.closest?.('button')) return
      e.preventDefault()
      acercar(2, e.clientX, e.clientY)
    }

    // Punteros activos: uno arrastra (con zoom), dos pellizcan.
    const punteros = new Map<number, { x: number; y: number }>()
    let distancia = 0
    const separacion = () => {
      const [a, b] = [...punteros.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    const abajo = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.('button') || (e.pointerType === 'mouse' && e.button !== 0)) return
      punteros.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (punteros.size === 2 && activo()) distancia = separacion()
      else if (punteros.size === 1 && !esEntera(encRef.current)) setArrastrando(true)
      else return
      el.setPointerCapture?.(e.pointerId)
    }
    const mueve = (e: PointerEvent) => {
      const previo = punteros.get(e.pointerId)
      if (!previo) return
      const ahora = { x: e.clientX, y: e.clientY }
      punteros.set(e.pointerId, ahora)
      if (punteros.size === 2 && distancia > 0) {
        const d = separacion()
        const [a, b] = [...punteros.values()]
        acercar(d / distancia, (a.x + b.x) / 2, (a.y + b.y) / 2)
        distancia = d
      } else if (punteros.size === 1 && !esEntera(encRef.current)) {
        const { w, h } = fraccion(ahora.x, ahora.y)
        setEncuadre(desplazar(encRef.current, (ahora.x - previo.x) / w, (ahora.y - previo.y) / h))
      }
    }
    const arriba = (e: PointerEvent) => {
      punteros.delete(e.pointerId)
      if (punteros.size < 2) distancia = 0
      if (!punteros.size) setArrastrando(false)
    }

    el.addEventListener('wheel', rueda, { passive: false })
    el.addEventListener('dblclick', doble)
    el.addEventListener('pointerdown', abajo)
    el.addEventListener('pointermove', mueve)
    el.addEventListener('pointerup', arriba)
    el.addEventListener('pointercancel', arriba)
    return () => {
      el.removeEventListener('wheel', rueda)
      el.removeEventListener('dblclick', doble)
      el.removeEventListener('pointerdown', abajo)
      el.removeEventListener('pointermove', mueve)
      el.removeEventListener('pointerup', arriba)
      el.removeEventListener('pointercancel', arriba)
    }
  }, [el, setEncuadre])

  const verEntera = useCallback(() => setEncuadre(ENTERA), [setEncuadre])
  return { encuadre, arrastrando, verEntera }
}

/** Botón discreto «Salir» de la pantalla completa, en la esquina (matriz y Cada mesa por separado). */
export function BotonSalir({ onSalir }: { onSalir: () => void }) {
  return (
    <button type="button" className="hz-boton-lienzo" aria-keyshortcuts="Escape F" onClick={onSalir}>
      Salir <kbd>Esc</kbd>
    </button>
  )
}

/**
 * La matriz del tablero en su lienzo: lo único que va a la pantalla completa (pedido de Paola, 21-oct: el plano con
 * los ejes, los horizontes y las burbujas; sin barra, selectores, columna, leyenda ni tabla), con zoom vectorial.
 */
export function LienzoMatriz({
  datos,
  vista,
  escalaTexto,
  letraMin,
  repetirAnimacion,
  pantalla,
  respaldo,
  onSalir,
  verEntera = 0,
  lienzoRef,
}: {
  datos: DatosTablero
  vista: Vista
  escalaTexto: number
  letraMin: number
  repetirAnimacion: number
  /** La matriz está en pantalla completa (la del navegador o, sin ella, el respaldo que la superpone a la página). */
  pantalla: boolean
  /** Sin la API de pantalla completa: el lienzo se superpone a toda la ventana. */
  respaldo: boolean
  onSalir: () => void
  /** Cada vez que cambia (tecla 0), la matriz vuelve a verse entera. */
  verEntera?: number
  lienzoRef: (el: HTMLDivElement | null) => void
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null)
  const ref = useCallback(
    (n: HTMLDivElement | null) => {
      setEl(n)
      lienzoRef(n)
    },
    [lienzoRef],
  )
  const zoom = useZoomMatriz(el, pantalla)
  const { verEntera: aEntera } = zoom
  // Tecla 0 y salida de la pantalla completa: la matriz vuelve a verse entera (la vista normal queda como siempre).
  useEffect(() => {
    if (verEntera) aEntera()
  }, [verEntera, aEntera])
  useEffect(() => {
    if (!pantalla) aEntera()
  }, [pantalla, aEntera])
  const conZoom = !esEntera(zoom.encuadre)

  return (
    <div
      ref={ref}
      className={['hz-lienzo', respaldo && pantalla && 'hz-lienzo-completo'].filter(Boolean).join(' ')}
      data-version={datos.version}
      data-pantalla={pantalla ? '' : undefined}
      data-zoom={conZoom ? String(Math.round(zoom.encuadre.k * 10) / 10) : undefined}
      data-arrastrando={zoom.arrastrando ? '' : undefined}
      tabIndex={0}
      role="group"
      aria-label="Matriz. Con el foco en ella, la rueda del mouse o el pellizco acercan; 0 la muestra entera."
    >
      <MatrizHorizontes
        datos={datos}
        vista={vista}
        llenar
        escalaTexto={escalaTexto}
        letraMin={letraMin}
        animarCambios
        repetirAnimacion={repetirAnimacion}
        encuadre={zoom.encuadre}
      />
      {(pantalla || conZoom) && (
        <div className="hz-lienzo-controles">
          {conZoom && (
            <button type="button" className="hz-boton-lienzo" aria-keyshortcuts="0" onClick={aEntera}>
              Ver entera <kbd>0</kbd>
            </button>
          )}
          {pantalla && <BotonSalir onSalir={onSalir} />}
        </div>
      )}
    </div>
  )
}
