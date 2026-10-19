import { useEffect, useState } from 'react'
import { Insignia } from '../../shared/ui'
import { MatrizHorizontes, type DatosTablero, type Vista } from '../../tablero'
import type { Criterio, Resultados, RondaVivo } from '../api'
import { cifra } from '../Comun'

export const textoAlcance = (r: Resultados | null, alcance: 'mesa' | 'sala') => ((r?.alcance?.tipo ?? alcance) === 'sala' ? 'la sala' : 'tu mesa')

/** "TIME 2 MARKET" → "Eje X (Time 2 Market)": el mismo nombre que usa el tablero (triage #11). */
export const nombreEje = (eje: 'X' | 'Y', titulo: string) =>
  `Eje ${eje} (${titulo.toLowerCase().replace(/(^|\s)\p{L}/gu, (l) => l.toUpperCase())})`

/**
 * SPEC §7: ningún resultado muestra respuestas individuales (triage #1). Con 1 calificación el promedio ES
 * esa respuesta; con 2, quien votó despeja la del otro (otro = 2 · promedio − propia). Por eso 3.
 * Ocultar no es recalcular.
 */
export const MIN_VOTOS = 3
const conVotos = (r: RondaVivo | undefined) => Boolean(r && r.n_votos >= MIN_VOTOS && r.promedios)
const pocosVotos = (r: RondaVivo | undefined) => Boolean(r && r.n_votos > 0 && r.n_votos < MIN_VOTOS)

/** Copia para la matriz sin las rondas de menos de MIN_VOTOS calificaciones (sin punto). */
function sinIndividuales(r: Resultados): Resultados {
  return {
    ...r,
    proyectos_vivos: (r.proyectos_vivos ?? []).map((p) => ({
      ...p,
      rondas: p.rondas.map((x) => (conVotos(x) ? x : { ...x, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })),
    })),
  }
}

/** Ronda 1: solo R1. Con votos en las 2 rondas: comparación (R1 suave, R2 sólido y flecha). */
export function vistaMatriz(r: Resultados): Vista {
  const vivos = r.proyectos_vivos ?? []
  const con = (n: number) => vivos.some((p) => conVotos(p.rondas.find((x) => x.ronda === n)))
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
  const escalaTexto = usarEscalaTexto()
  const donde = textoAlcance(resultados, alcance)
  const vivos = resultados.proyectos_vivos ?? []
  const hayVotos = vivos.some((p) => p.rondas.some(conVotos))
  const hayPocos = vivos.some((p) => p.rondas.some(pocosVotos))
  const marcarPreliminar = preliminar ?? resultados.preliminar
  const ejeX = nombreEje('X', resultados.ejes?.x.titulo ?? 'Time 2 market')
  const ejeY = nombreEje('Y', resultados.ejes?.y.titulo ?? 'Value generation capacity')

  const avisoPocos = `Hacen falta al menos ${MIN_VOTOS} calificaciones en ${donde} para mostrar un resultado. Así nadie ve las respuestas de otra persona.`
  if (!hayVotos) {
    return (
      <p className="hz-texto-2">
        {hayPocos ? avisoPocos : `Todavía no hay calificaciones en ${donde}. Los puntos aparecen con las primeras ${MIN_VOTOS}.`}
      </p>
    )
  }
  const datosMatriz = sinIndividuales(resultados)

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
        const r1 = p.rondas.find((r) => r.ronda === 1)
        const r2 = p.rondas.find((r) => r.ronda === 2)
        const rondas = [r1, r2].filter((r): r is RondaVivo => conVotos(r))
        if (rondas.length === 0) {
          return (
            <article key={p.id} className="hzp-resultado__proyecto">
              <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
              <p className="hz-texto-3">
                {p.rondas.some(pocosVotos) ? `Hacen falta al menos ${MIN_VOTOS} calificaciones para mostrar este proyecto.` : 'Sin calificaciones todavía.'}
              </p>
            </article>
          )
        }
        const dos = rondas.length === 2
        return (
          <article key={p.id} className="hzp-resultado__proyecto">
            <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
            <table className="hzp-tabla">
              <caption className="hz-visual-oculto">Posición en la matriz y promedio por criterio de {p.nombre}</caption>
              <thead>
                <tr>
                  <th scope="col">{dos ? 'Ronda' : 'Posición y criterios'}</th>
                  {rondas.map((r) => (
                    <th key={r.ronda} scope="col" className="hz-cifra">
                      {dos ? `R${r.ronda}` : 'Promedio'}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="hzp-tabla__ejes">
                {(
                  [
                    [ejeX, 'eje_x'],
                    [ejeY, 'eje_y'],
                  ] as const
                ).map(([nombre, campo]) => (
                  <tr key={campo}>
                    <th scope="row">
                      {nombre.slice(0, 5)} <span className="hzp-tabla__eje-nombre">{nombre.slice(6)}</span>
                    </th>
                    {rondas.map((r) => (
                      <td key={r.ronda} className="hz-cifra">
                        {cifra(r[campo])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
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
            <p className="hzp-resultado__pie">
              {[r1, r2]
                .filter((r): r is RondaVivo => Boolean(r && r.n_votos > 0))
                .map((r) =>
                  conVotos(r)
                    ? `${r.n_votos} calificaciones en la ronda ${r.ronda}`
                    : `Ronda ${r.ronda}: hacen falta al menos ${MIN_VOTOS} calificaciones para mostrarla`,
                )
                .join(' · ')}
            </p>
          </article>
        )
      })}
    </section>
  )
}
