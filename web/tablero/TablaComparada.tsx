import { COLORES } from './matriz/matriz.js'
import { MiniDistribucion } from './PanelProyecto'
import type { CriterioId, DatosTablero, RondaVivo, Vista } from './tipos'
import { nombreCorto, numero, rondaDe, rondaEnFoco } from './logica'

/**
 * Proyector: los proyectos vivos lado a lado en una sola tabla para que todo quepa en 1080 px de alto.
 * Por proyecto: promedio R1, promedio R2 y distribución 1-3-5-7-9 de la ronda en foco.
 */
export function TablaComparada({ datos, vista }: { datos: DatosTablero; vista: Vista }) {
  const enFoco = rondaEnFoco(datos, vista)
  const vivos = datos.proyectos_vivos.map((p, i) => ({
    p,
    r1: rondaDe(p, 1),
    r2: rondaDe(p, 2),
    color: COLORES.vivos[i % COLORES.vivos.length],
    colorTexto: COLORES.vivosTexto[i % COLORES.vivosTexto.length],
  }))
  const prom = (r: RondaVivo | null, c: CriterioId) => r?.promedios?.[c] ?? null
  const claseR = (n: 1 | 2) => (vista === n || vista === 'comparacion' ? 'hz-foco' : undefined)

  const filaResumen = (etiqueta: string, titulo: string | undefined, campo: 't2m' | 'eje_x' | 'eje_y') => (
    <tr key={campo}>
      <th scope="row" title={titulo}>
        {etiqueta}
      </th>
      {vivos.map(({ p, r1, r2 }) => [
        <td key={`${p.id}1`} className={claseR(1)}>
          {numero(r1?.[campo])}
        </td>,
        <td key={`${p.id}2`} className={claseR(2)}>
          {numero(r2?.[campo])}
        </td>,
        <td key={`${p.id}d`} />,
      ])}
    </tr>
  )

  return (
    <section className="hz-comparada" aria-labelledby="hz-comparada-t">
      <h2 id="hz-comparada-t" className="hz-sub">
        Promedios por criterio
      </h2>
      <table className="hz-tabla">
        <caption className="hz-oculto">
          Promedio de la ronda 1 y la ronda 2 por criterio y proyecto, con la distribución de votos de la ronda {enFoco}
        </caption>
        <thead>
          <tr>
            <td />
            {vivos.map(({ p, color, colorTexto }) => (
              <th key={p.id} scope="colgroup" colSpan={3} className="hz-col-proy">
                <span className="hz-punto" style={{ background: color }} aria-hidden="true" />
                <span style={{ color: colorTexto }}>{p.nombre}</span>
                <span className="hz-panel-meta"> TAM {p.tam}</span>
              </th>
            ))}
          </tr>
          <tr>
            <th scope="col">Criterio</th>
            {vivos.map(({ p }) => [
              <th key={`${p.id}1`} scope="col">
                R1
              </th>,
              <th key={`${p.id}2`} scope="col">
                R2
              </th>,
              <th key={`${p.id}d`} scope="col">
                Votos R{enFoco}
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {datos.criterios.map((c) => (
            <tr key={c.id}>
              <th scope="row" title={c.nombre}>
                {nombreCorto(c.id, c.nombre)}
              </th>
              {vivos.map(({ p, r1, r2 }) => {
                const rf = enFoco === 1 ? r1 : r2
                return [
                  <td key={`${p.id}1`} className={claseR(1)}>
                    {numero(prom(r1, c.id))}
                  </td>,
                  <td key={`${p.id}2`} className={claseR(2)}>
                    {numero(prom(r2, c.id))}
                  </td>,
                  <td key={`${p.id}d`} className="hz-celda-dist">
                    <MiniDistribucion dist={rf?.distribucion?.[c.id]} criterio={`${p.nombre}, ${c.nombre}`} ronda={enFoco} />
                  </td>,
                ]
              })}
            </tr>
          ))}
        </tbody>
        <tbody className="hz-resumen">
          {filaResumen('T2M', 'Time to market', 't2m')}
          {filaResumen('Eje X', datos.ejes?.x?.titulo, 'eje_x')}
          {filaResumen('Eje Y', datos.ejes?.y?.titulo, 'eje_y')}
          <tr className="hz-votos">
            <th scope="row">Votos</th>
            {vivos.map(({ p, r1, r2 }) => [
              <td key={`${p.id}1`}>{r1?.n_votos ?? 0}</td>,
              <td key={`${p.id}2`}>{r2?.n_votos ?? 0}</td>,
              <td key={`${p.id}d`} />,
            ])}
          </tr>
        </tbody>
      </table>
    </section>
  )
}
