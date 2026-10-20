import { conSigno, movimientoEje, nombreCorto, titularConvergencia } from './logica'
import type { DatosTablero } from './tipos'

/**
 * «Qué se movió» (QA por roles: jurado, inversionista y Sebastián): en Comparación, cuánto redujo la discusión la
 * dispersión del alcance y, por proyecto, cuánto se movió en cada eje y en qué criterio cambió más. Todo lo calcula
 * el servidor (`convergencia` y `convergencia_alcance`); aquí solo se pone en palabras.
 */
export function QueSeMovio({ datos }: { datos: DatosTablero }) {
  const vivos = datos.proyectos_vivos.filter((v) => v.convergencia)
  if (!vivos.length) return null
  const nombreCriterio = (id: string) => nombreCorto(id, datos.criterios.find((c) => c.id === id)?.nombre ?? id)
  const pct = datos.convergencia_alcance?.reduccion_pct
  return (
    <section className="hz-movio" aria-labelledby="hz-movio-t">
      <h2 id="hz-movio-t" className="hz-sub">
        Qué se movió de R1 a R2
      </h2>
      {typeof pct === 'number' && <p className="hz-movio-titular">{titularConvergencia(pct)}</p>}
      <ul className="hz-movio-lista">
        {vivos.map((v) => {
          const c = v.convergencia!
          return (
            <li key={v.id}>
              <h3 className="hz-movio-nombre">{v.nombre}</h3>
              <p>
                <span className="hz-movio-cifra">Eje X {conSigno(c.delta_x)}:</span> {movimientoEje('x', c.delta_x)}
              </p>
              <p>
                <span className="hz-movio-cifra">Eje Y {conSigno(c.delta_y)}:</span> {movimientoEje('y', c.delta_y)}
              </p>
              <p>
                <span className="hz-movio-cifra">Mayor cambio:</span> {nombreCriterio(c.criterio_mayor_cambio)}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
