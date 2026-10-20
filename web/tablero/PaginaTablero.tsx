import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MatrizHorizontes } from './MatrizHorizontes'
import { PanelProyecto } from './PanelProyecto'
import { Progreso } from './Progreso'
import { TablaComparada } from './TablaComparada'
import { CuadriculaMesas } from './CuadriculaMesas'
import { ComoVoto } from './ComoVoto'
import { ExplicacionBreve } from './ExplicacionBreve'
import { PreguntaGuiada } from './PreguntaGuiada'
import { usePollingTablero } from './usePollingTablero'
import { usePantallaCompleta } from './usePantallaCompleta'
import {
  EN_VIVO,
  VOTOS_POR_FOTO,
  insigniaResultado,
  mensajeVacio,
  modoDeUrl,
  mostrarR2,
  nombreEstado,
  preguntaGuiadaActual,
  rondaEnCurso,
  urlApiTablero,
  vistaPorDefecto,
  votosRecibidos,
  type ModoTablero,
} from './logica'
import { useTemaDocumento } from '../shared/ui'
import { LogoHorizontes } from '../shared/ui/marca/LogoHorizontes'
import type { DatosTablero, EstadoSala, Vista } from './tipos'
import './tablero.css'

const VISTAS: { id: Vista; texto: string }[] = [
  { id: 1, texto: 'Ronda 1' },
  { id: 2, texto: 'Ronda 2' },
  { id: 'comparacion', texto: 'Comparación' },
]

const MODOS: { id: ModoTablero; texto: string; tecla: string }[] = [
  { id: 'vivo', texto: 'En vivo', tecla: 'V' },
  { id: 'tabla', texto: 'Con tabla', tecla: 'T' },
]

type Detalle = 'promedios' | 'votos'
const DETALLES: { id: Detalle; texto: string }[] = [
  { id: 'promedios', texto: 'Promedios' },
  { id: 'votos', texto: 'Cómo votó' },
]

/** Rondas del bloque «Cómo votó»: las de la vista; en Comparación, R1 y R2 cuando ya hay ronda 2. */
const rondasDe = (vista: Vista, conR2: boolean): (1 | 2)[] => (vista === 'comparacion' ? (conR2 ? [1, 2] : [1]) : [vista])

