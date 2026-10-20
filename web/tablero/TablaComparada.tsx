import type { CriterioId, DatosTablero, RondaVivo, Vista } from './tipos'
import { cifraRonda, claseCifra, mayorCambioEn, mostrarR2, nombreCorto, rondaDe, titularConvergencia } from './logica'
import { descripcionCriterio } from '../shared/criterios'

/**
 * Nombre del criterio y, debajo, su descripción corta (pedido de Paola, 20-oct; máximo 100 caracteres). Con poco alto
 * (proyector de 1280×720 u 800) la descripción se oculta (CSS) y queda en el title de la fila. En Comparación, la marca
 * «Mayor cambio» dice en qué proyectos este fue el criterio que más se movió de R1 a R2 (lo calcula el servidor).
 */
export function NombreCriterio({ id, nombre, mayorCambio = [], variosProyectos = false }: { id: string; nombre: string; mayorCambio?: string[]; variosProyectos?: boolean }) {
  const desc = descripcionCriterio(id)
  return (
    <>
      <span className="hz-crit-nombre">
        {nombreCorto(id, nombre)}
        {mayorCambio.length > 0 && (
          <span className="hz-mayor-cambio">Mayor cambio{variosProyectos ? `: ${mayorCambio.join(' y ')}` : ''}</span>
        )}
      </span>
      {desc && <span className="hz-crit-desc">{desc}</span>}
    </>
  )
}

/** Title de la fila de un criterio: el nombre completo de la semilla y la descripción con los dos polos. */
export function tituloCriterio(id: string, nombre: string): string {
  const desc = descripcionCriterio(id)
  return desc ? `${nombre}. ${desc}` : nombre
}

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
 * Por proyecto: promedio R1 y R2 de cada criterio. Sin fila «Total»: no dice nada al público (preentrega del 19-oct).
 */
export function TablaComparada({ datos, vista }: { datos: DatosTablero; vista: Vista }) {
  const conR2 = mostrarR2(datos)
  const vivos = datos.proyectos_vivos.map((p) => ({ p, r1: rondaDe(p, 1), r2: rondaDe(p, 2) }))
  const foco = (n: 1 | 2) => vista === n || vista === 'comparacion'
  const comparacion = vista === 'comparacion'
  const fila = (c: { id: CriterioId; nombre: string }, valor: (r: RondaVivo | null) => number | null | undefined) => (
    <tr key={c.id}>
      <th scope="row" title={tituloCriterio(c.id, c.nombre)}>
        <NombreCriterio id={c.id} nombre={c.nombre} mayorCambio={comparacion ? mayorCambioEn(datos, c.id) : []} variosProyectos={vivos.length > 1} />
      </th>
      {vivos.map(({ p, r1, r2 }) => [
        <td key={`${p.id}1`} className={claseCifra(r1, valor(r1), foco(1), 'hz-ini')}>
          {cifraRonda(r1, valor(r1))}
        </td>,
        conR2 && (
          <td key={`${p.id}2`} className={claseCifra(r2, valor(r2), foco(2))}>
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
      {/* Comparación con convergencia: el titular del servidor en una línea sobre la tabla. */}
      {comparacion && typeof datos.convergencia_alcance?.reduccion_pct === 'number' && (
        <p className="hz-movio-linea">{titularConvergencia(datos.convergencia_alcance.reduccion_pct)}</p>
      )}
      <table className="hz-tabla">
        <caption className="hz-oculto">Promedio {conR2 ? 'de la ronda 1 y la ronda 2' : 'de la ronda 1'} por criterio y proyecto</caption>
        <thead>
          <tr>
            <td />
            {vivos.map(({ p }) => (
              <th key={p.id} scope="colgroup" colSpan={conR2 ? 2 : 1} className="hz-col-proy">
                {p.nombre}
                <span className="hz-panel-meta"> TAM {p.tam} de 10</span>
              </th>
            ))}
          </tr>
          <tr>
            <th scope="col">Criterio</th>
            {vivos.map(({ p }) => [<ColRonda key={`${p.id}1`} n={1} />, conR2 && <ColRonda key={`${p.id}2`} n={2} />])}
          </tr>
        </thead>
        <tbody>{datos.criterios.map((c) => fila(c, prom(c.id)))}</tbody>
      </table>
    </section>
  )
}
