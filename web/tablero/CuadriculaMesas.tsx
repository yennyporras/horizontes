import type React from 'react'
import { MatrizHorizontes } from './MatrizHorizontes'
import { usePollingTablero } from './usePollingTablero'
import { conteoMesa, esPreliminar, mensajeVacio, rondaAbierta, urlApiTablero } from './logica'
import type { DatosTablero, ProgresoMesa, Vista } from './tipos'

// Con muchas mesas cada una hace su propio polling: más lento que el tablero principal para no cargar el servidor.
const INTERVALO_MESAS_MS = 5000

function CeldaMesa({
  sala,
  token,
  mesa,
  vista,
  escalaTexto,
  letraMin,
  llenar,
}: {
  sala: string
  token: string | null
  mesa: ProgresoMesa
  vista: Vista
  escalaTexto: number
  letraMin: number
  llenar: boolean
}) {
  const { datos, error } = usePollingTablero(urlApiTablero(sala, { mesa: mesa.mesa_id, t: token }), INTERVALO_MESAS_MS)
  const vacio = datos ? mensajeVacio(datos, vista) : null
  const idTitulo = `hz-celda-${mesa.mesa_id}`
  // Conteo, "todos votaron" y "Preliminar" salen de la misma respuesta (la de la celda) para que no se
  // contradigan entre polls; mientras llega, el progreso de la sala.
  const propia = datos?.progreso?.por_mesa?.find((m) => m.mesa_id === mesa.mesa_id) ?? mesa
  const lista = propia.precierre && rondaAbierta(datos?.sala?.estado)
  return (
    <section className="hz-celda-mesa" aria-labelledby={idTitulo}>
      <header className="hz-celda-cab">
        <h2 id={idTitulo}>{mesa.nombre}</h2>
        {/* QA-T-04: el conteo es el de la ronda que se ve (en Comparación, las dos), no el de la ronda en curso. */}
        <span className={lista ? 'hz-mesa-n hz-ok-texto' : 'hz-mesa-n'}>
          {conteoMesa(datos, propia, vista)}
          {lista ? ', todos votaron' : ''}
        </span>
        {datos && esPreliminar(datos) && <span className="hz-tb-insignia hz-tb-insignia-alerta">Preliminar</span>}
      </header>
      {error && !datos && (
        <p className="hz-aviso-error" role="alert">
          {error.mensaje}
        </p>
      )}
      {vacio && <p className="hz-vacio">{vacio}</p>}
      <div className="hz-celda-lienzo">
        <MatrizHorizontes datos={datos} vista={vista} escalaTexto={escalaTexto} letraMin={letraMin} llenar={llenar} animarComparacion={false} />
      </div>
    </section>
  )
}

/** Vista "todas las mesas": una matriz por mesa para comparar equipos. Solo con token de tablero. */
export function CuadriculaMesas({
  sala,
  token,
  datos,
  vista,
  escalaTexto,
  letraMin = 0,
}: {
  sala: string
  token: string | null
  datos: DatosTablero
  vista: Vista
  escalaTexto: number
  /** Proyector: letra mínima de cada matriz (con muchas mesas la limita el tamaño de la celda). */
  letraMin?: number
}) {
  const mesas = (datos.progreso?.por_mesa ?? []).filter((m) => m.inscritos > 0)
  if (!mesas.length) {
    return (
      <p className="hz-vacio" role="status">
        Aún no hay mesas con inscritos en esta sala
      </p>
    )
  }
  // Proyector: las mesas llenan la pantalla (hasta 3 columnas con 2 o 3 mesas; 2 filas con hasta 8).
  const n = mesas.length
  const columnas = n <= 3 ? n : Math.min(4, Math.ceil(n / 2))
  const filas = Math.ceil(n / columnas)
  const proyector = escalaTexto > 1
  return (
    <div className="hz-cuadricula" style={{ '--hz-cols': columnas, '--hz-filas': filas } as React.CSSProperties}>
      {mesas.map((m) => (
        <CeldaMesa key={m.mesa_id} sala={sala} token={token} mesa={m} vista={vista} escalaTexto={escalaTexto} letraMin={letraMin} llenar={proyector} />
      ))}
    </div>
  )
}
