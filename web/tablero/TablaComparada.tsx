import type { CriterioId, DatosTablero, RondaVivo, Vista } from './tipos'
import { cifraRonda, mostrarR2, nombreCorto, rondaDe } from './logica'

/** Encabezado de columna de una ronda: «R1» verde con aro hueco, «R2» rojo con punto sólido (se lee sin color). */
export function ColRonda({ n }: { n: 1 | 2 }) {
  return (
    <th scope="col" className={`hz-col-r${n}`}>
      <i className={`hz-marca-r${n}`} aria-hidden="true" />
      R{n}
    </th>
  )
}

/**
 * Proyector: los proyectos vivos lado a lado en una sola tabla para que todo quepa en 1080 px de alto.
 * Por proyecto: promedio R1 y R2 de cada criterio y la fila «Total» (eje X + eje Y, del servidor).
 */
export function TablaComparada({ datos, vista }: { datos: DatosTablero; vista: Vista }) {
  const conR2 = mostrarR2(datos)
  const vivos = datos.proyectos_vivos.map((p) => ({ p, r1: rondaDe(p, 1), r2: rondaDe(p, 2) }))
  const foco = (n: 1 | 2) => vista === n || vista === 'comparacion'
  const fila = (clave: string, etiqueta: string, titulo: string | undefined, valor: (r: RondaVivo | null) => number | null | undefined) => (
    <tr key={clave}>
      <th scope="row" title={titulo}>
        {etiqueta}
      </th>
      {vivos.map(({ p, r1, r2 }) => [
        <td key={`${p.id}1`} className={foco(1) ? 'hz-ini hz-foco' : 'hz-ini'}>
          {cifraRonda(r1, valor(r1))}
        </td>,
        conR2 && (
          <td key={`${p.id}2`} className={foco(2) ? 'hz-foco' : undefined}>
            {cifraRonda(r2, valor(r2))}
          </td>
        ),
      ])}
    </tr>
  )
  const prom = (c: CriterioId) => (r: RondaVivo | null) => r?.promedios?.[c]

  return (
    <section className="hz-comparada" aria-labelledby="hz-comparada-t">
      <h2 id="hz-comparada-t" className="hz-sub">
        Promedios por criterio
      </h2>
      <table className="hz-tabla">
        <caption className="hz-oculto">Promedio {conR2 ? 'de la ronda 1 y la ronda 2' : 'de la ronda 1'} por criterio y proyecto, y total</caption>
        <thead>
          <tr>
            <td />
            {vivos.map(({ p }) => (
              <th key={p.id} scope="colgroup" colSpan={conR2 ? 2 : 1} className="hz-col-proy">
                {p.nombre}
                <span className="hz-panel-meta"> TAM {p.tam}</span>
              </th>
            ))}
          </tr>
          <tr>
            <th scope="col">Criterio</th>
            {vivos.map(({ p }) => [<ColRonda key={`${p.id}1`} n={1} />, conR2 && <ColRonda key={`${p.id}2`} n={2} />])}
          </tr>
        </thead>
        <tbody>{datos.criterios.map((c) => fila(c.id, nombreCorto(c.id, c.nombre), c.nombre, prom(c.id)))}</tbody>
        <tbody className="hz-resumen">{fila('total', 'Total', 'Eje X más eje Y', (r) => r?.total)}</tbody>
      </table>
    </section>
  )
}
