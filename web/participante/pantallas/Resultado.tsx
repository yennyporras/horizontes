import { useEffect, useState } from 'react'
import { Insignia } from '../../shared/ui'
import { MatrizHorizontes, type DatosTablero, type Vista } from '../../tablero'
import type { Criterio, Resultados, RondaVivo, Voto } from '../api'
import { cifra } from '../Comun'
import { LECTURA_BURBUJA, LECTURA_EJES, descripcionCriterio, nombreCortoCriterio } from '../../shared/criterios'

export const textoAlcance = (r: Resultados | null, alcance: 'mesa' | 'sala') => ((r?.alcance?.tipo ?? alcance) === 'sala' ? 'la sala' : 'tu mesa')

/**
 * SPEC §7 y acta A1: ningún resultado muestra respuestas individuales. Con 1 voto el promedio ES esa respuesta;
 * con 2, quien votó despeja la del otro (otro = 2 · promedio − propia). Por eso 3 (acta del 16-oct, C3).
 * Manda `minimo_votos` del servidor; ocultar no es recalcular.
 */
export const MIN_VOTOS = 3
const minimoDe = (r: Resultados) => r.minimo_votos ?? MIN_VOTOS
const conVotos = (x: RondaVivo | undefined, min: number) => Boolean(x && !x.bajo_minimo && !esOculta(x) && x.n_votos >= min && x.promedios)
// Una ronda oculta (R1 abierta, decisión 1 de Paola del 20-oct) no está bajo el mínimo: espera a que todos voten.
const pocosVotos = (x: RondaVivo | undefined, min: number) => Boolean(x && !esOculta(x) && x.n_votos > 0 && !conVotos(x, min))

/**
 * Contrato del 20-oct (aditivo): `oculta: true` cuando la ronda 1 está abierta, su alcance no está en precierre y quien
 * pide no es admin. Llega sin promedios, distribución ni ejes; `n_votos` sí.
 */
export const esOculta = (x: RondaVivo | undefined) => Boolean((x as (RondaVivo & { oculta?: true }) | undefined)?.oculta)

/** Alguna ronda `ronda` de los vivos viene oculta. */
export function rondaOculta(r: Resultados | null | undefined, ronda: number): boolean {
  return (r?.proyectos_vivos ?? []).some((p) => p.rondas.some((x) => x.ronda === ronda && esOculta(x)))
}

/** Lo que ve quien ya votó mientras la ronda 1 sigue abierta (decisión 1 de Paola del 20-oct). */
export const TEXTO_R1_OCULTA = 'Los resultados de la ronda 1 se muestran cuando todos voten o al cerrar la ronda.'

/** Insignia del resultado que todavía puede cambiar: informa, no alarma (QA por roles del 20-oct). */
export const TEXTO_PARCIAL = 'Parcial: cambia cuando lleguen más votos'

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

/** Hay algo que mostrar: al menos un proyecto con una ronda sobre el mínimo de votos. */
export function resultadoVisible(r: Resultados | null | undefined): boolean {
  if (!r) return false
  const min = minimoDe(r)
  return (r.proyectos_vivos ?? []).some((p) => p.rondas.some((x) => conVotos(x, min)))
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
 * Resultado del alcance (mesa o sala): matriz del tablero (solo props) y promedio por criterio.
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
  const hayVotos = resultadoVisible(resultados)
  const hayPocos = vivos.some((p) => p.rondas.some((x) => pocosVotos(x, min)))
  const marcarPreliminar = preliminar ?? resultados.preliminar

  if (!hayVotos) {
    return (
      <p className="hz-texto-2">
        {rondaOculta(resultados, 1)
          ? TEXTO_R1_OCULTA
          : hayPocos
          ? `Hacen falta al menos ${min} votos para mostrar estos resultados. Así nadie ve las respuestas de otra persona.`
          : `Todavía no hay votos en ${donde}. Los resultados aparecen con los primeros ${min}.`}
      </p>
    )
  }
  const datosMatriz = sinIndividuales(resultados, min)
  const vista = vistaMatriz(datosMatriz)

  return (
    <section className="hzp-resultado" aria-label={`Resultado de ${donde}`}>
      {marcarPreliminar && (
        <p>
          <Insignia>{TEXTO_PARCIAL}</Insignia>
        </p>
      )}
      <div className="hzp-matriz">
        {/* Letra de 12 px como mínimo en la matriz del celular (QA por roles del 20-oct: bajaba a 10 px). */}
        <MatrizHorizontes datos={datosMatriz as unknown as DatosTablero} vista={vista} escalaTexto={escalaTexto} letraMin={12} />
      </div>
      <LeyendaMatriz vista={vista} />
      {vivos.map((p) => {
        const rondas = [1, 2].map((n) => p.rondas.find((x) => x.ronda === n))
        const visibles = rondas.filter((x): x is RondaVivo => conVotos(x, min))
        const ocultas = rondas.filter((x): x is RondaVivo => pocosVotos(x, min))
        if (visibles.length === 0) {
          return (
            <article key={p.id} className="hzp-resultado__proyecto">
              <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
              <p className="hz-texto-3">{ocultas.length ? `Hacen falta al menos ${min} votos para mostrar este proyecto.` : 'Sin votos todavía.'}</p>
            </article>
          )
        }
        const mia = (ronda: number, criterio: string) => misVotos.find((v) => v.proyecto_id === p.id && v.ronda === ronda)?.respuestas[criterio as keyof Voto['respuestas']]
        // Con `mis_votos_anteriores` llega también la ronda 1; si alguna ronda no trae voto propio, el texto lo dice.
        const rondasMias = visibles.filter((r) => criterios.some((c) => mia(r.ronda, c.id) !== undefined)).map((r) => r.ronda)
        const votos = [...new Set(visibles.map((r) => r.n_votos))]
        const conMias = rondasMias.length > 0
        const textoMias =
          rondasMias.length === visibles.length
            ? 'Debajo de cada promedio va tu calificación (Tú). Solo la ves en tu celular.'
            : `Debajo de cada promedio de la ronda ${rondasMias.join(' y ')} va tu calificación (Tú). Solo la ves en tu celular.`
        return (
          <article key={p.id} className="hzp-resultado__proyecto">
            <h3 className="hzp-proyecto__nombre">{p.nombre}</h3>
            {conMias && <p className="hzp-resultado__pie">{textoMias}</p>}
            {/* Acta A3 y A4: solo los 6 criterios. Preentrega 19-oct: sin la fila Total («esa fila de total no dice nada»). */}
            <table className="hzp-tabla">
              <caption className="hz-visual-oculto">Promedio por criterio de {p.nombre}</caption>
              <thead>
                <tr>
                  {/* «Promedio de N votos» (QA por roles del 20-oct): cuántas personas hay detrás de cada cifra. */}
                  <th scope="col">
                    {votos.length === 1
                      ? `Promedio de ${votos[0]} votos`
                      : `Promedio de ${visibles.map((r) => `${r.n_votos} votos en R${r.ronda}`).join(' y ')}`}
                  </th>
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
                    {/* Nombre corto, el mismo del tablero (el largo solo va como antetítulo de la pregunta). abbr: el
                        lector de pantalla anuncia cada celda con el nombre corto, sin repetir la descripción. */}
                    <th scope="row" abbr={nombreCortoCriterio(c.id, c.nombre)}>
                      {nombreCortoCriterio(c.id, c.nombre)}
                      {descripcionCriterio(c.id) && <span className="hzp-tabla__desc">{descripcionCriterio(c.id)}</span>}
                    </th>
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
            </table>
            {ocultas.length > 0 && (
              <p className="hzp-resultado__pie">
                {ocultas.map((r) => `Ronda ${r.ronda}: hacen falta al menos ${min} votos para mostrarla.`).join(' ')}
              </p>
            )}
          </article>
        )
      })}
    </section>
  )
}

