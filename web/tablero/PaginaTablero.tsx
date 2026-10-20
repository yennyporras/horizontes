import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useSearchParams } from 'react-router-dom'
import { BotonSalir, LienzoMatriz } from './LienzoMatriz'
import { PanelProyecto } from './PanelProyecto'
import { Progreso } from './Progreso'
import { TablaComparada } from './TablaComparada'
import { CuadriculaMesas, MESAS_POR_PAGINA, mesasConInscritos, paginasMesas } from './CuadriculaMesas'
import { ComoVoto } from './ComoVoto'
import { ExplicacionBreve, LecturaMatriz } from './ExplicacionBreve'
import { Cortina } from './Cortina'
import { QueSeMovio } from './QueSeMovio'
import { AyudaTeclas } from './AyudaTeclas'
import { PreguntaGuiada } from './PreguntaGuiada'
import { usePollingTablero } from './usePollingTablero'
import { accionDeTecla, usePantallaCompleta } from './usePantallaCompleta'
import {
  EN_VIVO,
  PARAMETRO_MODO,
  esSinPermiso,
  hayConvergencia,
  insigniaResultado,
  mensajeVacio,
  modoDeUrl,
  mostrarR2,
  nombreEstado,
  preguntaGuiadaActual,
  rondaEnCurso,
  rondaOculta,
  urlApiTablero,
  vistaPorDefecto,
  vistaVecina,
  votosRecibidos,
  type ModoTablero,
} from './logica'
import { EncabezadoProducto, LogoEstratek, PiePagina, useTemaDocumento } from '../shared/ui'
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

/** Sin conexión, los primeros 20 s solo un punto discreto «Reconectando» en la barra (Nicolai); después, el aviso. */
export const AVISO_CONEXION_MS = 20_000

/** Rondas del bloque «Cómo votó»: las de la vista; en Comparación, R1 y R2 cuando ya hay ronda 2. */
const rondasDe = (vista: Vista, conR2: boolean): (1 | 2)[] => (vista === 'comparacion' ? (conR2 ? [1, 2] : [1]) : [vista])

