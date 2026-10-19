import type { DatosTablero, ProyectoVivo, RondaVivo, Vista } from './tipos'
import { ColRonda } from './TablaComparada'
import { cifraRonda, delta, mostrarR2, nombreCorto, rondaDe } from './logica'

/** Móvil y tableta: un panel por proyecto con R1, R2 y el cambio, por criterio y en la fila «Total». */
export function PanelProyecto({ proyecto, datos, vista }: { proyecto: ProyectoVivo; datos: DatosTablero; vista: Vista }) {
  const r1 = rondaDe(proyecto, 1)
  const r2 = rondaDe(proyecto, 2)
  const conR2 = mostrarR2(datos)
  const idTitulo = `hz-panel-${proyecto.id}`
  const fila = (clave: string, etiqueta: string, titulo: string | undefined, valor: (r: RondaVivo | null) => number | null | undefined) => (
    <tr key={clave}>
      <th scope="row" title={titulo}>
        {etiqueta}
      </th>
      <td className={vista === 1 || vista === 'comparacion' ? 'hz-foco' : undefined}>{cifraRonda(r1, valor(r1))}</td>
      {conR2 && (
        <>
          <td className={vista === 2 || vista === 'comparacion' ? 'hz-foco' : undefined}>{cifraRonda(r2, valor(r2))}</td>
          <td className="hz-delta">{delta(valor(r1), valor(r2)) ?? ''}</td>
        </>
      )}
    </tr>
  )

  return (
    <section className="hz-panel" aria-labelledby={idTitulo}>
      <header className="hz-panel-cab">
        <h2 id={idTitulo}>{proyecto.nombre}</h2>
        <span className="hz-panel-meta">
          {proyecto.sector ? `${proyecto.sector} · ` : ''}TAM {proyecto.tam}
        </span>
      </header>
      <table className="hz-tabla">
        <caption className="hz-oculto">
          Promedios por criterio de {proyecto.nombre} {conR2 ? 'en la ronda 1 y la ronda 2' : 'en la ronda 1'}, y total
        </caption>
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            <ColRonda n={1} />
            {conR2 && (
              <>
                <ColRonda n={2} />
                <th scope="col">
                  <span aria-hidden="true">Δ</span>
                  <span className="hz-oculto">Cambio de R1 a R2</span>
                </th>
              </>
            )}
          </tr>
        </thead>
        <tbody>{datos.criterios.map((c) => fila(c.id, nombreCorto(c.id, c.nombre), c.nombre, (r) => r?.promedios?.[c.id]))}</tbody>
        <tbody className="hz-resumen">{fila('total', 'Total', 'Eje X más eje Y', (r) => r?.total)}</tbody>
      </table>
    </section>
  )
}
