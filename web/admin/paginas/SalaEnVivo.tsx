import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, consultar } from '../api'
import { useSala } from '../useSala'
import { useConfirmar } from '../componentes/Confirmar'
import { ConSala } from './EncabezadoSala'
import type { Accion, SalaDetalle, TableroResumen } from '../tipos'
import {
  ACCIONES,
  ACCIONES_POR_ESTADO,
  CONFIRMACIONES,
  ORDEN_ACCIONES,
  decimal,
  faltan,
  fechaHora,
  rondaAbierta,
  rutaApiTablero,
  textoEvento,
  urlTableroSala,
} from '../textos'

/** Hora actual que se actualiza cada segundo (para las cuentas regresivas). */
function useAhora() {
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return ahora
}

export function SalaEnVivo() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [enCurso, setEnCurso] = useState<Accion | null>(null)
  const [dialogo, confirmar] = useConfirmar()

  const ejecutar = async (accion: Accion) => {
    const c = CONFIRMACIONES[accion]
    if (c && !(await confirmar(c.titulo, c.texto, c.boton))) return
    setErrorAccion(null)
    setEnCurso(accion)
    try {
      await api.post(`/api/admin/salas/${salaId}/acciones`, { accion })
      await refrescar()
    } catch (e) {
      setErrorAccion(e instanceof Error ? e.message : 'No se pudo ejecutar la acción. Intenta de nuevo.')
    } finally {
      setEnCurso(null)
    }
  }

  return (
    <ConSala titulo="Sala en vivo" datos={datos} error={error}>
      {(d) => (
        <>
          {dialogo}
          <Precierre d={d} />
          <Estado d={d} />
          <section className="panel" aria-labelledby="t-control">
            <h2 id="t-control">Control de la sala</h2>
            <p className="pista" id="pista-acciones">
              Solo se activan las acciones posibles en el estado actual.
            </p>
            <div className="acciones">
              {ORDEN_ACCIONES.map((a) => {
                const valida = ACCIONES_POR_ESTADO[d.sala.estado].includes(a)
                return (
                  <button
                    key={a}
                    className={CONFIRMACIONES[a] ? 'btn btn--peligro' : 'btn btn--primario'}
                    disabled={!valida || enCurso !== null}
                    aria-describedby="pista-acciones"
                    aria-busy={enCurso === a}
                    onClick={() => ejecutar(a)}
                  >
                    {enCurso === a ? 'Aplicando…' : ACCIONES[a]}
                  </button>
                )
              })}
            </div>
            {errorAccion && (
              <p className="alerta alerta--error" role="alert">
                {errorAccion}
              </p>
            )}
          </section>
          <Mesas d={d} />
          <Eventos d={d} />
        </>
      )}
    </ConSala>
  )
}

function Estado({ d }: { d: SalaDetalle }) {
  const ahora = useAhora()
  const ronda = rondaAbierta(d.sala.estado)
  const inscritos = d.mesas.reduce((s, m) => s + m.inscritos, 0)
  const completos = d.mesas.reduce((s, m) => s + m.completos, 0)
  const { cierre_programado_ronda_at: cRonda, cierre_programado_sala_at: cSala } = d.sala.config
  const tablero = urlTableroSala(d.sala.url_tablero, d.mesas[0]?.url_tablero)

  return (
    <section className="panel" aria-labelledby="t-estado">
      <h2 id="t-estado">Estado</h2>
      <div className="estado-grande">
        <div>
          <span className="pista">Ronda en curso</span>
          <div className="cifra">{ronda ?? (d.sala.ronda_actual || 'Ninguna')}</div>
        </div>
        <div>
          <span className="pista">Inscritos</span>
          <div className="cifra">{inscritos}</div>
        </div>
        <div>
          <span className="pista">{ronda ? `Completaron la ronda ${ronda}` : 'Completaron la ronda'}</span>
          <div className="cifra">
            {completos} de {inscritos}
          </div>
        </div>
      </div>
      <ul className="pista" aria-label="Cierres programados">
        <li>
          Cierre programado de la ronda:{' '}
          {cRonda ? (
            <>
              {fechaHora(cRonda)}
              {ronda && (
                <>
                  {' '}
                  · <span className="cuenta">se cierra en {faltan(new Date(cRonda).getTime() - ahora)}</span>
                </>
              )}
            </>
          ) : (
            'sin programar'
          )}
        </li>
        <li>
          Cierre programado de la sala:{' '}
          {cSala ? (
            <>
              {fechaHora(cSala)}
              {d.sala.estado !== 'cerrada' && (
                <>
                  {' '}
                  · <span className="cuenta">se cierra en {faltan(new Date(cSala).getTime() - ahora)}</span>
                </>
              )}
            </>
          ) : (
            'sin programar'
          )}
        </li>
      </ul>
      <div className="acciones">
        {tablero && (
          <a className="btn" href={tablero} target="_blank" rel="noreferrer">
            Abrir tablero de la sala
          </a>
        )}
        <Link className="btn" to={`/admin/salas/${d.sala.id}/configuracion`}>
          Cambiar configuración
        </Link>
        <Link className="btn" to={`/admin/salas/${d.sala.id}/mesas`}>
          Mesas y QR
        </Link>
      </div>
    </section>
  )
}

