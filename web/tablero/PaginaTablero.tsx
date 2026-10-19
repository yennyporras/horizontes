import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MatrizHorizontes } from './MatrizHorizontes'
import { PanelProyecto } from './PanelProyecto'
import { Progreso } from './Progreso'
import { TablaComparada } from './TablaComparada'
import { CuadriculaMesas } from './CuadriculaMesas'
import { ComoVoto } from './ComoVoto'
import { ControlesZoom } from './ControlesZoom'
import { ExplicacionMatriz } from './ExplicacionMatriz'
import { PreguntaGuiada } from './PreguntaGuiada'
import { usePollingTablero } from './usePollingTablero'
import { usePantallaCompleta } from './usePantallaCompleta'
import { insigniaResultado, mensajeVacio, mostrarR2, nombreEstado, preguntaGuiadaActual, urlApiTablero, vistaPorDefecto } from './logica'
import { useZoomMatriz } from './zoom'
import type { DatosTablero, EstadoSala, Vista } from './tipos'
import '../shared/ui/tokens.css'
import './tablero.css'

const VISTAS: { id: Vista; texto: string }[] = [
  { id: 1, texto: 'Ronda 1' },
  { id: 2, texto: 'Ronda 2' },
  { id: 'comparacion', texto: 'Comparación' },
]

type Detalle = 'promedios' | 'votos'
const DETALLES: { id: Detalle; texto: string }[] = [
  { id: 'promedios', texto: 'Promedios' },
  { id: 'votos', texto: 'Cómo votó' },
]

/** Rondas del bloque «Cómo votó»: las de la vista; en Comparación, R1 y R2 cuando ya hay ronda 2. */
const rondasDe = (vista: Vista, conR2: boolean): (1 | 2)[] => (vista === 'comparacion' ? (conR2 ? [1, 2] : [1]) : [vista])

