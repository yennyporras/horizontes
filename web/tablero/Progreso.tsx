import type { DatosTablero } from './tipos'
import { avisosPrecierre, rondaAbierta } from './logica'

export function Progreso({ datos }: { datos: DatosTablero }) {
  const p = datos.progreso
  if (!p) return null
  const avisos = avisosPrecierre(datos)
  const abierta = rondaAbierta(datos.sala?.estado)
  const pct = p.inscritos ? Math.round((p.completos / p.inscritos) * 100) : 0
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
          aria-valuenow={p.completos}
          aria-valuetext={`${p.completos} de ${p.inscritos} completaron`}
        >
          <div className="hz-barra-relleno" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {avisos.length > 0 && (
        <ul className="hz-avisos" role="status" aria-live="polite">
          {avisos.map((a) => (
            <li key={a}>
              <span aria-hidden="true" className="hz-check">
                ✓
              </span>
              {a}
            </li>
          ))}
        </ul>
      )}
      {p.por_mesa?.length > 0 && (
        <ul className="hz-mesas" aria-label="Progreso por mesa">
          {p.por_mesa.map((m) => (
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
