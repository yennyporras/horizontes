import { Link } from 'react-router-dom'

/** Se muestra al entrar a una sección de sala sin haber elegido sala. */
export function ElegirSala() {
  return (
    <section className="panel">
      <h1>Elige una sala</h1>
      <p>Esta sección trabaja sobre una sala. Abre una desde la lista y vuelve aquí.</p>
      <Link className="btn btn--primario" to="/admin/salas">
        Ir a Salas
      </Link>
    </section>
  )
}