// T3: /tablero/:sala?mesa=&t= · modo proyector (1920 px) y legible en 1366 y 360 px.
export default function PaginaTablero() {
  const { sala = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const mesa = params.get('mesa')
  const token = params.get('t')
  // ?vista=mesas (solo con token): una matriz por mesa. La petición principal va a toda la sala.
  const verMesas = !!token && params.get('vista') === 'mesas'
  const url = sala ? urlApiTablero(sala, { mesa: verMesas ? null : mesa, t: token }) : null
  const { datos, error, cargando } = usePollingTablero(url)

  // La vista elegida a mano dura hasta que cambie el estado de la sala; entonces vuelve la de defecto.
  // Se guarda con el estado en que se eligió (sin efecto que la borre: un atajo pulsado justo al
  // llegar los datos no se pierde).
  const estado = datos?.sala?.estado
  const [elegida, setElegidaConEstado] = useState<{ vista: Vista; estado: typeof estado } | null>(null)
  const estadoRef = useRef(estado)
  estadoRef.current = estado
  const setElegida = useCallback((v: Vista) => setElegidaConEstado({ vista: v, estado: estadoRef.current }), [])
  const vista = elegida && elegida.estado === estado ? elegida.vista : vistaPorDefecto(estado, datos?.sala?.ronda_actual)

  // Preentrega del 19-oct: el público ve solo la matriz (la tabla la leían como coordenadas). Clic en la
  // matriz, el botón o la tecla M muestran los datos (panel lateral) y vuelven; Esc vuelve a los datos.
  const [soloMatriz, setSoloMatriz] = useState(true)
  const alternarMatriz = useCallback((sola: boolean | null = null) => setSoloMatriz((s) => sola ?? !s), [])

  // Panel lateral: promedios (tabla) o «Cómo votó la sala» (conteo 1-3-5-7-9). Cambia con el botón o la tecla D,
  // que con la matriz sola abre los datos en «Cómo votó» (para el facilitador; no se ve por defecto).
  const [detalle, setDetalle] = useState<Detalle>('promedios')
  const soloRef = useRef(soloMatriz)
  soloRef.current = soloMatriz
  const alternarDetalle = useCallback(() => {
    if (soloRef.current) {
      setSoloMatriz(false)
      setDetalle('votos')
    } else setDetalle((d) => (d === 'promedios' ? 'votos' : 'promedios'))
  }, [])

  const escalaTexto = useEscalaProyector()
  // Zoom de la matriz (T1): el lienzo se guarda en estado porque se monta cuando llegan los datos.
  const [lienzo, setLienzo] = useState<HTMLDivElement | null>(null)
  const zoom = useZoomMatriz(lienzo, alternarMatriz)
  const pantalla = usePantallaCompleta({ onVista: setElegida, onDetalle: alternarDetalle, onZoom: zoom.accion, onMatriz: alternarMatriz })
  const pregunta = preguntaGuiadaActual(datos)

  const cambiarAlcance = (valor: string) => {
    const p = new URLSearchParams(params)
    p.delete('vista')
    if (valor === 'sala') p.delete('mesa')
    else if (valor === 'mesas') p.set('vista', 'mesas')
    else p.set('mesa', valor)
    setParams(p, { replace: true })
  }

  useEffect(() => {
    document.title = datos?.sala?.nombre ? `Tablero · ${datos.sala.nombre}` : 'Tablero · Horizontes'
  }, [datos?.sala?.nombre])

  if (!datos) {
    return (
      <main className="hz-tablero hz-tablero-solo" data-ruta="tablero" data-tema="carbon">
        {cargando && !error ? (
          <p className="hz-cargando" role="status">
            Cargando el tablero…
          </p>
        ) : (
          <div className="hz-error-grande" role="alert">
            <h1>No pudimos abrir el tablero</h1>
            <p>{error?.mensaje ?? 'Revisa el enlace del tablero.'}</p>
          </div>
        )}
      </main>
    )
  }

  return (
    <main
      className={['hz-tablero', pantalla.activa && 'hz-pantalla-completa', soloMatriz && !verMesas && 'hz-matriz-sola'].filter(Boolean).join(' ')}
      data-ruta="tablero"
      data-tema="carbon"
    >
      <Encabezado
        datos={datos}
        vista={vista}
        onVista={setElegida}
        token={token}
        mesa={verMesas ? 'mesas' : mesa}
        onAlcance={cambiarAlcance}
        pantallaCompleta={pantalla.activa}
        onPantalla={pantalla.alternar}
      />
      <FranjaFase estado={datos.sala?.estado} />
      {error && (
        <p className="hz-aviso-error" role="alert">
          {error.mensaje} Mostramos los últimos datos recibidos.
        </p>
      )}
      {verMesas ? (
        <CuadriculaMesas sala={sala} token={token} datos={datos} vista={vista} escalaTexto={escalaTexto > 1 ? 1.5 : 1} />
      ) : (
        <div className="hz-cuerpo">
          {pregunta ? (
            <PreguntaGuiada p={pregunta} />
          ) : (
            <section className="hz-zona-matriz" aria-label="Matriz de priorización por horizontes">
              <Vacio datos={datos} vista={vista} />
              <div ref={setLienzo} className={zoom.encuadre.k > 1 ? 'hz-lienzo hz-con-zoom' : 'hz-lienzo'} data-version={datos.version}>
                <MatrizHorizontes datos={datos} vista={vista} llenar escalaTexto={escalaTexto} encuadre={zoom.encuadre} />
              </div>
              <div className="hz-pie-matriz">
                <Leyenda vista={vista} />
                <div className="hz-pie-controles">
                  <ControlesZoom encuadre={zoom.encuadre} onAccion={zoom.accion} />
                  <button type="button" className="hz-boton-datos" aria-keyshortcuts="M" onClick={() => alternarMatriz()}>
                    {soloMatriz ? 'Ver datos' : 'Solo la matriz'} <kbd>M</kbd>
                  </button>
                </div>
              </div>
              <ExplicacionMatriz datos={datos} />
            </section>
          )}
          {!soloMatriz && (
            <aside className="hz-lateral" aria-label="Detalle por proyecto y progreso">
              <Progreso datos={datos} />
              <div className="hz-detalle" role="group" aria-label="Detalle del panel">
                {DETALLES.map((d) => (
                  <button key={d.id} type="button" aria-pressed={detalle === d.id} aria-keyshortcuts="D" onClick={() => setDetalle(d.id)}>
                    {d.texto}
                  </button>
                ))}
              </div>
              {detalle === 'votos' ? (
                <ComoVoto datos={datos} rondas={rondasDe(vista, mostrarR2(datos))} />
              ) : (
                <>
                  {/* Proyector (≥ 1100 px): tabla comparada. Móvil y tableta: un panel por proyecto. Solo se ve uno (CSS). */}
                  <div className="hz-solo-ancho">
                    <TablaComparada datos={datos} vista={vista} />
                  </div>
                  <div className="hz-solo-angosto">
                    {datos.proyectos_vivos.map((p) => (
                      <PanelProyecto key={p.id} proyecto={p} datos={datos} vista={vista} />
                    ))}
                  </div>
                </>
              )}
            </aside>
          )}
        </div>
      )}
    </main>
  )
}

/** Letra más grande en la matriz cuando la pantalla es de proyector (≥ 1100 px de ancho). */
function useEscalaProyector() {
  const consulta = '(min-width: 1100px)'
  const [ancho, setAncho] = useState(() => typeof matchMedia === 'function' && matchMedia(consulta).matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const m = matchMedia(consulta)
    const cambio = () => setAncho(m.matches)
    m.addEventListener('change', cambio)
    return () => m.removeEventListener('change', cambio)
  }, [])
  return ancho ? 1.45 : 1
}

