import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, consultar } from '../api'
import { useSala } from '../useSala'
import { useConfirmar } from '../componentes/Confirmar'
import { ConSala } from './EncabezadoSala'
import { ComoVoto } from '../../tablero'
import type { Accion, RondaVivo, SalaDetalle, TableroResumen } from '../tipos'
import {
  ACCIONES,
  ACCIONES_POR_ESTADO,
  CONFIRMACIONES,
  ORDEN_ACCIONES,
  decimal,
  faltan,
  fechaHora,
  estadoMesa,
  rondaAbierta,
  rutaApiTablero,
  textoEvento,
  urlTableroSala,
  zonaSala,
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
          {d.sala.ronda_actual ? <ComoVotoSala d={d} /> : null}
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
  const zona = zonaSala(d.sala.config)

  return (
    <section className="panel" aria-labelledby="t-estado">
      <h2 id="t-estado">Estado</h2>
      <div className="estado-grande">
        <div>
          <span className="pista">{ronda || !d.sala.ronda_actual ? 'Ronda en curso' : 'Última ronda'}</span>
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
              {fechaHora(cRonda, zona)}
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
              {fechaHora(cSala, zona)}
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

  // El resultado va fuera del aviso: más ancho en el celular y el lector de pantalla no lo repite en cada actualización.
  return (
    <>
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
      </section>
      {ver && <ResultadoPreliminar d={d} mesaId={ver === 'sala' ? undefined : ver} ronda={ronda} />}
    </>
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
  const rondas = ronda === 2 ? [1, 2] : [1]
  const minimo = t.minimo_votos ?? 3
  const bajoMinimo = t.proyectos_vivos.some((p) => p.rondas.some((r) => rondas.includes(r.ronda) && r.bajo_minimo))
  return (
    <div className="panel">
      <h3>
        Resultado preliminar · {mesaId ? mesa?.nombre : 'toda la sala'} · ronda {ronda}
      </h3>
      {bajoMinimo && (
        <p className="alerta alerta--info">
          Hace falta al menos {minimo} votos para mostrar {mesaId ? 'esta mesa' : 'estos resultados'}.
        </p>
      )}
      <div className="rejilla">
        {t.proyectos_vivos.map((p) => (
          <TablaResultado key={p.id} proyecto={p} criterios={t.criterios} rondas={rondas} />
        ))}
      </div>
      {urlTablero && (
        <a href={urlTablero} target="_blank" rel="noreferrer">
          Abrir la matriz en el tablero
        </a>
      )}
    </div>
  )
}

/** R1 hueco en verde y R2 sólido en rojo, siempre con su texto (se lee sin depender del color). */
function MarcaRonda({ ronda }: { ronda: number }) {
  return <span className={`ronda ronda--${ronda}`}>R{ronda}</span>
}

/** Promedios por criterio y la fila «Total» (eje X + eje Y, del servidor). Sin T2M, ejes ni votos (acta A3 y A4). */
function TablaResultado({ proyecto, criterios, rondas }: { proyecto: TableroResumen['proyectos_vivos'][number]; criterios: TableroResumen['criterios']; rondas: number[] }) {
  const porRonda = rondas.map((n) => proyecto.rondas.find((r) => r.ronda === n))
  const valor = (r: RondaVivo | undefined, v: number | null | undefined) => (r?.bajo_minimo ? 'Faltan votos' : decimal(v))
  return (
    <div className="tabla-envoltura">
      <table className="tabla-resultado">
        <caption>{proyecto.nombre}</caption>
        <thead>
          <tr>
            <th scope="col">Criterio</th>
            {rondas.map((n) => (
              <th key={n} scope="col" className="num">
                <MarcaRonda ronda={n} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criterios.map((c) => (
            <tr key={c.id}>
              <th scope="row">{c.nombre}</th>
              {porRonda.map((r, i) => (
                <td key={rondas[i]} className="num">
                  {valor(r, r?.promedios?.[c.id])}
                </td>
              ))}
            </tr>
          ))}
          <tr className="fila-total">
            <th scope="row">Total</th>
            {porRonda.map((r, i) => (
              <td key={rondas[i]} className="num">
                {valor(r, r?.total)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

/**
 * «Cómo votó la sala» (o una mesa) para la plenaria: conteo 1-3-5-7-9 por criterio en R1 y R2, del mismo
 * tablero que ve el proyector. Se relee con cada cambio de la sala (version).
 */
function ComoVotoSala({ d }: { d: SalaDetalle }) {
  const [mesaId, setMesaId] = useState('')
  const [t, setT] = useState<TableroResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mesa = d.mesas.find((m) => m.id === mesaId)
  const urlTablero = mesa ? mesa.url_tablero : urlTableroSala(d.sala.url_tablero, d.mesas[0]?.url_tablero)

  useEffect(() => {
    if (!urlTablero) return
    let vigente = true
    consultar<TableroResumen>(rutaApiTablero(d.sala.id, urlTablero, mesa?.id))
      .then((r) => {
        if (vigente && r) {
          setT(r.datos)
          setError(null)
        }
      })
      .catch((e: Error) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [d.sala.id, d.version, urlTablero, mesa?.id])

  if (!urlTablero) return null
  const alcance = (
    <label className="campo-linea">
      <span>Alcance</span>
      <select className="chico" value={mesaId} onChange={(e) => setMesaId(e.target.value)}>
        <option value="">Toda la sala</option>
        {d.mesas.map((m) => (
          <option key={m.id} value={m.id}>
            {m.nombre}
          </option>
        ))}
      </select>
    </label>
  )
  return (
    <div className="panel">
      {error ? (
        <p className="alerta alerta--error" role="alert">
          No pudimos cargar cómo votó la sala. {error}
        </p>
      ) : !t ? (
        <p role="status">Cargando cómo votó la sala…</p>
      ) : (
        <ComoVoto datos={t} rondas={d.sala.ronda_actual === 2 ? [1, 2] : [1]} controles={alcance} />
      )}
    </div>
  )
}

function EtiquetaMesa({ estado, mesa }: { estado: SalaDetalle['sala']['estado']; mesa: SalaDetalle['mesas'][number] }) {
  const { texto, tono } = estadoMesa(estado, mesa)
  return <span className={tono ? `etiqueta etiqueta--${tono}` : 'etiqueta'}>{texto}</span>
}

function Mesas({ d }: { d: SalaDetalle }) {
  return (
    <section className="panel" aria-labelledby="t-mesas">
      <h2 id="t-mesas">Mesas</h2>
      {d.mesas.length === 0 ? (
        <p className="vacio">Esta sala no tiene mesas. Agrégalas en Mesas y QR.</p>
      ) : (
        <div className="tabla-envoltura">
          <table className="tabla-tarjetas">
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
                  <td data-label="Código">{m.codigo}</td>
                  <td className="num" data-label="Inscritos">{m.inscritos}</td>
                  <td data-label="Completaron">
                    <span>
                      {m.completos} de {m.inscritos}
                    </span>
                    <div className="barra" aria-hidden="true">
                      <span style={{ width: `${m.inscritos ? (100 * m.completos) / m.inscritos : 0}%` }} />
                    </div>
                  </td>
                  <td data-label="Estado">
                    <EtiquetaMesa estado={d.sala.estado} mesa={m} />
                  </td>
                  <td data-label="Enlaces">
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
              <time dateTime={ev.at}>{fechaHora(ev.at, zonaSala(d.sala.config))}</time> · {textoEvento(ev)}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
