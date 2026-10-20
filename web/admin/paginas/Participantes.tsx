import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { api, lista } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import { AvisoPrivado } from '../componentes/AvisoPrivado'
import { useConfirmar } from '../componentes/Confirmar'
import { DialogoAcceso, type Acceso } from '../componentes/AccesoDeNuevo'
import type { Participante, RespuestaPersona, SalaDetalle } from '../tipos'
import { rondaAbierta, zonaSala } from '../textos'
import { nombrePerfil, useContenidoSala } from '../contenido'

/**
 * Quiénes ya votaron en alguna ronda (QA-A-09): mover o desactivar a esas personas cambia resultados y precierre, así
 * que se confirma antes. Se lee de Respuestas con cada cambio de la sala; si no se puede leer, se usa «completó la
 * ronda» del detalle.
 */
function useVotaron(salaId: string | undefined, version: string | undefined) {
  const [ids, setIds] = useState<Set<string> | null>(null)
  useEffect(() => {
    if (!salaId || !version) return
    let vigente = true
    api
      .get<unknown>(`/api/admin/salas/${salaId}/respuestas`)
      .then((r) => vigente && setIds(new Set(lista<RespuestaPersona>(r, 'respuestas').map((f) => f.participante_id))))
      .catch(() => vigente && setIds(null))
    return () => {
      vigente = false
    }
  }, [salaId, version])
  return ids
}

