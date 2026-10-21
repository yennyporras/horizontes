import type { DatosTablero, ProyectoVivo, RondaVivo, Vista } from './tipos'
import { ColRonda, NombreCriterio, tituloCriterio } from './TablaComparada'
import { cifraRonda, claseCifra, conResultado, delta, minimoDe, mostrarR2, rondaDe } from './logica'
import { mensajeFaltanVotos } from '../shared/votos'

/** Móvil y tableta: un panel por proyecto con R1, R2 y el cambio por criterio (sin fila «Total», preentrega del 19-oct). */
export function PanelProyecto({ proyecto, datos, vista }: { proyecto: ProyectoVivo; datos: DatosTablero; vista: Vista }) {
  const r1 = rondaDe(proyecto, 1)
  const r2 = rondaDe(proyecto, 2)
  const conR2 = mostrarR2(datos)
  const idTitulo = `hz-panel-${proyecto.id}`
  const fila = (c: { id: string; nombre: string }, valor: (r: RondaVivo | null) => number | null | undefined) => (
    <tr key={c.id}>
      <th scope="row" title={tituloCriterio(c.id, c.nombre)}>
        <NombreCriterio id={c.id} nombre={c.nombre} mayorCambio={vista === 'comparacion' && proyecto.convergencia?.criterio_mayor_cambio === c.id ? [proyecto.nombre] : []} />
      </th>
      <td className={claseCifra(r1, valor(r1), vista === 1 || vista === 'comparacion')}>{cifraRonda(r1, valor(r1))}</td>
      {conR2 && (
        <>
          <td className={claseCifra(r2, valor(r2), vista === 2 || vista === 'comparacion')}>{cifraRonda(r2, valor(r2))}</td>
          <td className="hz-delta">{delta(valor(r1), valor(r2)) ?? ''}</td>
        </>
      )}
    </tr>
  )

  // Bajo el mínimo (21-oct): un solo mensaje con el conteo real; sin ninguna ronda con resultado, en lugar de la tabla.
  const bajo = [r1, conR2 ? r2 : null].filter((r): r is RondaVivo => !!r?.bajo_minimo)
  const avisos = bajo.map((r) => `${conR2 ? `Ronda ${r.ronda}: ` : ''}${mensajeFaltanVotos(r.n_votos ?? 0, minimoDe(datos))}`)
  const conAlguna = conResultado(r1) || (conR2 && conResultado(r2))
  const notas = avisos.map((a) => (
    <p key={a} className="hz-tabla-aviso">
      {a}
    </p>
  ))
  return (
    <section className="hz-panel" aria-labelledby={idTitulo}>
      <header className="hz-panel-cab">
        <h2 id={idTitulo}>{proyecto.nombre}</h2>
        <span className="hz-panel-meta">
          {proyecto.sector ? `${proyecto.sector} · ` : ''}TAM {proyecto.tam} de 10
        </span>
      </header>
      {!conAlguna ? (
        notas.length ? notas : <p className="hz-tabla-aviso">Aún no hay votos.</p>
      ) : (
        <table className="hz-tabla">
          <caption className="hz-oculto">
            Promedios por criterio de {proyecto.nombre} {conR2 ? 'en la ronda 1 y la ronda 2' : 'en la ronda 1'}
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
          <tbody>{datos.criterios.map((c) => fila(c, (r) => r?.promedios?.[c.id]))}</tbody>
        </table>
      )}
      {conAlguna && notas}
    </section>
  )
}
