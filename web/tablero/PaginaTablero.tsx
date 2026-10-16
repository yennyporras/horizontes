import { useParams } from 'react-router-dom'

// T3: matriz de burbujas, R1 a R2, promedios, progreso y vista proyector.
export default function PaginaTablero() {
  const { sala } = useParams()
  return (
    <main data-ruta="tablero">
      <h1>Tablero {sala}</h1>
    </main>
  )
}
