import type { VistaPregunta } from './logica'

/** Modo guiado (C19-5, T3): la pregunta que eligió el facilitador, con su rúbrica, en grande para el proyector. */
export function PreguntaGuiada({ p }: { p: VistaPregunta }) {
  return (
    <section className="hz-guiada" aria-labelledby="hz-guiada-titulo" aria-live="polite">
      <p className="hz-guiada-meta">
        {p.proyecto} · Pregunta {p.numero} de {p.total}
      </p>
      <h2 id="hz-guiada-titulo">{p.nombre}</h2>
      {p.pregunta && <p className="hz-guiada-pregunta">{p.pregunta}</p>}
      {p.rubrica.length > 0 && (
        <ul className="hz-rubrica" aria-label="Rúbrica">
          {p.rubrica.map((r) => (
            <li key={r.valor}>
              <span className="hz-rubrica-valor">{r.valor}</span>
              <span>{r.texto}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="hz-guiada-pie">Responde en tu celular.</p>
    </section>
  )
}
