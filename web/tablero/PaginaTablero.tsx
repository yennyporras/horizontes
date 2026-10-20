import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
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
  PARAMETRO_MODO,
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
import { EncabezadoProducto, useTemaDocumento } from '../shared/ui'
import type { DatosTablero, EstadoSala, Vista } from './tipos'
import './tablero.css'

const VISTAS: { id: Vista; texto: string; tecla: string }[] = [
  { id: 1, texto: 'Ronda 1', tecla: '1' },
  { id: 2, texto: 'Ronda 2', tecla: '2' },
  { id: 'comparacion', texto: 'Comparación', tecla: 'C' },
]

const MODOS: { id: ModoTablero; texto: string; tecla: string }[] = [
  { id: 'grafica', texto: 'Gráfica', tecla: 'G' },
  { id: 'detallado', texto: 'Detallado', tecla: 'D' },
]

type Detalle = 'promedios' | 'votos'
const DETALLES: { id: Detalle; texto: string }[] = [
  { id: 'promedios', texto: 'Promedios' },
  { id: 'votos', texto: 'Cómo votó' },
]

/** Rondas del bloque «Cómo votó»: las de la vista; en Comparación, R1 y R2 cuando ya hay ronda 2. */
const rondasDe = (vista: Vista, conR2: boolean): (1 | 2)[] => (vista === 'comparacion' ? (conR2 ? [1, 2] : [1]) : [vista])