function Precierre({ d }: { d: SalaDetalle }) {
  const ronda = rondaAbierta(d.sala.estado)
  const [ver, setVer] = useState<string | null>(null)
  if (!ronda) return null
  const conInscritos = d.mesas.filter((m) => m.inscritos > 0)
  const enPrecierre = conInscritos.filter((m) => m.precierre)
  if (enPrecierre.length === 0) return null
  const salaCompleta = enPrecierre.length === conInscritos.length

  return (
    <section className="alerta alerta--exito" role="status" aria-labelledby="t-precierre">
      <strong id="t-precierre">
        {salaCompleta
          ? `Todos votaron en la sala. Puedes cerrar la ronda ${ronda}.`
          : `Todos votaron en ${enPrecierre.map((m) => m.nombre).join(', ')}. Puedes cerrar la ronda ${ronda} cuando las demás mesas terminen.`}
      </strong>
      <p>La ronda sigue abierta: los votos se pueden editar hasta que la cierres. El resultado se muestra como preliminar.</p>
      <div className="acciones">
        {salaCompleta && (
          <button className="btn btn--chico" aria-expanded={ver === 'sala'} onClick={() => setVer(ver === 'sala' ? null : 'sala')}>
            Ver resultado preliminar de la sala
          </button>
        )}
        {enPrecierre.map((m) => (
          <button key={m.id} className="btn btn--chico" aria-expanded={ver === m.id} onClick={() => setVer(ver === m.id ? null : m.id)}>
            Ver resultado de {m.nombre}
          </button>
        ))}
      </div>
      {ver && <ResultadoPreliminar d={d} mesaId={ver === 'sala' ? undefined : ver} ronda={ronda} />}
    </section>
  )
}

function ResultadoPreliminar({ d, mesaId, ronda }: { d: SalaDetalle; mesaId?: string; ronda: number }) {
  const [t, setT] = useState<TableroResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mesa = d.mesas.find((m) => m.id === mesaId) ?? d.mesas[0]
  const urlTablero = mesaId ? mesa?.url_tablero : urlTableroSala(d.sala.url_tablero, mesa?.url_tablero)

  useEffect(() => {
    if (!urlTablero) return
    setT(null)
    setError(null)
    consultar<TableroResumen>(rutaApiTablero(d.sala.id, urlTablero, mesaId))
      .then((r) => r && setT(r.datos))
      .catch((e: Error) => setError(e.message))
  }, [d.sala.id, d.version, urlTablero, mesaId])

  if (error) return <p className="alerta alerta--error">No pudimos cargar el resultado preliminar. {error}</p>
  if (!t) return <p role="status">Cargando resultado…</p>
  return (
    <div className="panel">
      <h3>
        Resultado preliminar · {mesaId ? mesa?.nombre : 'toda la sala'} · ronda {ronda}
      </h3>
      <div className="tabla-envoltura">
        <table>
          <thead>
            <tr>
              <th scope="col">Proyecto</th>
              <th scope="col" className="num">
                Votos
              </th>
              <th scope="col" className="num">
                Time to market (eje X)
              </th>
              <th scope="col" className="num">
                Generación de valor (eje Y)
              </th>
            </tr>
          </thead>
          <tbody>
            {t.proyectos_vivos.map((p) => {
              const r = p.rondas.find((x) => x.ronda === ronda)
              return (
                <tr key={p.id}>
                  <th scope="row">{p.nombre}</th>
                  <td className="num">{r?.n_votos ?? 0}</td>
                  <td className="num">{decimal(r?.eje_x)}</td>
                  <td className="num">{decimal(r?.eje_y)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {urlTablero && (
        <a href={urlTablero} target="_blank" rel="noreferrer">
          Abrir la matriz en el tablero
        </a>
      )}
    </div>
  )
}

function Mesas({ d }: { d: SalaDetalle }) {
  return (
    <section className="panel" aria-labelledby="t-mesas">
      <h2 id="t-mesas">Mesas</h2>
      {d.mesas.length === 0 ? (
        <p className="vacio">Esta sala no tiene mesas. Agrégalas en Mesas y QR.</p>
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th scope="col">Mesa</th>
                <th scope="col">Código</th>
                <th scope="col" className="num">
                  Inscritos
                </th>
                <th scope="col">Completaron</th>
                <th scope="col">Estado</th>
                <th scope="col">Enlaces</th>
              </tr>
            </thead>
            <tbody>
              {d.mesas.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.nombre}</th>
                  <td>{m.codigo}</td>
                  <td className="num">{m.inscritos}</td>
                  <td>
                    <span>
                      {m.completos} de {m.inscritos}
                    </span>
                    <div className="barra" aria-hidden="true">
                      <span style={{ width: `${m.inscritos ? (100 * m.completos) / m.inscritos : 0}%` }} />
                    </div>
                  </td>
                  <td>
                    {m.precierre ? (
                      <span className="etiqueta etiqueta--exito">Precierre</span>
                    ) : m.inscritos === 0 ? (
                      <span className="etiqueta etiqueta--apagado">Sin inscritos</span>
                    ) : (
                      <span className="etiqueta">Votando</span>
                    )}
                  </td>
                  <td>
                    <span className="enlaces">
                      <a href={m.url_tablero} target="_blank" rel="noreferrer">
                        Tablero de {m.nombre}
                      </a>
                      <a href={m.url_participante} target="_blank" rel="noreferrer">
                        Vista participante
                      </a>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Eventos({ d }: { d: SalaDetalle }) {
  return (
    <section className="panel" aria-labelledby="t-eventos">
      <h2 id="t-eventos">Bitácora de la sala</h2>
      {d.eventos.length === 0 ? (
        <p className="vacio">Aún no hay eventos.</p>
      ) : (
        <ol className="eventos">
          {d.eventos.slice(0, 20).map((ev, i) => (
            <li key={i}>
              <time dateTime={ev.at}>{fechaHora(ev.at)}</time> · {textoEvento(ev)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
