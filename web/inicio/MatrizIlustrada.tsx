import type { CSSProperties } from 'react'
import seed from '../../data/seed_foodsume.json'

// Ilustración de la matriz (no son datos de ninguna sala): los horizontes de la semilla, ocho puntos fijos
// y dos proyectos que se mueven de la ronda 1 (hueco, verde) a la ronda 2 (sólido, rojo).
const { grafico } = seed.motor
const MAX = 9.5
const X0 = 7
const Y0 = 93
const K = (100 - X0) / MAX
const px = (x: number) => X0 + x * K
const py = (y: number) => Y0 - y * K

const FIJOS: [number, number, number][] = [
  [2.2, 2.9, 1.7], [3.6, 1.5, 1.4], [5.7, 3.2, 2.1], [6.6, 6.1, 1.6],
  [2.6, 5.7, 1.9], [7.9, 4.3, 1.5], [4.4, 7.6, 1.8], [8.4, 8.4, 1.4],
]
const VIVOS: { r1: [number, number]; r2: [number, number] }[] = [
  { r1: [7.1, 6.9], r2: [5.1, 5.5] },
  { r1: [2.4, 8.3], r2: [5.3, 8.9] },
]
const R = 2.3

export function MatrizIlustrada() {
  return (
    <figure className="in-matriz">
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id="in-plano">
            <rect x={X0} y={0} width={100 - X0} height={Y0} />
          </clipPath>
        </defs>
        <g clipPath="url(#in-plano)">
          <rect x={X0} y={0} width={100 - X0} height={Y0} fill="var(--hz-h1)" />
          {grafico.horizontes
            .filter((h) => h.radio)
            .reverse()
            .map((h, i) => (
              <circle key={h.id} cx={X0} cy={Y0} r={h.radio! * K} fill={i === 0 ? 'var(--hz-h2)' : 'var(--hz-h3)'} />
            ))}
        </g>
        {Object.entries(grafico.etiquetas_horizonte).map(([id, [x, y]]) => (
          <text key={id} className="in-matriz__h" x={px(x)} y={py(y)}>
            {id}
          </text>
        ))}
        {FIJOS.map(([x, y, r]) => (
          <circle key={`${x}-${y}`} className="in-matriz__fijo" cx={px(x)} cy={py(y)} r={r} />
        ))}
        {VIVOS.map(({ r1, r2 }) => {
          const [x1, y1, x2, y2] = [px(r1[0]), py(r1[1]), px(r2[0]), py(r2[1])]
          const largo = Math.hypot(x2 - x1, y2 - y1)
          const [ux, uy] = [(x2 - x1) / largo, (y2 - y1) / largo]
          const angulo = (Math.atan2(uy, ux) * 180) / Math.PI
          return (
            <g key={`${x1}-${y1}`}>
              <line className="in-matriz__traza" pathLength={1} x1={x1 + ux * R} y1={y1 + uy * R} x2={x2 - ux * (R + 2.6)} y2={y2 - uy * (R + 2.6)} />
              <circle className="in-matriz__r1" cx={x1} cy={y1} r={R} />
              <text className="in-matriz__etiqueta" x={x1 + R + 1} y={y1 - R}>R1</text>
              <g className="in-matriz__mueve" style={{ '--dx': `${x1 - x2}px`, '--dy': `${y1 - y2}px` } as CSSProperties}>
                <path className="in-matriz__punta" d="M0 -1.4 L2.4 0 L0 1.4 Z" transform={`translate(${x2 - ux * (R + 2.6)} ${y2 - uy * (R + 2.6)}) rotate(${angulo})`} />
                <circle className="in-matriz__r2" cx={x2} cy={y2} r={R} />
                <text className="in-matriz__etiqueta" x={x2 + R + 1} y={y2 + R + 2.4}>R2</text>
              </g>
            </g>
          )
        })}
        <text className="in-matriz__eje" x={X0 + 1} y={99}>Time 2 Market</text>
        <text className="in-matriz__eje" transform={`translate(4.6 ${Y0 - 1}) rotate(-90)`}>Value Generation Capacity</text>
      </svg>
      <figcaption>
        Ilustración. Cada mesa mueve sus dos proyectos de la <span className="in-r1">R1</span> a la <span className="in-r2">R2</span> entre
        ocho proyectos fijos. Más cerca del origen, el horizonte H1; más lejos, el H3.
      </figcaption>
    </figure>
  )
}
