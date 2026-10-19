import { useEffect, useState } from 'react'
import { Insignia } from '../../shared/ui'
import { MatrizHorizontes, type DatosTablero, type Vista } from '../../tablero'
import type { Criterio, Resultados, RondaVivo, Voto } from '../api'
import { cifra } from '../Comun'

export const textoAlcance = (r: Resultados | null, alcance: 'mesa' | 'sala') => ((r?.alcance?.tipo ?? alcance) === 'sala' ? 'la sala' : 'tu mesa')

/**
 * SPEC §7 y acta A1: ningún resultado muestra respuestas individuales. Con 1 voto el promedio ES esa respuesta;
 * con 2, quien votó despeja la del otro (otro = 2 · promedio − propia). Por eso 3 (R4_CONTRATO C3).
 * Manda `minimo_votos` del servidor; ocultar no es recalcular.
 */
export const MIN_VOTOS = 3
const minimoDe = (r: Resultados) => r.minimo_votos ?? MIN_VOTOS
const conVotos = (x: RondaVivo | undefined, min: number) => Boolean(x && !x.bajo_minimo && x.n_votos >= min && x.promedios)
const pocosVotos = (x: RondaVivo | undefined, min: number) => Boolean(x && x.n_votos > 0 && !conVotos(x, min))

/** Copia para la matriz sin las rondas bajo el mínimo de votos (sin punto). */
function sinIndividuales(r: Resultados, min: number): Resultados {
  return {
    ...r,
    proyectos_vivos: (r.proyectos_vivos ?? []).map((p) => ({
      ...p,
      rondas: p.rondas.map((x) => (conVotos(x, min) ? x : { ...x, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null })),
    })),
  }
}

/** Ronda 1: solo R1. Con votos en las 2 rondas: comparación (R1 hueco, R2 sólido y flecha). */
export function vistaMatriz(r: Resultados): Vista {
  const vivos = r.proyectos_vivos ?? []
  const con = (n: number) => vivos.some((p) => conVotos(p.rondas.find((x) => x.ronda === n), minimoDe(r)))
  if (con(2)) return con(1) ? 'comparacion' : 2
  return 1
}

/** En escritorio la matriz crece (triage #25) y sus etiquetas también. */
const ESCRITORIO = '(min-width: 64rem)'
function usarEscalaTexto(): number {
  const consulta = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(ESCRITORIO).matches
  const [ancho, setAncho] = useState(consulta)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const m = window.matchMedia(ESCRITORIO)
    const cambio = () => setAncho(m.matches)
    m.addEventListener?.('change', cambio)
    return () => m.removeEventListener?.('change', cambio)
  }, [])
  return ancho ? 1.5 : 1
}

/**
 * Resultado del alcance (mesa o sala): matriz de T3 (solo props) y promedio por criterio.
 * Solo muestra lo que calcula el servidor; el celular nunca recalcula.
 * C19-3 (P3): con `misVotos` (los de `/api/yo`, solo de esta persona) cada promedio lleva debajo «Tu calificación».
 */
export function ResultadoAlcance({
  resultados,
  criterios,
  alcance,
  preliminar,
  misVotos = [],
}: {
  resultados: Resultados
  criterios: Criterio[]
  alcance: 'mesa' | 'sala'
  preliminar?: boolean
  /** Votos propios (`mis_votos`). Nunca los de otra persona. */
  misVotos?: Voto[]
}) {
  const escalaTexto = usarEscalaTexto()
  const donde = textoAlcance(resultados, alcance)
  const min = minimoDe(resultados)
  const vivos = resultados.proyectos_vivos ?? []
  const hayVotos = vivos.some((p) => p.rondas.some((x) => conVotos(x, min)))
  const hayPocos = vivos.some((p) => p.rondas.some((x) => pocosVotos(x, min)))
  const marcarPreliminar = preliminar ?? resultados.preliminar

  if (!hayVotos) {
    return (
      <p className="hz-texto-2">
        {hayPocos
          ? `Hace falta al menos ${min} votos para mostrar estos resultados. Así nadie ve las respuestas de otra persona.`
          : `Todavía no hay votos en ${donde}. Los resultados aparecen con los primeros ${min}.`}
      </p>
    )
  }
  const datosMatriz = sinIndividuales(resultados, min)

  return (
    <section className="hzp-resultado" aria-label={`Resultado de ${donde}`}>
      {marcarPreliminar && (
        <p>
          <Insignia tono="alerta">Preliminar</Insignia>
        </p>
      )}
      <div className="hzp-matriz">
        <MatrizHorizontes datos={datosMatriz as unknown as DatosTablero} vista={vistaMatriz(datosMatriz)} escalaTexto={escalaTexto} />
      </div>
      {vivos.map((p) => {
        const rondas = [1, 2].map((n) => p.rondas.find((x) => x.ronda === n))
        const visibles = rondas.filter((x): x is RondaVivo => conVotos(x, min))
        const ocultas = rondas.filter((x): x is RondaVivo => pocosVotos(x, min))
        if (visibles.length === 0) {
          return (
            <article key={p.id} className="hzp-resultado__proyecto">
              <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
              <p className="hz-texto-3">{ocultas.length ? `Hace falta al menos ${min} votos para mostrar este proyecto.` : 'Sin votos todavía.'}</p>
            </article>
          )
        }
        const mia = (ronda: number, criterio: string) => misVotos.find((v) => v.proyecto_id === p.id && v.ronda === ronda)?.respuestas[criterio]
        const conMias = visibles.some((r) => criterios.some((c) => mia(r.ronda, c.id) !== undefined))
        return (
          <article key={p.id} className="hzp-resultado__proyecto">
            <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
            {conMias && <p className="hzp-resultado__pie">Debajo de cada promedio va tu calificación (Tú). Solo la ves en tu celular.</p>}
            {/* Acta A3 y A4: solo los 6 criterios y el Total (eje X + eje Y) que entrega el servidor. */}
            <table className="hzp-tabla">
              <caption className="hz-visual-oculto">Promedio por criterio y total de {p.nombre}</caption>
              <thead>
                <tr>
                  <th scope="col">Promedio por criterio</th>
                  {visibles.map((r) => (
                    <th key={r.ronda} scope="col">
                      <Insignia tono={r.ronda === 1 ? 'r1' : 'r2'}>R{r.ronda}</Insignia>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {criterios.map((c) => (
                  <tr key={c.id}>
                    <th scope="row">{c.nombre}</th>
                    {visibles.map((r) => {
                      const tuya = mia(r.ronda, c.id)
                      return (
                        <td key={r.ronda} className="hz-cifra">
                          <span className="hzp-tabla__promedio">{cifra(r.promedios?.[c.id])}</span>
                          {tuya !== undefined && (
                            <span className="hzp-tabla__mia">
                              <span className="hz-visual-oculto">Tu calificación: </span>
                              <span aria-hidden="true">Tú </span>
                              {tuya}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
              <tbody className="hzp-tabla__total">
                <tr>
                  <th scope="row">Total</th>
                  {visibles.map((r) => (
                    <td key={r.ronda} className="hz-cifra">
                      {cifra(r.total)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            {ocultas.length > 0 && (
              <p className="hzp-resultado__pie">
                {ocultas.map((r) => `Ronda ${r.ronda}: hace falta al menos ${min} votos para mostrarla.`).join(' ')}
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}
