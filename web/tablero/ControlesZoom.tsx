import { ZOOM_MAX, ZOOM_MIN, type AccionZoom, type Encuadre } from './zoom'

/** Botones −, + y «Ver todo» del zoom de la matriz (C19-6); las teclas son −, + y 0. */
export function ControlesZoom({ encuadre, onAccion }: { encuadre: Encuadre; onAccion: (a: AccionZoom) => void }) {
  return (
    <div className="hz-zoom" role="group" aria-label="Zoom de la matriz">
      <button type="button" aria-label="Alejar" title="Alejar (tecla −)" aria-keyshortcuts="-" disabled={encuadre.k <= ZOOM_MIN} onClick={() => onAccion('alejar')}>
        −
      </button>
      <output aria-live="polite" aria-label="Zoom">
        {Math.round(encuadre.k * 100)}&nbsp;%
      </output>
      <button type="button" aria-label="Acercar" title="Acercar (tecla +)" aria-keyshortcuts="+" disabled={encuadre.k >= ZOOM_MAX} onClick={() => onAccion('acercar')}>
        +
      </button>
      <button type="button" title="Ver toda la matriz (tecla 0)" aria-keyshortcuts="0" disabled={encuadre.k <= ZOOM_MIN} onClick={() => onAccion('ver_todo')}>
        Ver todo
      </button>
    </div>
  )
}
