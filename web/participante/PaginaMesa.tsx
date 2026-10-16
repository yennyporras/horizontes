import { useParams } from 'react-router-dom'

// T2: flujo del participante (inscripción, lectura, votación, voto registrado).
export default function PaginaMesa() {
  const { codigo } = useParams()
  return (
    <main data-ruta="participante">
      <h1>Mesa {codigo}</h1>
    </main>
  )
}