function Encabezado({
  datos,
  vista,
  onVista,
  token,
  mesa,
  onAlcance,
  pantallaCompleta,
  onPantalla,
}: {
  datos: DatosTablero
  vista: Vista
  onVista: (v: Vista) => void
  token: string | null
  mesa: string | null
  onAlcance: (v: string) => void
  pantallaCompleta: boolean
  onPantalla: () => void
}) {
  const insignia = insigniaResultado(datos)
  const alcanceTexto =
    mesa === 'mesas' ? 'Todas las mesas' : datos.alcance?.tipo === 'mesa' ? (datos.alcance.mesa_nombre ?? 'Mesa') : 'Toda la sala'
  return (
    <header className="hz-cab">
      <div className="hz-cab-titulo">
        <div className="hz-cab-nombre">
          <h1>{datos.sala?.nombre ?? 'Tablero'}</h1>
          <p className="hz-firma">
            Horizontes por Estratek <span className="hz-firma-flecha" aria-hidden="true">»</span>
          </p>
        </div>
        <p className="hz-cab-meta">
          <span>{nombreEstado(datos.sala?.estado)}</span>
          <span aria-hidden="true">·</span>
          <span>{alcanceTexto}</span>
          {insignia === 'preliminar' && (
            <span className="hz-insignia hz-insignia-alerta" title="Todos votaron. El resultado queda en firme cuando el facilitador cierre la ronda">
              Preliminar
            </span>
          )}
          {insignia === 'en_vivo' && (
            <span className="hz-insignia hz-insignia-vivo" title="La ronda sigue abierta: el resultado cambia con cada voto">
              En vivo
            </span>
          )}
        </p>
      </div>
      <div className="hz-cab-controles">
        {token && (
          <label className="hz-alcance">
            <span>Alcance</span>
            <select value={mesa ?? 'sala'} onChange={(e) => onAlcance(e.target.value)}>
              <option value="sala">Toda la sala</option>
              <option value="mesas">Todas las mesas</option>
              {(datos.progreso?.por_mesa ?? []).map((m) => (
                <option key={m.mesa_id} value={m.mesa_id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="hz-segmento" role="group" aria-label="Vista de la matriz">
          {VISTAS.map((v) => (
            <button key={String(v.id)} type="button" aria-pressed={vista === v.id} onClick={() => onVista(v.id)}>
              {v.texto}
            </button>
          ))}
        </div>
        <button type="button" className="hz-boton-pantalla" onClick={onPantalla} aria-keyshortcuts="F">
          {pantallaCompleta ? 'Salir de pantalla completa' : 'Pantalla completa'} <kbd>F</kbd>
        </button>
      </div>
      {pantallaCompleta && (
        <p className="hz-cab-vista" aria-live="polite">
          {VISTAS.find((v) => v.id === vista)?.texto}
        </p>
      )}
    </header>
  )
}

function Vacio({ datos, vista }: { datos: DatosTablero; vista: Vista }) {
  const msg = useMemo(() => mensajeVacio(datos, vista), [datos, vista])
  if (!msg) return null
  return (
    <p className="hz-vacio" role="status">
      {msg}
    </p>
  )
}

/** Qué se hace en la ronda abierta, en el color de la ronda y legible a 6 m. */
function FranjaFase({ estado }: { estado: EstadoSala | undefined }) {
  const n = estado === 'r1_abierta' ? 1 : estado === 'r2_abierta' ? 2 : null
  if (!n) return null
  return (
    <p className={`hz-franja hz-franja-r${n}`}>
      <i className={`hz-marca-r${n}`} aria-hidden="true" />
      {n === 1 ? 'Ronda 1 · individual y en silencio' : 'Ronda 2 · discusión en la mesa'}
    </p>
  )
}

/** Leyenda por ronda: R1 aro hueco verde, R2 punto sólido rojo, siempre con su texto. */
function Leyenda({ vista }: { vista: Vista }) {
  const rondas = vista === 'comparacion' ? ([1, 2] as const) : [vista]
  return (
    <p className="hz-leyenda">
      <span>
        <i className="hz-ley-fijo" aria-hidden="true" /> Proyectos fijos
      </span>
      {rondas.map((n) => (
        <span key={n}>
          <i className={`hz-marca-r${n}`} aria-hidden="true" />
          <b className={`hz-txt-r${n}`}>R{n}</b> Ronda {n}
        </span>
      ))}
      <span>Tamaño de la burbuja: TAM</span>
    </p>
  )
}
