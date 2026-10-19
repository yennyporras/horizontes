import type { ReactNode } from 'react'
import type { Distribucion } from '../shared/api/contrato'
import { MINIMO_VOTOS, nombreCorto } from './logica'
import './como-voto.css'

const ESCALA = ['1', '3', '5', '7', '9'] as const

/** Lo que el bloque lee de GET /api/tablero (también lo usa el panel, con sus tipos locales). */
export interface DatosComoVoto {
  alcance: { tipo: 'sala' | 'mesa' }
  criterios: { id: string; nombre: string }[]
  proyectos_vivos: {
    id: string
    nombre: string
    rondas: { ronda: number; n_votos: number; distribucion?: Record<string, Distribucion> | null; bajo_minimo?: boolean }[]
  }[]
  minimo_votos?: number
}
type RondaDatos = DatosComoVoto['proyectos_vivos'][number]['rondas'][number]

const votos = (n: number) => (n === 1 ? '1 voto' : `${n} votos`)

/**
 * «Cómo votó la sala» (o la mesa): conteo de 1, 3, 5, 7 y 9 por criterio, R1 y R2, con la `distribucion`
 * del servidor. Para la plenaria: dónde hubo consenso y dónde la mesa se partió. Solo dibuja los conteos;
 * el alto de cada barra es su parte de los votos de esa ronda. Bajo el mínimo el servidor no la manda.
 */
export function ComoVoto({ datos, rondas, controles }: { datos: DatosComoVoto; rondas: (1 | 2)[]; controles?: ReactNode }) {
  const deRonda = (p: DatosComoVoto['proyectos_vivos'][number], n: number) => p.rondas.find((r) => r.ronda === n)
  const conDatos = rondas.filter((n) => datos.proyectos_vivos.some((p) => deRonda(p, n)?.distribucion))
  const quien = datos.alcance.tipo === 'mesa' ? 'la mesa' : 'la sala'
  const minimo = datos.minimo_votos ?? MINIMO_VOTOS
  // Una línea por ronda pedida que no trae distribución: bajo el mínimo (anonimato) o sin votos todavía.
  const avisos = rondas
    .filter((n) => !conDatos.includes(n))
    .map((n) =>
      datos.proyectos_vivos.some((p) => deRonda(p, n)?.bajo_minimo)
        ? `Hace falta al menos ${minimo} votos para mostrar ${datos.alcance.tipo === 'mesa' ? 'esta mesa' : 'estos resultados'} en la ronda ${n}.`
        : `Aún no hay votos en la ronda ${n}.`,
    )

  return (
    <section className="hz-cv" aria-labelledby="hz-cv-t">
      <div className="hz-cv-cab">
        <h2 id="hz-cv-t" className="hz-cv-titulo">
          Cómo votó {quien}
        </h2>
        {controles}
      </div>
      {avisos.map((a) => (
        <p key={a} className="hz-cv-aviso" role="status">
          {a}
        </p>
      ))}
      {conDatos.length > 0 && (
        <div className="hz-cv-proyectos">
          {datos.proyectos_vivos.map((p) => (
            <section key={p.id} className="hz-cv-proy" aria-labelledby={`hz-cv-${p.id}`}>
              <h3 id={`hz-cv-${p.id}`} className="hz-cv-nombre">
                {p.nombre}
              </h3>
              <div className="hz-cv-rejilla" style={{ gridTemplateColumns: `repeat(${conDatos.length}, minmax(0, 1fr))` }}>
                {conDatos.map((n) => (
                  <CabRonda key={n} n={n} r={deRonda(p, n)} />
                ))}
                {datos.criterios.map((c) => [
                  <p key={c.id} className="hz-cv-crit" style={{ gridColumn: `1 / span ${conDatos.length}` }}>
                    {nombreCorto(c.id, c.nombre)}
                  </p>,
                  ...conDatos.map((n) => <Barras key={`${c.id}${n}`} proyecto={p.nombre} criterio={nombreCorto(c.id, c.nombre)} n={n} r={deRonda(p, n)} criterioId={c.id} />),
                ])}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  )
}

/** «R1 · 12 votos» y la escala 1 3 5 7 9 alineada con las barras. */
function CabRonda({ n, r }: { n: 1 | 2; r: RondaDatos | undefined }) {
  return (
    <div className="hz-cv-ronda">
      <p className={`hz-cv-ronda-t hz-cv-r${n}`}>
        <i className={`hz-cv-marca hz-cv-marca-r${n}`} aria-hidden="true" />R{n}
        <span className="hz-cv-n"> · {votos(r?.n_votos ?? 0)}</span>
      </p>
      <p className="hz-cv-escala" aria-hidden="true">
        {ESCALA.map((k) => (
          <span key={k}>{k}</span>
        ))}
      </p>
    </div>
  )
}

/** Cinco barras con su conteo en texto; el lector de pantalla recibe la frase completa. */
function Barras({ proyecto, criterio, criterioId, n, r }: { proyecto: string; criterio: string; criterioId: string; n: 1 | 2; r: RondaDatos | undefined }) {
  const dist = r?.distribucion?.[criterioId]
  if (!dist) return <p className="hz-cv-falta">{r?.bajo_minimo ? 'Faltan votos' : 'Sin votos'}</p>
  const total = Math.max(1, r?.n_votos ?? 0)
  const texto = `${proyecto}, ${criterio}, ronda ${n}: ` + ESCALA.map((k) => `${votos(dist[k] ?? 0)} en ${k}`).join(', ')
  return (
    <div className={`hz-cv-barras hz-cv-barras-r${n}`} role="img" aria-label={texto}>
      {ESCALA.map((k) => {
        const c = dist[k] ?? 0
        return (
          <div key={k} className="hz-cv-col" aria-hidden="true">
            <span className={c ? 'hz-cv-cuenta' : 'hz-cv-cuenta hz-cv-cero'}>{c}</span>
            <span className="hz-cv-pista">{c > 0 && <span className="hz-cv-barra" style={{ height: `${(100 * c) / total}%` }} />}</span>
          </div>
        )
      })}
    </div>
  )
}
