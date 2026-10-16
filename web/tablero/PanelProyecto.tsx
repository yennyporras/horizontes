import { COLORES } from './matriz/matriz.js'
import type { CriterioId, DatosTablero, ProyectoVivo, RondaVivo, ValorEscala, Vista } from './tipos'
import { delta, nombreCorto, numero, rondaDe, rondaEnFoco } from './logica'

const ESCALA: ValorEscala[] = ['1', '3', '5', '7', '9']

export function MiniDistribucion({ dist, criterio, ronda }: { dist: Partial<Record<ValorEscala, number>> | undefined; criterio: string; ronda: number }) {
  const valores = ESCALA.map((k) => dist?.[k] ?? 0)
  const max = Math.max(1, ...valores)
  const total = valores.reduce((a, b) => a + b, 0)
  const texto = total
    ? `Ronda ${ronda}, ${criterio}: ` + ESCALA.map((k, i) => `${valores[i]} votos en ${k}`).join(', ')
    : `Ronda ${ronda}, ${criterio}: sin votos`
  return (
    <div className="hz-dist" role="img" aria-label={texto} title={texto}>
      {ESCALA.map((k, i) => (
        <div key={k} className="hz-dist-col">
          <div className="hz-dist-pista">
            <div className="hz-dist-barra" style={{ height: `${(valores[i] / max) * 100}%` }} />
          </div>
          <span className="hz-dist-k" aria-hidden="true">
            {k}
          </span>
        </div>
      ))}
    </div>
  )
}

function Fila({ etiqueta, titulo, r1, r2, foco, extra }: { etiqueta: string; titulo?: string; r1?: number | null; r2?: number | null; foco: Vista; extra?: React.ReactNode }) {
  const d = delta(r1, r2)
  return (
    <tr>
      <th scope="row" title={titulo}>
        {etiqueta}
      </th>
      <td className={foco === 1 || foco === 'comparacion' ? 'hz-foco' : undefined}>{numero(r1)}</td>
      <td className={foco === 2 || foco === 'comparacion' ? 'hz-foco' : undefined}>{numero(r2)}</td>
      <td className="hz-delta">{d ?? ''}</td>
      {extra !== undefined && <td className="hz-celda-dist">{extra}</td>}
    </tr>
  )
}

export function PanelProyecto({ proyecto, indice, datos, vista }: { proyecto: ProyectoVivo; indice: number; datos: DatosTablero; vista: Vista }) {
  const r1 = rondaDe(proyecto, 1)
  const r2 = rondaDe(proyecto, 2)
  const enFoco = rondaEnFoco(datos, vista)
  const rf: RondaVivo | null = enFoco === 1 ? r1 : r2
  const color = COLORES.vivos[indice % COLORES.vivos.length]
  const colorTexto = COLORES.vivosTexto[indice % COLORES.vivosTexto.length]
  const prom = (r: RondaVivo | null, c: CriterioId) => r?.promedios?.[c] ?? null
  const idTitulo = `hz-panel-${proyecto.id}`

  return (
    <section className="hz-panel" aria-labelledby={idTitulo}>
      <header className="hz-panel-cab">
        <span className="hz-punto" style={{ background: color }} aria-hidden="true" />
        <h2 id={idTitulo} style={{ color: colorTexto }}>
          {proyecto.nombre}
        </h2>
        <span className="hz-panel-meta">
          {proyecto.sector ? `${proyecto.sector} · ` : ''}TAM {proyecto.tam}
        </span>
      </header>
      <table className="hz-tabla">
        <caption className="hz-oculto">
          Promedios por criterio de {proyecto.nombre} en la ronda 1 y la ronda 2, con la distribución de la ronda {enFoco}
        </caption>
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            <th scope="col">R1</th>
            <th scope="col">R2</th>
            <th scope="col">
              <span aria-hidden="true">Δ</span>
              <span className="hz-oculto">Cambio de R1 a R2</span>
            </th>
            <th scope="col">Votos R{enFoco}</th>
          </tr>
        </thead>
        <tbody>
          {datos.criterios.map((c) => (
            <Fila
              key={c.id}
              etiqueta={nombreCorto(c.id, c.nombre)}
              titulo={c.nombre}
              r1={prom(r1, c.id)}
              r2={prom(r2, c.id)}
              foco={vista}
              extra={<MiniDistribucion dist={rf?.distribucion?.[c.id]} criterio={c.nombre} ronda={enFoco} />}
            />
          ))}
        </tbody>
        <tbody className="hz-resumen">
          <Fila etiqueta="T2M" titulo="Time to market" r1={r1?.t2m} r2={r2?.t2m} foco={vista} extra={null} />
          <Fila etiqueta="Eje X" titulo={datos.ejes?.x?.titulo} r1={r1?.eje_x} r2={r2?.eje_x} foco={vista} extra={null} />
          <Fila etiqueta="Eje Y" titulo={datos.ejes?.y?.titulo} r1={r1?.eje_y} r2={r2?.eje_y} foco={vista} extra={null} />
          <tr className="hz-votos">
            <th scope="row">Votos</th>
            <td>{r1?.n_votos ?? 0}</td>
            <td>{r2?.n_votos ?? 0}</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </section>
  )
}
