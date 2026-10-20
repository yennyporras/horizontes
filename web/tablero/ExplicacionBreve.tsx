/**
 * Pie del modo Gráfica (pedido de Nicolai, 20-oct; reemplaza la explicación de tres líneas de C19-7): qué
 * significa cada eje, en una línea y sin pesos ni fórmulas. Solo se muestra si cabe entera (CSS).
 */
export function ExplicacionBreve() {
  return (
    <p className="hz-explica-breve">
      <b>Eje X:</b> qué tan lejos está del mercado. <b>Eje Y:</b> qué tan lejos está del core. 1 es cerca; 9, lejos.
    </p>
  )
}