// Tablero: /tablero/:sala?mesa=&t=&modo=grafica|detallado (también los valores anteriores vivo|tabla).
// Proyector de 1920×1080 y 1280×720 sin desplazar en Gráfica; legible en 1366, 768 y 360 px.
export default function PaginaTablero() {
  const { sala = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const mesa = params.get('mesa')
  const token = params.get('t')
  // ?vista=mesas (solo con token): una matriz por mesa. La petición principal va a toda la sala.
  const verMesas = !!token && params.get('vista') === 'mesas'
  const url = sala ? urlApiTablero(sala, { mesa: verMesas ? null : mesa, t: token }) : null
  const { datos, error, cargando } = usePollingTablero(url)
  // Una sola apariencia en toda la app (Paola, 20-oct): fondo claro y barra carbón arriba. También en <html>.
  useTemaDocumento('claro')

  // La vista elegida a mano dura hasta que cambie el estado de la sala; entonces vuelve la de defecto.
  // Se guarda con el estado en que se eligió (sin efecto que la borre: un atajo pulsado justo al
  // llegar los datos no se pierde).
  const estado = datos?.sala?.estado
  const [elegida, setElegidaConEstado] = useState<{ vista: Vista; estado: typeof estado } | null>(null)
  const estadoRef = useRef(estado)
  estadoRef.current = estado
  const setElegida = useCallback((v: Vista) => setElegidaConEstado({ vista: v, estado: estadoRef.current }), [])
  const vista = elegida && elegida.estado === estado ? elegida.vista : vistaPorDefecto(estado, datos?.sala?.ronda_actual)

  // Dos modos de proyección, recordados en la URL (?modo=grafica|detallado) para que el panel enlace a cada uno:
  // «Gráfica» (por defecto: solo la matriz, que se mueve con cada foto de votos) y «Detallado» (la matriz con el
  // progreso, los promedios por criterio y «Cómo votó»). Selector en el encabezado; teclas G, D y M (alterna);
  // Esc pasa a Detallado; un clic en la matriz alterna.
  const modo = modoDeUrl(params.get(PARAMETRO_MODO))
  const soloMatriz = modo === 'grafica'
  const soloRef = useRef(soloMatriz)
  soloRef.current = soloMatriz
  const setModo = useCallback(
    (m: ModoTablero) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set(PARAMETRO_MODO, m)
          return n
        },
        { replace: true },
      ),
    [setParams],
  )
  // Panel del modo Detallado: promedios o «Cómo votó la sala» (conteo 1-3-5-7-9). Cambia con el botón o la
  // tecla V (votos), que en Gráfica pasa a Detallado en «Cómo votó» (para el facilitador; no se ve por defecto).
  const [detalle, setDetalle] = useState<Detalle>('promedios')
  // Clic, M, D, Esc o el selector abren Detallado siempre en «Promedios» (QA-T-07): «Cómo votó» es la tecla V.
  const alternarMatriz = useCallback(
    (sola: boolean | null = null) => {
      const nueva = sola ?? !soloRef.current
      if (soloRef.current && !nueva) setDetalle('promedios')
      if (nueva !== soloRef.current) setModo(nueva ? 'grafica' : 'detallado')
    },
    [setModo],
  )
  const alternarDetalle = useCallback(() => {
    if (soloRef.current) {
      setModo('detallado')
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
      {/* En Gráfica, la pantalla completa es solo el diagrama; en Detallado, lo dice el botón (pedido de Paola, 20-oct). */}
      {pantalla.activa ? 'Salir de pantalla completa' : soloMatriz || verMesas ? 'Pantalla completa' : 'Pantalla completa con detalle'} <kbd>F</kbd>
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

  // El logo lleva al inicio; con el enlace del facilitador (trae token), a su panel.
  const inicio = token ? '/admin/salas' : '/'

  if (!datos) {
    return (
      <main className="hz-tablero hz-tablero-solo" data-ruta="tablero" data-tema="claro">
        <BarraTablero href={inicio} />
        <div className="hz-area hz-area-centrada">
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
        </div>
      </main>
    )
  }

  return (
    <main
      ref={setRaiz}
      className={['hz-tablero', pantalla.activa && 'hz-pantalla-completa', soloMatriz && !verMesas && 'hz-matriz-sola'].filter(Boolean).join(' ')}
      data-ruta="tablero"
      data-tema="claro"
      data-modo={modo}
    >
      <Encabezado
        href={inicio}
        datos={datos}
        vista={vista}
        onVista={setElegida}
        modo={verMesas ? null : modo}
        onModo={(m) => alternarMatriz(m === 'grafica')}
        token={token}
        mesa={verMesas ? 'mesas' : mesa}
        onAlcance={cambiarAlcance}
        pantallaCompleta={pantalla.activa}
      />
      <div className="hz-area">
        <FranjaFase estado={datos.sala?.estado} />
        {error && (
          <p className="hz-aviso-error" role="alert">
            {error.mensaje} Mostramos los últimos datos recibidos.
          </p>
        )}
        {verMesas ? (
          <>
            <CuadriculaMesas sala={sala} token={token} datos={datos} vista={vista} escalaTexto={escalaTexto > 1 ? 1.5 : 1} letraMin={letraMin} />
            {/* Todas las mesas también lleva la leyenda de las rondas y el botón de pantalla completa. */}
            <div className="hz-pie-matriz hz-pie-mesas">
              <Leyenda vista={vista} />
              <div className="hz-pie-controles">{botonPantalla}</div>
            </div>
          </>
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
                {/* Pie de la matriz: leyenda en una línea; en Gráfica, además la explicación breve y la pantalla completa. */}
                <div className="hz-pie-matriz">
                  <Leyenda vista={vista} />
                  {soloMatriz && <ExplicacionBreve />}
                  {soloMatriz && <div className="hz-pie-controles">{botonPantalla}</div>}
                </div>
              </section>
            )}
            {!soloMatriz && (
              <aside className="hz-lateral" aria-label="Progreso y detalle por criterio">
                <Progreso datos={datos} />
                <div className="hz-detalle-fila">
                  <div className="hz-detalle" role="group" aria-label="Detalle del panel">
                    {DETALLES.map((d) => (
                      <button key={d.id} type="button" aria-pressed={detalle === d.id} aria-keyshortcuts="V" onClick={() => setDetalle(d.id)}>
                        {d.texto}
                      </button>
                    ))}
                  </div>
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
      </div>
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

/**
 * Barra carbón de la familia Estratek, como la del panel y el celular: logo de Horizontes, «por Estratek »» y la
 * línea del degradado debajo, de borde a borde. A la derecha, la sala y los controles del tablero.
 */
function BarraTablero({ href, children }: { href: string; children?: ReactNode }) {
  return (
    <div className="hz-cab" data-tema="carbon">
      <EncabezadoProducto href={href} className="hz-cab-barra">
        {children}
      </EncabezadoProducto>
    </div>
  )
}

function Encabezado({
  href,
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
  href: string
  datos: DatosTablero
  vista: Vista
  onVista: (v: Vista) => void
  /** null en Todas las mesas: ahí los modos no cambian nada y el selector no se muestra. */
  modo: ModoTablero | null
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
    <BarraTablero href={href}>
      <div className="hz-cab-titulo">
        <h1>{datos.sala?.nombre ?? 'Tablero'}</h1>
        <p className="hz-cab-meta">
          {conSeparadores([
            // Con la ronda abierta el estado ya lo dice en grande la franja de la ronda: aquí no se repite.
            !rondaEnCurso(datos.sala?.estado) && (
              <span key="estado" className="hz-cab-estado">
                {nombreEstado(datos.sala?.estado)}
              </span>
            ),
            // Con el selector de alcance a la vista no se repite; en pantalla completa (sin selector), sí.
            (!token || pantallaCompleta) && <span key="alcance">{alcanceTexto}</span>,
            pantallaCompleta && (
              <span key="vista" className="hz-cab-vista">
                {VISTAS.find((v) => v.id === vista)?.texto}
              </span>
            ),
            // Indicador discreto de votos recibidos (progreso en vivo de la ronda).
            votos && (
              <span key="votos" className="hz-cab-votos">
                {votos}
              </span>
            ),
          ])}
          {/* Estado de la ronda, no un modo de proyección: insignia sin borde, distinta de los botones del selector. */}
          {insignia === 'preliminar' && (
            <span className="hz-tb-insignia hz-tb-insignia-alerta" title="Todos votaron. El resultado queda en firme cuando el facilitador cierre la ronda">
              Preliminar
            </span>
          )}
          {insignia === 'en_vivo' && (
            <span className="hz-tb-insignia hz-tb-insignia-vivo" title={EN_VIVO.titulo}>
              {EN_VIVO.texto}
            </span>
          )}
        </p>
      </div>
      <div className="hz-cab-controles">
        {token && (
          <label className="hz-alcance">
            {/* El nombre queda para el lector de pantalla: las opciones ya dicen qué es y la barra cabe en una franja. */}
            <span className="hz-oculto">Alcance</span>
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
        {modo && (
          <div className="hz-segmento hz-modo" role="group" aria-label="Modo de proyección">
            {MODOS.map((m) => (
              <button key={m.id} type="button" aria-pressed={modo === m.id} aria-keyshortcuts={m.tecla} title={`Tecla ${m.tecla}`} onClick={() => onModo(m.id)}>
                {m.texto}
              </button>
            ))}
          </div>
        )}
        <div className="hz-segmento" role="group" aria-label="Vista de la matriz">
          {VISTAS.map((v) => (
            <button key={String(v.id)} type="button" aria-pressed={vista === v.id} aria-keyshortcuts={v.tecla} title={`Tecla ${v.tecla}`} onClick={() => onVista(v.id)}>
              {v.texto}
            </button>
          ))}
        </div>
      </div>
    </BarraTablero>
  )
}

/** Los datos de la barra, separados por «·» (decorativo para el lector de pantalla). */
function conSeparadores(partes: (ReactNode | false | null)[]): ReactNode[] {
  return partes.filter(Boolean).flatMap((p, i) => (i ? [<span key={`sep${i}`} aria-hidden="true">·</span>, p] : [p]))
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
  const n = rondaEnCurso(estado)
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
