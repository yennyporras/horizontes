import type { DatosTablero } from './tipos'
import { avisosPrecierre, rondaAbierta } from './logica'

export function Progreso({ datos }: { datos: DatosTablero }) {
  const p = datos.progreso
  if (!p) return null
  const avisos = avisosPrecierre(datos)
  const abierta = rondaAbierta(datos.sala?.estado)
  const pct = p.inscritos ? Math.min(100, Math.round((p.completos / p.inscritos) * 100)) : 0
  // QA-T-09: una mesa sin inscritos es ruido en el proyector.
  const mesas = (p.por_mesa ?? []).filter((m) => m.inscritos > 0)
  return (
    <section className="hz-progreso" aria-labelledby="hz-progreso-t">
      <h2 id="hz-progreso-t" className="hz-sub">
        Progreso{datos.sala?.ronda_actual ? ` de la ronda ${datos.sala.ronda_actual}` : ''}
      </h2>
      <div className="hz-cifras">
        <div>
          <span className="hz-cifra">{p.inscritos}</span>
          <span className="hz-cifra-et">inscritos</span>
        </div>
        <div>
          <span className="hz-cifra">{p.completos}</span>
          <span className="hz-cifra-et">completaron</span>
        </div>
        <div
          className="hz-barra"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={p.inscritos}
          aria-valuenow={Math.min(p.completos, p.inscritos)}
          aria-valuetext={`${p.completos} de ${p.inscritos} completaron`}
        >
          <div className="hz-barra-relleno" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {avisos.length > 0 && (
        <ul className="hz-avisos" role="status" aria-live="polite">
          {avisos.map((a) => (
            <li key={a.id}>
              <span aria-hidden="true" className="hz-check">
                ✓
              </span>
              {a.texto}
            </li>
          ))}
        </ul>
      )}
      {mesas.length > 0 && (
        <ul className="hz-mesas" aria-label="Progreso por mesa">
          {mesas.map((m) => (
            <li key={m.mesa_id} className={m.precierre && abierta ? 'hz-mesa hz-mesa-lista' : 'hz-mesa'}>
              <span className="hz-mesa-nombre">{m.nombre}</span>
              <span className="hz-mesa-n">
                {m.completos} de {m.inscritos}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