/** Lista por mesa con perfil y estado de la ronda. Nunca muestra respuestas (SPEC §9). */
export function Participantes() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  // QA por roles (Nicolai): «Ver quién falta» de Sala en vivo llega con ?mesa=m1&pendientes=1.
  const [busqueda] = useSearchParams()
  const [filtroMesa, setFiltroMesa] = useState(() => busqueda.get('mesa') ?? 'todas')
  const [soloPendientes, setSoloPendientes] = useState(() => busqueda.get('pendientes') === '1')
  const [buscar, setBuscar] = useState('')
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState<string | null>(null)
  const [acceso, setAcceso] = useState<{ p: Participante; datos: Acceso } | null>(null)
  const [dialogo, confirmar] = useConfirmar()
  const votaron = useVotaron(salaId, datos?.version)
  const contenido = useContenidoSala(datos)
  const perfiles = contenido.perfiles
  const yaVoto = (p: Participante) => (votaron ? votaron.has(p.id) : p.completo_ronda)

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

  const mover = async (d: SalaDetalle, p: Participante, mesaId: string) => {
    const nombreMesa = (id: string) => d.mesas.find((m) => m.id === id)?.nombre ?? id
    const origen = nombreMesa(p.mesa_id)
    const destino = nombreMesa(mesaId)
    if (
      yaVoto(p) &&
      !(await confirmar(
        `¿Mover a ${p.nombre} a ${destino}?`,
        `${p.nombre} ya votó. Sus votos se mueven con la persona: dejan de contar en ${origen} y pasan a contar en ${destino}. El avance de las dos mesas se recalcula.`,
        'Sí, mover',
        { tono: 'primario' },
      ))
    )
      return
    await editar(p, { mesa_id: mesaId }, `${p.nombre} pasó a ${destino}.`)
  }

  const cambiarActivo = async (p: Participante) => {
    if (
      p.activo &&
      yaVoto(p) &&
      !(await confirmar(
        `¿Desactivar a ${p.nombre}?`,
        `${p.nombre} ya votó. Si desactivas a esta persona, sus calificaciones dejan de contar en los promedios de la sala y de su mesa, y su mesa puede llegar a «Todos votaron» sin contarla. Puedes activarla de nuevo cuando quieras.`,
        'Sí, desactivar',
        { tono: 'primario' },
      ))
    )
      return
    await editar(p, { activo: !p.activo }, p.activo ? `Desactivaste a ${p.nombre}: sus calificaciones no cuentan en los promedios.` : `Activaste de nuevo a ${p.nombre}.`)
  }

  const darAcceso = async (p: Participante) => {
    setAviso(null)
    setGuardando(p.id)
    try {
      const datosAcceso = await api.post<Acceso>(`/api/admin/participantes/${encodeURIComponent(p.id)}/acceso`)
      setAcceso({ p, datos: datosAcceso })
    } catch (e) {
      setAviso({ tono: 'error', texto: e instanceof Error ? `No pudimos dar acceso a ${p.nombre}. ${e.message}` : `No pudimos dar acceso a ${p.nombre}.` })
    } finally {
      setGuardando(null)
    }
  }

  return (
    <ConSala titulo="Participantes" datos={datos} error={error}>
      {(d) => {
        const ronda = rondaAbierta(d.sala.estado) ?? (d.sala.ronda_actual || null)
        const cerrada = d.sala.estado === 'cerrada'
        const nombreMesa = (id: string) => d.mesas.find((m) => m.id === id)?.nombre ?? id
        const q = buscar.trim().toLowerCase()
        const filas = d.participantes
          .filter((p) => filtroMesa === 'todas' || p.mesa_id === filtroMesa)
          .filter((p) => !soloPendientes || (p.activo && !p.completo_ronda))
          .filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.correo.toLowerCase().includes(q))
          .sort((a, b) => nombreMesa(a.mesa_id).localeCompare(nombreMesa(b.mesa_id), 'es', { numeric: true }) || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }))

        return (
          <>
            {dialogo}
            {acceso && (
              <DialogoAcceso nombre={acceso.p.nombre} participanteId={acceso.p.id} zona={zonaSala(d.sala.config)} inicial={acceso.datos} alCerrar={() => setAcceso(null)} />
            )}
            <AvisoPrivado>Nombre, correo, mesa, perfil, país e IP de cada inscrito. Para gestionar la sala, no para mostrarla.</AvisoPrivado>
            <Resumen d={d} perfiles={perfiles} />
            <section className="panel" aria-labelledby="t-lista">
              <h2 id="t-lista">Inscritos</h2>
              <p className="pista" id="ayuda-acceso">
                {cerrada
                  ? 'Con la sala cerrada ya no se puede dar acceso de nuevo.'
                  : '«Dar acceso de nuevo» es para quien cambió de celular o borró la sesión: genera un QR personal que sirve una vez y vence en 15 minutos. A una persona desactivada, actívala primero.'}
              </p>
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
              <label className="opcion opcion--linea">
                <input type="checkbox" checked={soloPendientes} aria-describedby="ayuda-pendientes" onChange={(e) => setSoloPendientes(e.target.checked)} />
                <span>Solo pendientes</span>
              </label>
              <p id="ayuda-pendientes" className="pista">
                {ronda ? `Quienes siguen activos y no han terminado la ronda ${ronda}.` : 'Quienes siguen activos y no han terminado la ronda en curso.'}
              </p>
              {aviso && (
                <p className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
                  {aviso.texto}
                </p>
              )}
              {d.participantes.length === 0 ? (
                <p className="vacio">Aún no hay inscritos. Comparte el QR de cada mesa para que la gente entre.</p>
              ) : filas.length === 0 ? (
                <p className="vacio">{soloPendientes ? 'Nadie está pendiente con ese filtro: ya terminaron todos.' : 'Nadie coincide con ese filtro.'}</p>
              ) : (
                <div className="tabla-envoltura">
                  <table className="tabla-tarjetas tabla-tarjetas--ancha">
                    <thead>
                      <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col">Correo</th>
                        <th scope="col">Mesa</th>
                        <th scope="col">Perfil</th>
                        <th scope="col">{ronda ? `Ronda ${ronda}` : 'Ronda'}</th>
                        <th scope="col">País · IP</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filas.map((p) => (
                        <tr key={p.id} className={p.activo ? undefined : 'inactivo'} aria-busy={guardando === p.id}>
                          <th scope="row">{p.nombre}</th>
                          <td data-label="Correo" className="td-largo">
                            {p.correo}
                          </td>
                          <td data-label="Mesa">
                            <select
                              className="chico"
                              aria-label={`Mesa de ${p.nombre}`}
                              value={p.mesa_id}
                              disabled={guardando === p.id}
                              onChange={(e) => void mover(d, p, e.target.value)}
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
                              onChange={(e) => editar(p, { perfil_id: e.target.value }, `${p.nombre} ahora tiene el perfil ${nombrePerfil(contenido, e.target.value)}.`)}
                            >
                              {perfiles.map((pf) => (
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
                          <td data-label="País · IP" className="sin-corte">{p.ip ? `${p.pais ?? ''} ${p.ip}`.trim() : 'Sin registro'}</td>
                          <td data-label="Acciones" className="td-ancho">
                            <span className="acciones acciones--fila">
                              <button
                                type="button"
                                className="hz-boton hz-boton--secundario hz-boton--chico"
                                disabled={guardando === p.id || cerrada || !p.activo}
                                aria-label={`Dar acceso de nuevo a ${p.nombre}`}
                                aria-describedby="ayuda-acceso"
                                onClick={() => void darAcceso(p)}
                              >
                                Dar acceso de nuevo
                              </button>
                              <button
                                type="button"
                                className="hz-boton hz-boton--secundario hz-boton--chico"
                                disabled={guardando === p.id}
                                aria-label={`${p.activo ? 'Desactivar' : 'Activar'} a ${p.nombre}`}
                                onClick={() => void cambiarActivo(p)}
                              >
                                {p.activo ? 'Desactivar' : 'Activar'}
                              </button>
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="pista nota-tabla">
                Qué calificó cada persona está en Respuestas, solo para administradores; ningún tablero lo muestra. País e IP son registro interno: solo salen en este panel y en los
                archivos de Exportar.
              </p>
            </section>
          </>
        )
      }}
    </ConSala>
  )
}

/** Perfiles por mesa: ayuda a ver si el balance quedó parejo antes de reasignar. */
function Resumen({ d, perfiles }: { d: SalaDetalle; perfiles: { id: string; nombre: string }[] }) {
  if (d.mesas.length === 0) return null
  return (
    <section className="panel" aria-labelledby="t-perfiles">
      <h2 id="t-perfiles">Perfiles por mesa</h2>
      <div className="tabla-envoltura">
        <table className="tabla-tarjetas tabla-tarjetas--ancha">
          <thead>
            <tr>
              <th scope="col">Mesa</th>
              {perfiles.map((p) => (
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
                {perfiles.map((p) => (
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