// Tablero: /tablero/:sala?mesa=&t=&modo=vivo|tabla · modo proyector (1920 px) y legible en 1280, 1366 y 360 px.
export default function PaginaTablero() {
  const { sala = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const mesa = params.get('mesa')
  const token = params.get('t')
  // ?vista=mesas (solo con token): una matriz por mesa. La petición principal va a toda la sala.
  const verMesas = !!token && params.get('vista') === 'mesas'
  const url = sala ? urlApiTablero(sala, { mesa: verMesas ? null : mesa, t: token }) : null
  const { datos, error, cargando } = usePollingTablero(url)
  // Tema carbón también en <html>: el rebote del desplazamiento y el theme-color del navegador van en carbón.
  useTemaDocumento('carbon')

  // La vista elegida a mano dura hasta que cambie el estado de la sala; entonces vuelve la de defecto.
  // Se guarda con el estado en que se eligió (sin efecto que la borre: un atajo pulsado justo al
  // llegar los datos no se pierde).
  const estado = datos?.sala?.estado
  const [elegida, setElegidaConEstado] = useState<{ vista: Vista; estado: typeof estado } | null>(null)
  const estadoRef = useRef(estado)
  estadoRef.current = estado
  const setElegida = useCallback((v: Vista) => setElegidaConEstado({ vista: v, estado: estadoRef.current }), [])
  const vista = elegida && elegida.estado === estado ? elegida.vista : vistaPorDefecto(estado, datos?.sala?.ronda_actual)

  // Dos modos de proyección (pedido de Nicolai, 20-oct), recordados en la URL (?modo=vivo|tabla) para que el
  // panel enlace a cada uno: «En vivo» (por defecto, como la preentrega del 19-oct: solo la matriz, que se
  // mueve con cada foto de votos) y «Con tabla» (la matriz con promedios por criterio y «Cómo votó»).
  // Selector en el encabezado; teclas V, T y M (alterna); Esc vuelve a la tabla; clic en la matriz alterna.
  const modo = modoDeUrl(params.get('modo'))
  const soloMatriz = modo === 'vivo'
  const soloRef = useRef(soloMatriz)
  soloRef.current = soloMatriz
  const setModo = useCallback(
    (m: ModoTablero) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('modo', m)
          return n
        },
        { replace: true },
      ),
    [setParams],
  )
  // Panel de la tabla: promedios o «Cómo votó la sala» (conteo 1-3-5-7-9). Cambia con el botón o la tecla D,
  // que en el modo en vivo pasa a la tabla en «Cómo votó» (para el facilitador; no se ve por defecto).
  const [detalle, setDetalle] = useState<Detalle>('promedios')
  // Clic, M, T, Esc o el selector abren la tabla siempre en «Promedios» (QA-T-07): «Cómo votó» es la tecla D.
  const alternarMatriz = useCallback(
    (sola: boolean | null = null) => {
      const nueva = sola ?? !soloRef.current
      if (soloRef.current && !nueva) setDetalle('promedios')
      if (nueva !== soloRef.current) setModo(nueva ? 'vivo' : 'tabla')
    },
    [setModo],
  )
  const alternarDetalle = useCallback(() => {
    if (soloRef.current) {
      setModo('tabla')
      setDetalle('votos')
    } else setDetalle((d) => (d === 'promedios' ? 'votos' : 'promedios'))
  }, [setModo])

  const escalaTexto = useEscalaProyector()
  const letraMin = useLetraProyector()
  const pregunta = preguntaGuiadaActual(datos)
  // Pantalla completa (F): la página en el modo elegido, sin los controles del encabezado (pedido de Paola,
  // 20-oct; reemplaza el zoom por porcentaje). El elemento se guarda en estado: se monta con los datos.
  const [raiz, setRaiz] = useState<HTMLElement | null>(null)
  const pantalla = usePantallaCompleta({ elemento: raiz, onVista: setElegida, onDetalle: alternarDetalle, onMatriz: alternarMatriz })
  // Un clic en la matriz (sin arrastrar, por ejemplo al seleccionar) cambia de modo.
  const inicioClic = useRef({ x: 0, y: 0 })
  const botonPantalla = (
    <button type="button" className="hz-boton-pantalla" aria-keyshortcuts="F" onClick={pantalla.alternar}>
      {pantalla.activa ? 'Salir de pantalla completa' : 'Pantalla completa'} <kbd>F</kbd>
    </button>
  )

  const cambiarAlcance = (valor: string) => {
    const p = new URLSearchParams(params)
    p.delete('vista')
    // Todas las mesas no lleva `mesa` en la URL (QA-T-04: quedaba la mesa anterior junto a vista=mesas).
    if (valor === 'sala' || valor === 'mesas') p.delete('mesa')
    if (valor === 'mesas') p.set('vista', 'mesas')
    else if (valor !== 'sala') p.set('mesa', valor)
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
      ref={setRaiz}
      className={['hz-tablero', pantalla.activa && 'hz-pantalla-completa', soloMatriz && !verMesas && 'hz-matriz-sola'].filter(Boolean).join(' ')}
      data-ruta="tablero"
      data-tema="carbon"
      data-modo={modo}
    >
      <Encabezado
        datos={datos}
        vista={vista}
        onVista={setElegida}
        modo={modo}
        onModo={(m) => alternarMatriz(m === 'vivo')}
        token={token}
        mesa={verMesas ? 'mesas' : mesa}
        onAlcance={cambiarAlcance}
        pantallaCompleta={pantalla.activa}
      />
      <FranjaFase estado={datos.sala?.estado} />
      {error && (
        <p className="hz-aviso-error" role="alert">
          {error.mensaje} Mostramos los últimos datos recibidos.
        </p>
      )}
      {verMesas ? (
        <CuadriculaMesas sala={sala} token={token} datos={datos} vista={vista} escalaTexto={escalaTexto > 1 ? 1.5 : 1} letraMin={letraMin} />
      ) : (
        <div className="hz-cuerpo">
          {pregunta ? (
            <PreguntaGuiada p={pregunta} />
          ) : (
            <section className="hz-zona-matriz" aria-label="Matriz de priorización por horizontes">
              <Vacio datos={datos} vista={vista} />
              <div
                className="hz-lienzo"
                data-version={datos.version}
                onPointerDown={(e) => {
                  inicioClic.current = { x: e.clientX, y: e.clientY }
                }}
                onClick={(e) => {
                  if (Math.hypot(e.clientX - inicioClic.current.x, e.clientY - inicioClic.current.y) > 6) return
                  alternarMatriz()
                }}
              >
                <MatrizHorizontes datos={datos} vista={vista} llenar escalaTexto={escalaTexto} letraMin={letraMin} animarCambios />
              </div>
              {/* Pie de la matriz: leyenda en una línea; en vivo, además la explicación breve y la pantalla completa. */}
              <div className="hz-pie-matriz">
                <Leyenda vista={vista} />
                {soloMatriz && <ExplicacionBreve />}
                {soloMatriz && <div className="hz-pie-controles">{botonPantalla}</div>}
              </div>
            </section>
          )}
          {!soloMatriz && (
            <aside className="hz-lateral" aria-label="Detalle por proyecto y progreso">
              <Progreso datos={datos} />
              <div className="hz-detalle-fila">
                <div className="hz-detalle" role="group" aria-label="Detalle del panel">
                  {DETALLES.map((d) => (
                    <button key={d.id} type="button" aria-pressed={detalle === d.id} aria-keyshortcuts="D" onClick={() => setDetalle(d.id)}>
                      {d.texto}
                    </button>
                  ))}
                </div>
                {/* D2: con la ronda abierta, promedios y conteos son la última foto, no cada voto. */}
                {rondaEnCurso(datos.sala?.estado) && <p className="hz-nota-foto">Se actualizan cada {VOTOS_POR_FOTO} votos nuevos.</p>}
                <div className="hz-pie-controles">{botonPantalla}</div>
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
          {/* Sin matriz (pregunta guiada) el botón sigue a mano. */}
          {pregunta && soloMatriz && <div className="hz-pie-controles hz-pie-guiada">{botonPantalla}</div>}
        </div>
      )}
    </main>
  )
}

/** Letra más grande en la matriz cuando la pantalla es de proyector (≥ 1100 px de ancho). */
function useEscalaProyector() {
  return useAnchoVentana() >= 1100 ? 1.45 : 1
}

/**
 * QA-T-01: letra mínima de la matriz en el proyector, en px efectivos: 20 en 1280×720 y 24 en 1920×1080
 * (lectura a 6 m). En celular y tableta, sin mínimo: manda el tamaño del lienzo.
 */
export function letraProyector(ancho: number): number {
  if (ancho < 1100) return 0
  return Math.round(Math.min(24, Math.max(20, 20 + ((ancho - 1280) * 4) / 640)))
}
function useLetraProyector() {
  return letraProyector(useAnchoVentana())
}

function useAnchoVentana() {
  const [ancho, setAncho] = useState(() => (typeof window === 'undefined' ? 1920 : window.innerWidth))
  useEffect(() => {
    const cambio = () => setAncho(window.innerWidth)
    window.addEventListener('resize', cambio)
    return () => window.removeEventListener('resize', cambio)
  }, [])
  return ancho
}

function Encabezado({
  datos,
  vista,
  onVista,
  modo,
  onModo,
  token,
  mesa,
  onAlcance,
  pantallaCompleta,
}: {
  datos: DatosTablero
  vista: Vista
  onVista: (v: Vista) => void
  modo: ModoTablero
  onModo: (m: ModoTablero) => void
  token: string | null
  mesa: string | null
  onAlcance: (v: string) => void
  pantallaCompleta: boolean
}) {
  const insignia = insigniaResultado(datos)
  const votos = votosRecibidos(datos)
  const alcanceTexto =
    mesa === 'mesas' ? 'Todas las mesas' : datos.alcance?.tipo === 'mesa' ? (datos.alcance.mesa_nombre ?? 'Mesa') : 'Toda la sala'
  return (
    <header className="hz-cab">
      <div className="hz-cab-titulo">
        <div className="hz-cab-nombre">
          <h1>{datos.sala?.nombre ?? 'Tablero'}</h1>
          {/* El logo lleva al inicio; con el enlace del facilitador (trae token), a su panel. */}
          <p className="hz-firma">
            <a className="hz-firma-enlace" href={token ? '/admin/salas' : '/'}>
              <LogoHorizontes className="hz-firma-logo" tamano={20} />
              Horizontes por Estratek <span className="hz-firma-flecha" aria-hidden="true">»</span>
            </a>
          </p>
        </div>
        <p className="hz-cab-meta">
          <span>{nombreEstado(datos.sala?.estado)}</span>
          {/* Con el selector de alcance a la vista no se repite; en pantalla completa (sin selector), sí. */}
          {(!token || pantallaCompleta) && (
            <>
              <span aria-hidden="true">·</span>
              <span>{alcanceTexto}</span>
            </>
          )}
          {pantallaCompleta && (
            <>
              <span aria-hidden="true">·</span>
              <span className="hz-cab-vista">{VISTAS.find((v) => v.id === vista)?.texto}</span>
            </>
          )}
          {/* Indicador discreto de votos recibidos (progreso en vivo de la ronda). */}
          {votos && (
            <>
              <span aria-hidden="true">·</span>
              <span className="hz-cab-votos">{votos}</span>
            </>
          )}
          {insignia === 'preliminar' && (
            <span className="hz-insignia hz-insignia-alerta" title="Todos votaron. El resultado queda en firme cuando el facilitador cierre la ronda">
              Preliminar
            </span>
          )}
          {insignia === 'en_vivo' && (
            <span className="hz-insignia hz-insignia-vivo" title={EN_VIVO.titulo}>
              {EN_VIVO.texto}
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
        <div className="hz-segmento hz-modo" role="group" aria-label="Modo de proyección">
          {MODOS.map((m) => (
            <button key={m.id} type="button" aria-pressed={modo === m.id} aria-keyshortcuts={m.tecla} title={`Tecla ${m.tecla}`} onClick={() => onModo(m.id)}>
              {m.texto}
            </button>
          ))}
        </div>
        <div className="hz-segmento" role="group" aria-label="Vista de la matriz">
          {VISTAS.map((v) => (
            <button key={String(v.id)} type="button" aria-pressed={vista === v.id} onClick={() => onVista(v.id)}>
              {v.texto}
            </button>
          ))}
        </div>
      </div>
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

/** Qué se hace en la ronda abierta: R1 con aro verde hueco, R2 en rojo sólido, legible a 6 m. */
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

/** Leyenda por ronda en una línea: R1 aro hueco verde, R2 punto sólido rojo, siempre con su texto. */
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
          <b className={`hz-txt-r${n}`}>R{n}</b>
          <span className="hz-ley-largo"> Ronda {n}</span>
        </span>
      ))}
      <span>Burbuja: TAM</span>
    </p>
  )
}
