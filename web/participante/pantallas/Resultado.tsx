import { Insignia } from '../../shared/ui'
import type { Criterio, Resultados, RondaVivo } from '../api'
import { cifra } from '../Comun'

export const textoAlcance = (r: Resultados | null, alcance: 'mesa' | 'sala') => ((r?.alcance?.tipo ?? alcance) === 'sala' ? 'la sala' : 'tu mesa')

const conVotos = (r: RondaVivo | undefined): r is RondaVivo => Boolean(r && r.n_votos > 0 && r.promedios)

/**
 * Resultado del alcance (mesa o sala). Provisional: promedios por criterio y posición en la matriz
 * mientras llega el componente de matriz de T3 (web/tablero/). Solo muestra lo que calcula el servidor.
 */
export function ResultadoAlcance({
  resultados,
  criterios,
  alcance,
  preliminar,
}: {
  resultados: Resultados
  criterios: Criterio[]
  alcance: 'mesa' | 'sala'
  preliminar?: boolean
}) {
  const donde = textoAlcance(resultados, alcance)
  const vivos = resultados.proyectos_vivos ?? []
  const hayVotos = vivos.some((p) => p.rondas.some(conVotos))
  const marcarPreliminar = preliminar ?? resultados.preliminar
  const ejeX = resultados.ejes?.x.titulo ?? 'Time 2 market'
  const ejeY = resultados.ejes?.y.titulo ?? 'Value generation capacity'

  if (!hayVotos) {
    return <p className="hz-texto-2">Todavía no hay calificaciones en {donde}. Los puntos aparecen con el primer voto.</p>
  }

  return (
    <section className="hzp-resultado" aria-label={`Resultado de ${donde}`}>
      {marcarPreliminar && (
        <p>
          <Insignia tono="alerta">Preliminar</Insignia>
        </p>
      )}
      {vivos.map((p) => {
        const r1 = p.rondas.find((r) => r.ronda === 1)
        const r2 = p.rondas.find((r) => r.ronda === 2)
        const rondas = [r1, r2].filter(conVotos)
        if (rondas.length === 0) {
          return (
            <article key={p.id} className="hzp-resultado__proyecto">
              <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
              <p className="hz-texto-3">Sin calificaciones todavía.</p>
            </article>
          )
        }
        const dos = rondas.length === 2
        return (
          <article key={p.id} className="hzp-resultado__proyecto">
            <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
            <dl className="hzp-posicion">
              {rondas.map((r) => (
                <div key={r.ronda} className="hzp-posicion__fila">
                  <dt>Ronda {r.ronda}</dt>
                  <dd className="hz-cifra">
                    {ejeX} {cifra(r.eje_x, 2)} · {ejeY} {cifra(r.eje_y, 2)}
                  </dd>
                </div>
              ))}
            </dl>
            <table className="hzp-tabla">
              <caption className="hz-visual-oculto">Promedio por criterio de {p.nombre}</caption>
              <thead>
                <tr>
                  <th scope="col">Criterio</th>
                  {rondas.map((r) => (
                    <th key={r.ronda} scope="col" className="hz-cifra">
                      {dos ? `R${r.ronda}` : 'Promedio'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criterios.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.nombre}</th>
                    {rondas.map((r) => (
                      <td key={r.ronda} className="hz-cifra">
                        {cifra(r.promedios?.[c.id])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="hz-texto-3 hz-cifra">
              {rondas.map((r) => `${r.n_votos} ${r.n_votos === 1 ? 'calificación' : 'calificaciones'} en la ronda ${r.ronda}`).join(' · ')}
            </p>
          </article>
        )
      })}
    </section>
  )
}
