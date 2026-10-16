import { MatrizHorizontes } from './MatrizHorizontes'
import { usePollingTablero } from './usePollingTablero'
import { esPreliminar, mensajeVacio, rondaAbierta, urlApiTablero } from './logica'
import type { DatosTablero, ProgresoMesa, Vista } from './tipos'

// Con muchas mesas cada una hace su propio polling: más lento que el tablero principal para no cargar el servidor.
const INTERVALO_MESAS_MS = 5000

function CeldaMesa({ sala, token, mesa, vista, escalaTexto }: { sala: string; token: string | null; mesa: ProgresoMesa; vista: Vista; escalaTexto: number }) {
  const { datos, error } = usePollingTablero(urlApiTablero(sala, { mesa: mesa.mesa_id, t: token }), INTERVALO_MESAS_MS)
  const vacio = datos ? mensajeVacio(datos, vista) : null
  const idTitulo = `hz-celda-${mesa.mesa_id}`
  const lista = mesa.precierre && rondaAbierta(datos?.sala?.estado)
  return (
    <section className="hz-celda-mesa" aria-labelledby={idTitulo}>
      <header className="hz-celda-cab">
        <h2 id={idTitulo}>{mesa.nombre}</h2>
        <span className={lista ? 'hz-mesa-n hz-ok-texto' : 'hz-mesa-n'}>
          {mesa.completos} de {mesa.inscritos}
          {lista ? ', todos votaron' : ''}
        </span>
        {datos && esPreliminar(datos) && <span className="hz-insignia hz-insignia-alerta">Preliminar</span>}
      </header>
      {error && !datos && (
        <p className="hz-aviso-error" role="alert">
          {error.mensaje}
        </p>
      )}
      {vacio && <p className="hz-vacio">{vacio}</p>}
      <MatrizHorizontes datos={datos} vista={vista} escalaTexto={escalaTexto} animarComparacion={false} />
    </section>
  )
}

/** Vista "todas las mesas": una matriz por mesa para comparar equipos. Solo con token de tablero. */
export function CuadriculaMesas({ sala, token, datos, vista, escalaTexto }: { sala: string; token: string | null; datos: DatosTablero; vista: Vista; escalaTexto: number }) {
  const mesas = (datos.progreso?.por_mesa ?? []).filter((m) => m.inscritos > 0)
  if (!mesas.length) {
    return (
      <p className="hz-vacio" role="status">
        Aún no hay mesas con inscritos en esta sala
      </p>
    )
  }
  return (
    <div className="hz-cuadricula">
      {mesas.map((m) => (
        <CeldaMesa key={m.mesa_id} sala={sala} token={token} mesa={m} vista={vista} escalaTexto={escalaTexto} />
      ))}
    </div>
  )
}
