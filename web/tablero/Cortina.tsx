import { TEXTO_OCULTA, avanceCortina } from './logica'
import type { DatosTablero } from './tipos'

/**
 * Ronda 1 oculta (decisión de Paola del 20-oct): mientras la ronda 1 está abierta el tablero público no muestra
 * resultados. En su lugar, en grande, cuántos votaron en cada mesa y cuándo se verá el resultado.
 */
export function Cortina({ datos }: { datos: DatosTablero }) {
  const filas = avanceCortina(datos)
  return (
    <section className="hz-cortina" aria-labelledby="hz-cortina-t">
      <h2 id="hz-cortina-t" className="hz-sub">
        Avance de la ronda 1
      </h2>
      {filas.length > 0 && (
        <ul className="hz-cortina-mesas">
          {filas.map((f) => (
            <li key={f.id} className={f.inscritos > 0 && f.votaron >= f.inscritos ? 'hz-cortina-lista' : undefined}>
              <span className="hz-cortina-mesa">{f.nombre}</span>
              <span className="hz-cortina-n">
                <b>{f.votaron}</b> de {f.inscritos} votaron
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="hz-cortina-texto">{TEXTO_OCULTA}</p>
    </section>
  )
}