/**
 * Leyenda bajo la matriz del celular (QA por roles del 20-oct: sin ella no se sabía qué era cada burbuja ni cómo se
 * leen los ejes): R1 hueco y R2 sólido con su texto, el tamaño de la burbuja y la lectura de los ejes.
 */
function LeyendaMatriz({ vista }: { vista: Vista }) {
  const rondas = vista === 'comparacion' ? [1, 2] : [vista === 2 ? 2 : 1]
  return (
    <div className="hzp-leyenda">
      <ul className="hzp-leyenda__rondas" aria-label="Rondas en la matriz">
        {rondas.map((n) => (
          <li key={n}>
            <Insignia tono={n === 1 ? 'r1' : 'r2'}>R{n}</Insignia> Ronda {n}
          </li>
        ))}
      </ul>
      <p>{LECTURA_BURBUJA}</p>
      <p>{LECTURA_EJES}</p>
    </div>
  )
}

/**
 * Cuántas de tus respuestas cambiaron de la ronda 1 a la 2: compara tus votos de `mis_votos` y `mis_votos_anteriores`
 * criterio por criterio, en los proyectos que calificaste en las dos rondas. Cuenta, no recalcula el motor.
 */
export function cambiosEntreRondas(misVotos: Voto[], criterios: Pick<Criterio, 'id'>[]): { cambios: number; total: number } {
  let cambios = 0
  let total = 0
  for (const r2 of misVotos.filter((v) => v.ronda === 2)) {
    const r1 = misVotos.find((v) => v.ronda === 1 && v.proyecto_id === r2.proyecto_id)
    if (!r1) continue
    for (const c of criterios) {
      const a = r1.respuestas[c.id as keyof Voto['respuestas']]
      const b = r2.respuestas[c.id as keyof Voto['respuestas']]
      if (a === undefined || b === undefined) continue
      total++
      if (a !== b) cambios++
    }
  }
  return { cambios, total }
}

/** Cierre personal al cerrar la ronda 2 (QA por roles del 20-oct): cuánto cambiaste y una pregunta para la mesa. */
export function CierrePersonal({ misVotos, criterios }: { misVotos: Voto[]; criterios: Pick<Criterio, 'id'>[] }) {
  const { cambios, total } = cambiosEntreRondas(misVotos, criterios)
  if (total === 0) return null
  return (
    <section className="hzp-cierre" aria-label="Tu cambio entre rondas">
      <p className="hzp-cierre__dato">
        {cambios === 0
          ? `No cambiaste ninguna de tus ${total} respuestas entre la ronda 1 y la 2.`
          : `Cambiaste ${cambios} de tus ${total} respuestas entre la ronda 1 y la 2.`}
      </p>
      <p className="hz-texto-2">{cambios === 0 ? '¿Qué dato de otra hoja confirmó lo que pensabas?' : '¿Qué dato de otra hoja te hizo cambiar?'}</p>
    </section>
  )
}
