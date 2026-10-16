import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import type { Participante, SalaDetalle } from '../tipos'
import { PERFILES, nombrePerfil, rondaAbierta } from '../textos'

/** Lista por mesa con perfil y estado de la ronda. Nunca muestra respuestas (SPEC §9). */
export function Participantes() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [filtroMesa, setFiltroMesa] = useState('todas')
  const [buscar, setBuscar] = useState('')
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)

  const editar = async (p: Participante, cambio: { perfil_id?: string; mesa_id?: string; activo?: boolean }, texto: string) => {
    setAviso(null)
    setGuardando(p.id)
    try {
      await api.patch(`/api/admin/participantes/${p.id}`, cambio)
      await refrescar()
      setAviso({ tono: 'exito', texto })
    } catch (e) {
      setAviso({ tono: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar el cambio.' })
    } finally {
      setGuardando(null)
    }
  }

  return (
    <ConSala titulo="Participantes" datos={datos} error={error}>
      {(d) => {
        const ronda = rondaAbierta(d.sala.estado) ?? (d.sala.ronda_actual || null)
        const nombreMesa = (id: string) => d.mesas.find((m) => m.id === id)?.nombre ?? id
        const q = buscar.trim().toLowerCase()
        const filas = d.participantes
          .filter((p) => filtroMesa === 'todas' || p.mesa_id === filtroMesa)
          .filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.correo.toLowerCase().includes(q))
          .sort((a, b) => nombreMesa(a.mesa_id).localeCompare(nombreMesa(b.mesa_id), 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es'))

        return (
          <>
            <Resumen d={d} />
            <section className="panel" aria-labelledby="t-lista">
              <h2 id="t-lista">Inscritos</h2>
              <div className="fila-form">
                <label className="campo">
                  <span>Mesa</span>
                  <select value={filtroMesa} onChange={(e) => setFiltroMesa(e.target.value)}>
                    <option value="todas">Todas las mesas</option>
                    {d.mesas.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Buscar por nombre o correo</span>
                  <input type="search" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
                </label>
              </div>
              {aviso && (
                <p className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
                  {aviso.texto}
                </p>
              )}
              {d.participantes.length === 0 ? (
                <p className="vacio">Aún no hay inscritos. Comparte el QR de cada mesa para que la gente entre.</p>
              ) : filas.length === 0 ? (
                <p className="vacio">Nadie coincide con ese filtro.</p>
              ) : (
                <div className="tabla-envoltura">
                  <table className="tabla-tarjetas">
                    <thead>
                      <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col">Correo</th>
                        <th scope="col">Mesa</th>
                        <th scope="col">Perfil</th>
                        <th scope="col">{ronda ? `Ronda ${ronda}` : 'Ronda'}</th>
                        <th scope="col">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((p) => (
                        <tr key={p.id} className={p.activo ? undefined : 'inactivo'} aria-busy={guardando === p.id}>
                          <th scope="row">{p.nombre}</th>
                          <td data-label="Correo">{p.correo}</td>
                          <td data-label="Mesa">
                            <select
                              className="chico"
                              aria-label={`Mesa de ${p.nombre}`}
                              value={p.mesa_id}
                              disabled={guardando === p.id}
                              onChange={(e) => editar(p, { mesa_id: e.target.value }, `${p.nombre} pasó a ${nombreMesa(e.target.value)}.`)}
                            >
                              {d.mesas.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td data-label="Perfil">
                            <select
                              className="chico"
                              aria-label={`Perfil de ${p.nombre}`}
                              value={p.perfil_id}
                              disabled={guardando === p.id}
                              onChange={(e) => editar(p, { perfil_id: e.target.value }, `${p.nombre} ahora tiene el perfil ${nombrePerfil(e.target.value)}.`)}
                            >
                              {PERFILES.map((pf) => (
                                <option key={pf.id} value={pf.id}>
                                  {pf.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td data-label={ronda ? `Ronda ${ronda}` : 'Ronda'}>
                            {!p.activo ? (
                              <span className="etiqueta etiqueta--apagado">Inactivo</span>
                            ) : p.completo_ronda ? (
                              <span className="etiqueta etiqueta--exito">Completo</span>
                            ) : (
                              <span className="etiqueta etiqueta--aviso">Pendiente</span>
                            )}
                          </td>
                          <td data-label="Acción">
                            <button
                              className={p.activo ? 'btn btn--peligro btn--chico' : 'btn btn--chico'}
                              disabled={guardando === p.id}
                              onClick={() =>
                                editar(
                                  p,
                                  { activo: !p.activo },
                                  p.activo ? `${p.nombre} quedó inactivo: sus votos no cuentan en los promedios.` : `${p.nombre} volvió a estar activo.`,
                                )
                              }
                            >
                              {p.activo ? 'Desactivar' : 'Activar'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="pista">Las respuestas de cada persona no se muestran aquí ni en ningún tablero.</p>
            </section>
          </>
        )
      }}
    </ConSala>
  )
}

/** Perfiles por mesa: ayuda a ver si el balance quedó parejo antes de reasignar. */
function Resumen({ d }: { d: SalaDetalle }) {
  if (d.mesas.length === 0) return null
  return (
    <section className="panel" aria-labelledby="t-perfiles">
      <h2 id="t-perfiles">Perfiles por mesa</h2>
      <div className="tabla-envoltura">
        <table className="tabla-tarjetas">
          <thead>
            <tr>
              <th scope="col">Mesa</th>
              {PERFILES.map((p) => (
                <th key={p.id} scope="col" className="num">
                  {p.nombre}
                </th>
              ))}
              <th scope="col" className="num">
                Completaron
              </th>
            </tr>
          </thead>
          <tbody>
            {d.mesas.map((m) => (
              <tr key={m.id}>
                <th scope="row">{m.nombre}</th>
                {PERFILES.map((p) => (
                  <td key={p.id} className="num" data-label={p.nombre}>
                    {m.perfiles[p.id] ?? 0}
                  </td>
                ))}
                <td className="num" data-label="Completaron">
                  {m.completos} de {m.inscritos}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
