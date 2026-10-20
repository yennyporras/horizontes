import type { DatosTablero } from './tipos'

/**
 * Bajo la matriz (C19-7): qué significa cada eje y cada punto, en lenguaje simple. Sin pesos ni
 * fórmulas: la ponderación no se explica en el taller (preentrega del 19-oct).
 */
export function ExplicacionMatriz({ datos }: { datos: DatosTablero }) {
  const de = datos.alcance?.tipo === 'mesa' ? 'la mesa' : 'la sala'
  return (
    <p className="hz-explica">
      <b>Eje X, Time to Market:</b> qué tan lejos está el proyecto del mercado. <b>Eje Y, Value Generation Capacity:</b> qué tan lejos está
      del core del negocio y cuánto cuesta probarlo. 1 es cerca y listo; 9, lejos e incierto. Cada punto es el promedio de los votos de {de} y
      el tamaño de la burbuja es el tamaño de la oportunidad.
    </p>
  )
}
