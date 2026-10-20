import { HORIZONTES, LECTURA_BURBUJA, LECTURA_EJES } from '../shared/criterios'

/**
 * Qué significa cada eje, en una línea y sin pesos ni fórmulas (`LECTURA_EJES`, fuente única en web/shared/criterios.ts).
 * QA por roles: siempre visible, también en Detallado y en 1280×720 (el eje Y se leía al revés).
 */
export function ExplicacionBreve({ className }: { className?: string }) {
  const partes = LECTURA_EJES.split(/(Eje [XY]:)/).filter(Boolean)
  return (
    <p className={['hz-explica-breve', className].filter(Boolean).join(' ')}>
      {partes.map((p, i) => (/^Eje [XY]:$/.test(p) ? <b key={i}>{p}</b> : p))}
    </p>
  )
}

/**
 * Cómo leer la matriz: el tamaño de la burbuja (`LECTURA_BURBUJA`), los tres horizontes (`HORIZONTES`) y, si se pide,
 * los ejes. En Gráfica va en la columna que llena el espacio a la derecha de la matriz; en Detallado, en el panel.
 */
export function LecturaMatriz({ conEjes = true, className }: { conEjes?: boolean; className?: string }) {
  return (
    <section className={['hz-lectura', className].filter(Boolean).join(' ')} aria-label="Cómo leer la matriz">
      <p className="hz-lectura-burbuja">
        <i className="hz-lectura-tam" aria-hidden="true">
          <i />
          <i />
        </i>
        {LECTURA_BURBUJA}
      </p>
      <ul className="hz-horizontes">
        {HORIZONTES.map((h) => (
          <li key={h.id}>
            <b>
              {h.id} {h.nombre}:
            </b>{' '}
            {h.texto}
          </li>
        ))}
      </ul>
      {conEjes && <ExplicacionBreve />}
    </section>
  )
}
