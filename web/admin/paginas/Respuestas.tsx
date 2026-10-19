import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api, lista } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import type { RespuestaPersona } from '../tipos'
import { CRITERIOS, fechaHora, nombrePerfil, nombreProyecto, zonaSala } from '../textos'

/**
 * Respuestas de cada persona por ronda (C19-3). Solo para administradores: la API responde 401/403 al resto
 * y ningún tablero ni celular las muestra.
 */
export function Respuestas() {
  const { salaId } = useParams()
  const { datos, error } = useSala(salaId)
  const [filas, setFilas] = useState<RespuestaPersona[] | null>(null)
  const [errorFilas, setErrorFilas] = useState<string | null>(null)
  const [mesa, setMesa] = useState('todas')
  const [ronda, setRonda] = useState('todas')
  const version = datos?.version

  // Se relee con cada cambio de la sala (un voto nuevo sube la versión).
  useEffect(() => {
    if (!salaId || !version) return
    let vigente = true
    api
      .get<unknown>(`/api/admin/salas/${salaId}/respuestas`)
      .then((r) => {
        if (!vigente) return
        setFilas(lista<RespuestaPersona>(r, 'respuestas'))
        setErrorFilas(null)
      })
      .catch((e: Error) => vigente && setErrorFilas(e.message))
    return () => {
      vigente = false
    }
  }, [salaId, version])

  return (
    <ConSala titulo="Respuestas por persona" datos={datos} error={error}>
      {(d) => {
        const zona = zonaSala(d.sala.config)
        const visibles = (filas ?? [])
          .filter((f) => mesa === 'todas' || f.mesa_id === mesa)
          .filter((f) => ronda === 'todas' || String(f.ronda) === ronda)
          .sort((a, b) => a.mesa.localeCompare(b.mesa, 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es') || a.ronda - b.ronda || a.proyecto_id.localeCompare(b.proyecto_id))
        return (
          <>
            <p className="alerta alerta--aviso" role="note">
              <strong>Solo administradores. No se proyecta.</strong>
              Aquí se ve qué calificó cada persona. Los tableros y los celulares solo muestran promedios anónimos.
            </p>
            <section className="panel" aria-labelledby="t-respuestas">
              <h2 id="t-respuestas">Calificaciones</h2>
              <div className="fila-form">
                <label className="campo">
                  <span>Mesa</span>
                  <select value={mesa} onChange={(e) => setMesa(e.target.value)}>
                    <option value="todas">Todas las mesas</option>
                    {d.mesas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Ronda</span>
                  <select value={ronda} onChange={(e) => setRonda(e.target.value)}>
                    <option value="todas">Las dos rondas</option>
                    <option value="1">Ronda 1</option>
                    <option value="2">Ronda 2</option>
                  </select>
                </label>
              </div>
              {errorFilas ? (
                <p className="alerta alerta--error" role="alert">
                  No pudimos cargar las respuestas. {errorFilas}
                </p>
              ) : !filas ? (
                <p role="status">Cargando respuestas…</p>
              ) : filas.length === 0 ? (
                <p className="vacio">Aún nadie ha votado en esta sala.</p>
              ) : visibles.length === 0 ? (
                <p className="vacio">No hay respuestas con ese filtro.</p>
              ) : (
                <div className="tabla-envoltura">
                  <table className="tabla-tarjetas tabla-respuestas">
                    <caption className="pista">
                      {visibles.length} {visibles.length === 1 ? 'voto' : 'votos'}. Cada fila es una persona, una ronda y un proyecto.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col">Mesa</th>
                        <th scope="col">Perfil</th>
                        <th scope="col">Ronda</th>
                        <th scope="col">Proyecto</th>
                        {CRITERIOS.map((c) => (
                          <th key={c.id} scope="col" className="num" title={c.nombre}>
                            {c.corto}
                          </th>
                        ))}
                        <th scope="col">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((f) => (
                        <tr key={`${f.participante_id}-${f.ronda}-${f.proyecto_id}`}>
                          <th scope="row">{f.nombre}</th>
                          <td data-label="Mesa">{f.mesa}</td>
                          <td data-label="Perfil">{nombrePerfil(f.perfil_id)}</td>
                          <td data-label="Ronda">
                            <span className={`ronda ronda--${f.ronda}`}>R{f.ronda}</span>
                          </td>
                          <td data-label="Proyecto">{nombreProyecto(f.proyecto_id)}</td>
                          {CRITERIOS.map((c) => (
                            <td key={c.id} className="num" data-label={c.corto}>
                              {f.respuestas[c.id] ?? 'Sin dato'}
                            </td>
                          ))}
                          <td data-label="Fecha">{fechaHora(f.actualizado_at, zona)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      }}
    </ConSala>
  )
}
