import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { MatrizHorizontes } from './MatrizHorizontes'
import { PanelProyecto } from './PanelProyecto'
import { Progreso } from './Progreso'
import { TablaComparada } from './TablaComparada'
import { usePollingTablero } from './usePollingTablero'
import { esPreliminar, mensajeVacio, nombreEstado, urlApiTablero, vistaPorDefecto } from './logica'
import type { DatosTablero, Vista } from './tipos'
import './tablero.css'

const VISTAS: { id: Vista; texto: string }[] = [
  { id: 1, texto: 'Ronda 1' },
  { id: 2, texto: 'Ronda 2' },
  { id: 'comparacion', texto: 'Comparación' },
]

// T3: /tablero/:sala?mesa=&t= · modo proyector (1920 px) y legible en 1366 y 360 px.
export default function PaginaTablero() {
  const { sala = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const mesa = params.get('mesa')
  const token = params.get('t')
  const url = sala ? urlApiTablero(sala, { mesa, t: token }) : null
  const { datos, error, cargando } = usePollingTablero(url)

  // La vista elegida a mano dura hasta que cambie el estado de la sala; entonces vuelve la de defecto.
  const estado = datos?.sala?.estado
  const [elegida, setElegida] = useState<Vista | null>(null)
  useEffect(() => setElegida(null), [estado])
  const vista = elegida ?? vistaPorDefecto(estado, datos?.sala?.ronda_actual)

  const escalaTexto = useEscalaProyector()

  const cambiarAlcance = (valor: string) => {
    const p = new URLSearchParams(params)
    if (valor === 'sala') p.delete('mesa')
    else p.set('mesa', valor)
    setParams(p, { replace: true })
  }

  useEffect(() => {
    document.title = datos?.sala?.nombre ? `Tablero · ${datos.sala.nombre}` : 'Tablero · Horizontes'
  }, [datos?.sala?.nombre])

  if (!datos) {
    return (
      <main className="hz-tablero hz-tablero-solo" data-ruta="tablero">
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
    <main className="hz-tablero" data-ruta="tablero">
      <Encabezado datos={datos} vista={vista} onVista={setElegida} token={token} mesa={mesa} onAlcance={cambiarAlcance} />
      {error && (
        <p className="hz-aviso-error" role="alert">
          {error.mensaje} Mostramos los últimos datos recibidos.
        </p>
      )}
      <div className="hz-cuerpo">
        <section className="hz-zona-matriz" aria-label="Matriz de priorización por horizontes">
          <Vacio datos={datos} vista={vista} />
          <div className="hz-lienzo">
            <MatrizHorizontes datos={datos} vista={vista} llenar escalaTexto={escalaTexto} />
          </div>
          <Leyenda vista={vista} />
        </section>
        <aside className="hz-lateral" aria-label="Detalle por proyecto y progreso">
          <Progreso datos={datos} />
          {/* Proyector (≥ 1100 px): tabla comparada. Móvil y tableta: un panel por proyecto. Solo se ve uno (CSS). */}
          <div className="hz-solo-ancho">
            <TablaComparada datos={datos} vista={vista} />
          </div>
          <div className="hz-solo-angosto">
            {datos.proyectos_vivos.map((p, i) => (
              <PanelProyecto key={p.id} proyecto={p} indice={i} datos={datos} vista={vista} />
            ))}
          </div>
        </aside>
      </div>
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
  return ancho ? 1.3 : 1
}

function Encabezado({
  datos,
  vista,
  onVista,
  token,
  mesa,
  onAlcance,
}: {
  datos: DatosTablero
  vista: Vista
  onVista: (v: Vista) => void
  token: string | null
  mesa: string | null
  onAlcance: (v: string) => void
}) {
  const preliminar = esPreliminar(datos)
  const alcanceTexto =
    datos.alcance?.tipo === 'mesa' ? (datos.alcance.mesa_nombre ?? 'Mesa') : 'Toda la sala'
  return (
    <header className="hz-cab">
      <div className="hz-cab-titulo">
        <h1>{datos.sala?.nombre ?? 'Tablero'}</h1>
        <p className="hz-cab-meta">
          <span>{nombreEstado(datos.sala?.estado)}</span>
          <span aria-hidden="true">·</span>
          <span>{alcanceTexto}</span>
          {preliminar && (
            <span className="hz-insignia hz-insignia-alerta" title="El admin aún no cierra la ronda">
              Preliminar
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

function Leyenda({ vista }: { vista: Vista }) {
  return (
    <p className="hz-leyenda">
      <span>
        <i className="hz-ley-fijo" aria-hidden="true" /> Proyectos fijos
      </span>
      {vista === 'comparacion' ? (
        <>
          <span>
            <i className="hz-ley-r1" aria-hidden="true" /> Ronda 1
          </span>
          <span>
            <i className="hz-ley-r2" aria-hidden="true" /> Ronda 2
          </span>
        </>
      ) : (
        <span>
          <i className="hz-ley-r2" aria-hidden="true" /> Ronda {vista}
        </span>
      )}
      <span>Tamaño de la burbuja: TAM</span>
    </p>
  )
}