// Tablero: /tablero/:sala?mesa=&t=&modo=grafica|detallado (también los valores anteriores vivo|tabla).
// Proyector de 1920×1080 y 1280×720 sin desplazar en Gráfica y en Detallado; legible en 1366, 768 y 360 px.
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

  // La vista elegida a mano dura mientras no cambie la ronda (QA por roles, Nicolai: al cerrar la ronda 2 el tablero
  // saltaba solo a Comparación aunque el facilitador estuviera en otra vista). Sin elección, la de defecto: al cerrar
  // la ronda 2, Comparación. Se guarda con la ronda en que se eligió (sin efecto que la borre: un atajo pulsado justo
  // al llegar los datos no se pierde).
  const ronda = datos?.sala?.ronda_actual ?? 0
  const [elegida, setElegidaConRonda] = useState<{ vista: Vista; ronda: number } | null>(null)
  const vista = elegida && elegida.ronda === ronda ? elegida.vista : vistaPorDefecto(datos?.sala?.estado, datos?.sala?.ronda_actual, datos)
  const vistaRef = useRef(vista)
  vistaRef.current = vista
  const rondaRef = useRef(ronda)
  rondaRef.current = ronda
  // C en Comparación repite la animación R1 → R2 (antes no hacía nada).
  const [repeticion, setRepeticion] = useState(0)
  const setElegida = useCallback((v: Vista) => {
    if (v === 'comparacion' && vistaRef.current === 'comparacion') setRepeticion((n) => n + 1)
    setElegidaConRonda({ vista: v, ronda: rondaRef.current })
  }, [])

  // Dos modos de proyección, recordados en la URL (?modo=grafica|detallado) para que el panel enlace a cada uno:
  // «Gráfica» (por defecto: la matriz, que se mueve con cada foto de votos, y su lectura al lado) y «Detallado» (la
  // matriz con el progreso, los promedios por criterio y «Cómo votó»). Selector en el encabezado; teclas G, D y M
  // (alterna). Un clic en la matriz ya no cambia de modo (Nicolai: pasaba al dar foco a la ventana del proyector).
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
  // M, D o el selector abren Detallado siempre en «Promedios» (QA-T-07): «Cómo votó» es la tecla V.
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

  // Cada mesa por separado: de 4 en 4; con más, ← y → pasan de página en vez de cambiar de vista.
  const [paginaMesas, setPaginaMesas] = useState(0)
  const nPaginas = verMesas ? paginasMesas(datos) : 1
  const paginasRef = useRef(nPaginas)
  paginasRef.current = nPaginas
  const avanzar = useCallback(
    (paso: 1 | -1) => {
      if (paginasRef.current > 1) setPaginaMesas((p) => Math.min(paginasRef.current - 1, Math.max(0, p + paso)))
      else setElegida(vistaVecina(vistaRef.current, paso))
    },
    [setElegida],
  )

  const escalaTexto = useEscalaProyector()
  const letraMin = useLetraProyector()
  const pregunta = preguntaGuiadaActual(datos)
  // Pantalla completa (F): solo la matriz, en Gráfica y en Detallado (pedido de Paola, 21-oct: sin barra, selectores,
  // columna, leyenda ni tabla), con zoom. En Cada mesa por separado, la cuadrícula de matrices. El elemento se guarda
  // en estado: se monta con los datos y no existe con la pregunta guiada.
  const [objetivo, setObjetivo] = useState<HTMLDivElement | null>(null)
  // Tecla 0: la matriz vuelve a verse entera.
  const [entera, setEntera] = useState(0)
  const verEntera = useCallback(() => setEntera((n) => n + 1), [])
  const pantalla = usePantallaCompleta({
    elemento: objetivo,
    onVista: setElegida,
    onDetalle: alternarDetalle,
    onMatriz: alternarMatriz,
    onAvanzar: avanzar,
    onVerEntera: verEntera,
  })
  const conexion = useAvisoConexion(error, !!datos)
  const botonPantalla = (
    <>
      <button type="button" className="hz-boton-pantalla hz-boton-teclas" aria-keyshortcuts="?" onClick={() => pantalla.setAyuda((x) => !x)}>
        Teclas <kbd>?</kbd>
      </button>
      {objetivo && (
        <button type="button" className="hz-boton-pantalla" aria-keyshortcuts="F" onClick={pantalla.alternar}>
          Pantalla completa <kbd>F</kbd>
        </button>
      )}
    </>
  )

  const cambiarAlcance = (valor: string) => {
    const p = new URLSearchParams(params)
    p.delete('vista')
    // Cada mesa por separado no lleva `mesa` en la URL (QA-T-04: quedaba la mesa anterior junto a vista=mesas).
    if (valor === 'sala' || valor === 'mesas') p.delete('mesa')
    if (valor === 'mesas') p.set('vista', 'mesas')
    else if (valor !== 'sala') p.set('mesa', valor)
    setPaginaMesas(0)
    setParams(
      (actual) => {
        // Sobre los parámetros del momento (un atajo pudo cambiar el modo justo antes).
        const n = new URLSearchParams(actual)
        for (const k of ['vista', 'mesa']) n.delete(k)
        for (const [k, v] of p) if (k === 'vista' || k === 'mesa') n.set(k, v)
        return n
      },
      { replace: true },
    )
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
        <div className="hz-area hz-area-centrada hz-pagina">
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
        <PiePagina className="hz-tablero-pie" />
      </main>
    )
  }

  // Ronda 1 oculta: la cortina (avance por mesa) en lugar de los resultados, salvo en la vista de la ronda 2.
  const oculta = rondaOculta(datos, 1) && vista !== 2
  const movio = vista === 'comparacion' && hayConvergencia(datos)
  const totalMesas = verMesas ? mesasConInscritos(datos).length : 0
  const pagina = Math.min(paginaMesas, nPaginas - 1)

  return (
    <main
      className={['hz-tablero', soloMatriz && !verMesas && 'hz-matriz-sola', verMesas && 'hz-tablero-mesas'].filter(Boolean).join(' ')}
      data-ruta="tablero"
      data-tema="claro"
      data-modo={modo}
      data-detalle={soloMatriz ? undefined : detalle}
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
        reconectando={conexion === 'punto'}
      />
      <div className="hz-area hz-pagina">
        <FranjaFase estado={datos.sala?.estado} />
        {conexion === 'aviso' && error && (
          <p className="hz-aviso-error" role="alert">
            {error.mensaje} Mostramos los últimos datos recibidos.
          </p>
        )}
        {verMesas ? (
          <>
            <div ref={setObjetivo} className={['hz-mesas-lienzo', pantalla.respaldo && 'hz-lienzo-completo'].filter(Boolean).join(' ')} data-pantalla={pantalla.activa ? '' : undefined}>
              <CuadriculaMesas sala={sala} token={token} datos={datos} vista={vista} escalaTexto={escalaTexto > 1 ? 1.5 : 1} letraMin={letraMin} pagina={pagina} />
              {pantalla.activa && (
                <div className="hz-lienzo-controles">
                  <BotonSalir onSalir={pantalla.salir} />
                </div>
              )}
            </div>
            {/* Cada mesa por separado también lleva la leyenda de las rondas y la pantalla completa. */}
            <div className="hz-pie-matriz hz-pie-mesas">
              <Leyenda vista={vista} />
              {nPaginas > 1 && (
                <div className="hz-paginas" role="group" aria-label="Páginas de mesas">
                  <button type="button" className="hz-boton-pantalla" aria-keyshortcuts="ArrowLeft" disabled={pagina === 0} onClick={() => setPaginaMesas(pagina - 1)}>
                    <span aria-hidden="true">←</span> Anteriores
                  </button>
                  <span className="hz-paginas-n" aria-live="polite">
                    Mesas {pagina * MESAS_POR_PAGINA + 1} a {Math.min(totalMesas, (pagina + 1) * MESAS_POR_PAGINA)} de {totalMesas}
                  </span>
                  <button type="button" className="hz-boton-pantalla" aria-keyshortcuts="ArrowRight" disabled={pagina >= nPaginas - 1} onClick={() => setPaginaMesas(pagina + 1)}>
                    Siguientes <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
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
                <LienzoMatriz
                  datos={datos}
                  vista={vista}
                  escalaTexto={escalaTexto}
                  letraMin={letraMin}
                  repetirAnimacion={repeticion}
                  pantalla={pantalla.activa}
                  respaldo={pantalla.respaldo}
                  onSalir={pantalla.salir}
                  verEntera={entera}
                  lienzoRef={setObjetivo}
                />
                {/* Pie de la matriz: leyenda en una línea; en Gráfica, además las teclas y la pantalla completa. */}
                <div className="hz-pie-matriz">
                  <Leyenda vista={vista} />
                  {soloMatriz && <div className="hz-pie-controles">{botonPantalla}</div>}
                </div>
                {/* En Detallado, la lectura de los ejes va bajo la matriz (QA por roles: siempre visible). */}
                {!soloMatriz && <ExplicacionBreve className="hz-explica-detallado" />}
              </section>
            )}
            {/* Gráfica: la columna llena el espacio libre a la derecha de la matriz (abajo en pantallas angostas). */}
            {soloMatriz && !pregunta && (
              <aside className="hz-columna" aria-label="Lectura de la matriz">
                {oculta && <Cortina datos={datos} />}
                {movio && <QueSeMovio datos={datos} />}
                <LecturaMatriz />
              </aside>
            )}
            {!soloMatriz && (
              <aside className="hz-lateral" aria-label="Progreso y detalle por criterio">
                {!oculta && <Progreso datos={datos} />}
                <div className="hz-detalle-fila">
                  {!oculta && (
                    <div className="hz-detalle hz-segmento" role="group" aria-label="Detalle del panel">
                      {DETALLES.map((d) => (
                        <button key={d.id} type="button" aria-pressed={detalle === d.id} aria-keyshortcuts="V" onClick={() => setDetalle(d.id)}>
                          {d.texto}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="hz-pie-controles">{botonPantalla}</div>
                </div>
                {oculta ? (
                  <Cortina datos={datos} />
                ) : detalle === 'votos' ? (
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
                {/* Proyector: la lectura de los ejes va en el panel, bajo la tabla (bajo la matriz le quitaba alto). */}
                <ExplicacionBreve className="hz-explica-lateral" />
                {/* Celular y tableta: el tamaño de la burbuja y los horizontes al final del panel (CSS). */}
                <LecturaMatriz conEjes={false} className="hz-lectura-lateral" />
              </aside>
            )}
            {/* Sin matriz (pregunta guiada) el botón sigue a mano. */}
            {pregunta && soloMatriz && <div className="hz-pie-controles hz-pie-guiada">{botonPantalla}</div>}
          </div>
        )}
      </div>
      {/* Pie común: en celular y tableta, al final; en el proyector (≥ 1100 px) el tablero ocupa justo la pantalla y la
          firma de Estratek ya va en la barra (CSS). Nunca en la pantalla completa de la matriz (es otro elemento). */}
      <PiePagina className="hz-tablero-pie" />
      {/* En pantalla completa la ayuda va dentro de la matriz (lo único que se ve). */}
      {pantalla.ayuda &&
        (pantalla.activa && objetivo
          ? createPortal(<AyudaTeclas onCerrar={() => pantalla.setAyuda(false)} />, objetivo)
          : <AyudaTeclas onCerrar={() => pantalla.setAyuda(false)} />)}
    </main>
  )
}

/**
 * Aviso de conexión (Nicolai: en el proyector asustaba): los primeros 20 s sin respuesta solo un punto discreto
 * «Reconectando» en la barra; si sigue, el aviso completo. Un enlace sin permiso (401 o 403) avisa de una vez.
 */
function useAvisoConexion(error: { status: number } | null, conDatos: boolean): 'punto' | 'aviso' | null {
  const [largo, setLargo] = useState(false)
  const hayError = !!error
  useEffect(() => {
    setLargo(false)
    if (!hayError) return
    const t = setTimeout(() => setLargo(true), AVISO_CONEXION_MS)
    return () => clearTimeout(t)
  }, [hayError])
  if (!error) return null
  if (!conDatos || esSinPermiso(error.status) || largo) return 'aviso'
  return 'punto'
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
 * Barra común de la familia Estratek (EncabezadoProducto), igual que en el panel, el celular y la landing: logo de
 * Horizontes, «por Estratek »», la línea del degradado y, a la derecha, el logo de Estratek en hielo (QA por roles,
 * Paula). Debajo, la segunda franja clara con el nombre de la sala y los controles del tablero (alcance, modo y vista).
 */
function BarraTablero({ href, franja }: { href: string; franja?: ReactNode }) {
  return (
    <div className="hz-cab" data-tema="carbon">
      <EncabezadoProducto href={href} className="hz-cab-barra" franja={franja}>
        <LogoEstratek className="hz-cab-logo" />
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
  reconectando,
}: {
  href: string
  datos: DatosTablero
  vista: Vista
  onVista: (v: Vista) => void
  /** null en Cada mesa por separado: ahí los modos no cambian nada y el selector no se muestra. */
  modo: ModoTablero | null
  onModo: (m: ModoTablero) => void
  token: string | null
  mesa: string | null
  onAlcance: (v: string) => void
  reconectando: boolean
}) {
  const insignia = insigniaResultado(datos)
  const votos = votosRecibidos(datos)
  const alcanceTexto =
    mesa === 'mesas' ? 'Cada mesa por separado' : datos.alcance?.tipo === 'mesa' ? (datos.alcance.mesa_nombre ?? 'Mesa') : 'Toda la sala'
  return (
    <BarraTablero
      href={href}
      franja={
        <>
          <div className="hz-cab-titulo">
            <h1 className="hz-h1" title={datos.sala?.nombre ?? undefined}>
              {datos.sala?.nombre ?? 'Tablero'}
            </h1>
            <p className="hz-cab-meta">
              {conSeparadores([
                // Con la ronda abierta el estado ya lo dice en grande la franja de la ronda: aquí no se repite.
                !rondaEnCurso(datos.sala?.estado) && (
                  <span key="estado" className="hz-cab-estado">
                    {nombreEstado(datos.sala?.estado)}
                  </span>
                ),
                // Con el selector de alcance a la vista no se repite.
                !token && <span key="alcance">{alcanceTexto}</span>,
                // Indicador discreto de votos recibidos (progreso en vivo de la ronda).
                votos && (
                  <span key="votos" className="hz-cab-votos">
                    {votos}
                  </span>
                ),
              ])}
              {/* Estado de la ronda, no un modo de proyección: insignia sin borde, distinta de los botones del selector. */}
              {insignia === 'preliminar' && (
                <span className="hz-tb-insignia hz-tb-insignia-alerta" title="Todos votaron. Al cerrar la ronda se muestra el resultado final.">
                  Preliminar
                </span>
              )}
              {insignia === 'en_vivo' && (
                <span className="hz-tb-insignia hz-tb-insignia-vivo" title={EN_VIVO.titulo}>
                  {EN_VIVO.texto}
                </span>
              )}
              {reconectando && (
                <span className="hz-reconectando" role="status" title="Sin respuesta del servidor. Reintentamos solos cada pocos segundos.">
                  Reconectando
                </span>
              )}
            </p>
          </div>
          <div className="hz-cab-controles">
            {token && (
              <label className="hz-alcance">
                {/* El nombre queda para el lector de pantalla: las opciones ya dicen qué es y la barra cabe en una franja. */}
                <span className="hz-oculto">Alcance</span>
                {/* Control de la proyección, no un campo (data-atajos): suelta el foco al cambiar y no se come los atajos. */}
                <select
                  data-atajos=""
                  value={mesa ?? 'sala'}
                  // Un atajo nunca elige una opción (M buscaba «Mesa 1»): se corta aquí; el tablero lo atiende en window.
                  onKeyDown={(e) => {
                    if (accionDeTecla(e.key)) e.preventDefault()
                  }}
                  onChange={(e) => {
                    onAlcance(e.target.value)
                    e.currentTarget.blur()
                  }}
                >
                  <option value="sala">Toda la sala</option>
                  <option value="mesas">Cada mesa por separado</option>
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
        </>
      }
    />
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
      {n === 1 ? 'Ronda 1 · Individual y en silencio' : 'Ronda 2 · Discusión en la mesa'}
    </p>
  )
}

/** Leyenda por ronda en una línea: los proyectos de referencia, R1 aro hueco verde, R2 punto sólido rojo, siempre con su texto. */
function Leyenda({ vista }: { vista: Vista }) {
  const rondas = vista === 'comparacion' ? ([1, 2] as const) : [vista]
  return (
    <p className="hz-leyenda">
      <span>
        <i className="hz-ley-fijo" aria-hidden="true" /> Proyectos de referencia
      </span>
      {rondas.map((n) => (
        <span key={n}>
          <i className={`hz-marca-r${n}`} aria-hidden="true" />
          <b className={`hz-txt-r${n}`}>R{n}</b>
          <span className="hz-ley-largo"> Ronda {n}</span>
        </span>
      ))}
    </p>
  )
}
