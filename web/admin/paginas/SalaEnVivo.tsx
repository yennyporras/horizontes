import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, consultar } from '../api'
import { useSala } from '../useSala'
import { useConfirmar } from '../componentes/Confirmar'
import { ConSala } from './EncabezadoSala'
import { ComoVoto } from '../../tablero'
import type { CriterioId } from '../../shared/api/contrato'
import { descripcionCriterio } from '../../shared/criterios'
import type { Accion, PreguntaGuiada, RondaVivo, SalaDetalle, TableroResumen } from '../tipos'
import { nombreCriterio, nombreProyecto, numeroPregunta, ordenPreguntas, useContenidoSala, type ContenidoSala } from '../contenido'
import {
  ACCIONES,
  CONFIRMACIONES,
  ES_DESTRUCTIVA,
  MODOS_TABLERO,
  PASO_SIGUIENTE,
  QUE_PASA,
  TECLAS_TABLERO,
  ZONAS,
  accionesParaCorregir,
  bitacora,
  confirmacionCierreRonda,
  decimal,
  enEsteServidor,
  faltan,
  fechaHora,
  estadoMesa,
  programaciones,
  rondaAbierta,
  rutaApiTablero,
  urlTableroSala,
  urlVistaPrevia,
  conModo,
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

/**
 * Orden de la vista (QA-A-05): primero las cifras y el control (el paso que sigue queda arriba aunque se abra un
 * resultado), luego la pregunta guiada y el resultado preliminar, y después «Ver en vivo», el único lugar con los
 * accesos al tablero y a la vista previa del celular (QA-A-03).
 */
export function SalaEnVivo() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [verResultado, setVerResultado] = useState<string | null>(null)
  const contenido = useContenidoSala(datos)

  return (
    <ConSala titulo="Sala en vivo" datos={datos} error={error}>
      {(d) => (
        <>
          <Cifras d={d} />
          <Control d={d} salaId={d.sala.id} refrescar={refrescar} verResultado={verResultado} setVerResultado={setVerResultado} />
          {d.sala.config.modo_preguntas === 'guiado' && <PreguntaEnPantalla d={d} contenido={contenido} refrescar={refrescar} />}
          {verResultado && rondaAbierta(d.sala.estado) && (
            <ResultadoPreliminar key={verResultado} d={d} mesaId={verResultado === 'sala' ? undefined : verResultado} ronda={rondaAbierta(d.sala.estado)!} />
          )}
          <VerEnVivo d={d} refrescar={refrescar} />
          {d.sala.ronda_actual ? <ComoVotoSala d={d} /> : null}
          <Mesas d={d} />
          <Eventos d={d} contenido={contenido} />
        </>
      )}
    </ConSala>
  )
}

/** Personas activas que aún no completan la ronda abierta, y cuántas hay inscritas. */
function avance(d: SalaDetalle) {
  const inscritos = d.mesas.reduce((s, m) => s + m.inscritos, 0)
  const completos = d.mesas.reduce((s, m) => s + m.completos, 0)
  return { inscritos, completos, pendientes: Math.max(0, inscritos - completos) }
}

interface PropsControl {
  d: SalaDetalle
  salaId: string
  refrescar: () => Promise<void>
  verResultado: string | null
  setVerResultado: (v: string | null) => void
}

/**
 * Control de la sala (QA-A-01 y QA-A-05): un solo botón principal, el paso que sigue, con una línea de qué pasa.
 * Debajo, aparte, solo las acciones posibles para corregir; las que borran o cierran van en rojo y piden confirmación.
 * Las acciones que no aplican en el estado actual no se muestran.
 */
function Control({ d, salaId, refrescar, verResultado, setVerResultado }: PropsControl) {
  const [errorAccion, setErrorAccion] = useState<string | null>(null)
  const [enCurso, setEnCurso] = useState<Accion | null>(null)
  const [dialogo, confirmar] = useConfirmar()
  const estado = d.sala.estado
  const siguiente = PASO_SIGUIENTE[estado]
  const corregir = accionesParaCorregir(estado)
  const ronda = rondaAbierta(estado)

  const ejecutar = async (accion: Accion) => {
    const { pendientes, inscritos } = avance(d)
    const c = accion === 'cerrar_ronda_1' || accion === 'cerrar_ronda_2' ? confirmacionCierreRonda(ronda ?? 1, pendientes, inscritos) : CONFIRMACIONES[accion]
    // Cerrar la sala al final del taller es el paso normal: se confirma, pero no se presenta como algo que borra.
    const tono = ES_DESTRUCTIVA[accion] && accion !== siguiente ? 'destructivo' : 'primario'
    if (c && !(await confirmar(c.titulo, c.texto, c.boton, { tono }))) return
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

  const boton = (a: Accion, clase: string) => (
    <button
      key={a}
      type="button"
      className={`hz-boton ${clase}`}
      disabled={enCurso !== null}
      aria-busy={enCurso === a}
      aria-describedby={`que-pasa-${a}`}
      onClick={() => void ejecutar(a)}
    >
      {enCurso === a ? 'Aplicando…' : ACCIONES[a]}
    </button>
  )

  return (
    <section className="panel" aria-labelledby="t-control">
      {dialogo}
      <h2 id="t-control">Control de la sala</h2>
      <AvisoPrecierre d={d} ver={verResultado} setVer={setVerResultado} />
      <div className="paso-siguiente">
        <p className="paso-siguiente__rotulo">Paso que sigue</p>
        {siguiente ? (
          <>
            {boton(siguiente, 'hz-boton--primario')}
            <p id={`que-pasa-${siguiente}`} className="pista">
              {QUE_PASA[siguiente]}
            </p>
            {/* Orden del taller (menú): antes de abrir la inscripción se prepara la sala. */}
            {estado === 'preparada' && (
              <p className="pista">
                Antes de abrir, revisa <Link to={`/admin/salas/${d.sala.id}/configuracion`}>Configuración</Link>,{' '}
                <Link to={`/admin/salas/${d.sala.id}/hojas`}>Hojas</Link> y <Link to={`/admin/salas/${d.sala.id}/mesas`}>Mesas y QR</Link>.
              </p>
            )}
          </>
        ) : (
          <>
            <Link className="hz-boton hz-boton--primario" to={`/admin/salas/${d.sala.id}/export`}>
              Descargar los datos
            </Link>
            <p className="pista">El taller terminó. En Exportar están los inscritos y los votos.</p>
          </>
        )}
      </div>
      {errorAccion && (
        <p className="alerta alerta--error" role="alert">
          {errorAccion}
        </p>
      )}
      {corregir.length > 0 && (
        <div className="corregir" role="group" aria-labelledby="t-corregir">
          <h3 id="t-corregir">Corregir</h3>
          <p className="pista">Para deshacer un paso o terminar antes de tiempo. Lo que borra o cierra pide confirmación.</p>
          <ul className="corregir__lista">
            {corregir.map((a) => (
              <li key={a}>
                {boton(a, ES_DESTRUCTIVA[a] ? 'hz-boton--peligro' : 'hz-boton--secundario')}
                <span id={`que-pasa-${a}`} className="pista">
                  {QUE_PASA[a]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Programado d={d} />
    </section>
  )
}

/** Cifras de la sala arriba de la vista: ronda, inscritos, avance de la ronda y mesas. */
function Cifras({ d }: { d: SalaDetalle }) {
  const ronda = rondaAbierta(d.sala.estado)
  const { inscritos, completos } = avance(d)
  const cifras = [
    { rotulo: ronda || !d.sala.ronda_actual ? 'Ronda en curso' : 'Última ronda', valor: ronda ?? (d.sala.ronda_actual || 'Ninguna') },
    { rotulo: 'Inscritos', valor: inscritos },
    { rotulo: ronda ? `Completaron la ronda ${ronda}` : 'Completaron la ronda', valor: `${completos} de ${inscritos}` },
    { rotulo: 'Mesas', valor: d.mesas.length },
  ]
  return (
    <ul className="kpis" aria-label="Estado de la sala">
      {cifras.map((c) => (
        <li key={c.rotulo} className="kpi">
          <span className="kpi__rotulo">{c.rotulo}</span>
          <span className="cifra">{c.valor}</span>
        </li>
      ))}
    </ul>
  )
}

/** Aperturas y cierres programados con cuenta regresiva, en la hora de la sala (QA-A-17: dice cuál es). */
function Programado({ d }: { d: SalaDetalle }) {
  const ahora = useAhora()
  const programados = programaciones(d.sala.config)
  const zona = zonaSala(d.sala.config)

  return (
    <div className="programado-bloque">
      <h3>Programado</h3>
      {programados.length > 0 && <p className="pista">Horas de {ZONAS[zona].nombre}.</p>}
      <ul className="pista programado" aria-label="Programado">
        {programados.length === 0 ? (
          <li>Sin aperturas ni cierres programados.</li>
        ) : (
          programados.map((p) => (
            <li key={p.texto}>
              {p.texto}: {fechaHora(p.at, zona)}
              {new Date(p.at).getTime() > ahora && (
                <>
                  {' '}
                  · <span className="cuenta">faltan {faltan(new Date(p.at).getTime() - ahora)}</span>
                </>
              )}
            </li>
          ))
        )}
      </ul>
      <Link to={`/admin/salas/${d.sala.id}/configuracion`}>Cambiar la programación en Configuración</Link>
    </div>
  )
}

const mismaPregunta = (a: PreguntaGuiada, b: PreguntaGuiada) => a.proyecto_id === b.proyecto_id && a.criterio_id === b.criterio_id

/**
 * Modo guiado (C19-5): todos los celulares muestran la pregunta que elige el admin. Anterior y Siguiente recorren
 * los proyectos vivos y, en cada uno, los 6 criterios; la lista salta a cualquiera. QA-A-07: «Quitar la pregunta»
 * vuelve a mostrar la matriz en el tablero. QA-A-08: la numeración es la del tablero, «Pregunta N de 6» por proyecto.
 */
function PreguntaEnPantalla({ d, contenido, refrescar }: { d: SalaDetalle; contenido: ContenidoSala; refrescar: () => Promise<void> }) {
  const ronda = rondaAbierta(d.sala.estado)
  const actual = d.sala.pregunta_guiada ?? null
  const orden = ordenPreguntas(contenido)
  const indice = actual ? orden.findIndex((q) => mismaPregunta(q, actual)) : -1
  const [elegida, setElegida] = useState<PreguntaGuiada | null>(actual)
  const vista = elegida ?? orden[0] ?? null
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (actual) setElegida(actual)
  }, [actual?.proyecto_id, actual?.criterio_id])

  const mostrar = async (p: PreguntaGuiada | null) => {
    setEnviando(true)
    setError(null)
    try {
      await api.put(`/api/admin/salas/${d.sala.id}/pregunta-guiada`, p)
      await refrescar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cambiar la pregunta.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="t-guiada">
      <h2 id="t-guiada">Pregunta en pantalla</h2>
      {!ronda ? (
        <p className="pista">Modo guiado. Al abrir una ronda, aquí eliges qué pregunta ven todos los celulares y el tablero.</p>
      ) : (
        <>
          <div className="pregunta-actual" role="status">
            {actual ? (
              <>
                <p className="pista">
                  {numeroPregunta(actual, contenido.criterios).texto} · {nombreProyecto(contenido, actual.proyecto_id)} · ronda {ronda}
                </p>
                <p className="pregunta-actual__titulo">
                  {nombreProyecto(contenido, actual.proyecto_id)} · {nombreCriterio(contenido, actual.criterio_id)}
                </p>
                <p>{contenido.criterios.find((c) => c.id === actual.criterio_id)?.pregunta}</p>
              </>
            ) : (
              <p>Sin pregunta en pantalla: el tablero muestra la matriz y los celulares esperan. Usa Siguiente para empezar.</p>
            )}
          </div>
          <div className="acciones">
            <button className="hz-boton hz-boton--secundario" type="button" disabled={enviando || indice <= 0} onClick={() => void mostrar(orden[indice - 1])}>
              Anterior
            </button>
            <button
              className="hz-boton hz-boton--secundario"
              type="button"
              disabled={enviando || orden.length === 0 || indice === orden.length - 1}
              onClick={() => void mostrar(orden[indice + 1])}
            >
              Siguiente
            </button>
            <button className="hz-boton hz-boton--secundario" type="button" disabled={enviando || !actual} onClick={() => void mostrar(null)} aria-describedby="quitar-pregunta">
              Quitar la pregunta
            </button>
          </div>
          <p id="quitar-pregunta" className="pista">
            Quitar la pregunta vuelve a mostrar la matriz en el tablero. Los votos no cambian.
          </p>
          {vista && (
          <div className="fila-form">
            <label className="campo">
              <span>Proyecto</span>
              <select value={vista.proyecto_id} onChange={(e) => setElegida({ ...vista, proyecto_id: e.target.value })}>
                {contenido.proyectosVivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="campo">
              <span>Pregunta</span>
              <select value={vista.criterio_id} onChange={(e) => setElegida({ ...vista, criterio_id: e.target.value as CriterioId })}>
                {contenido.criterios.map((c, i) => (
                  <option key={c.id} value={c.id}>
                    {i + 1}. {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button className="hz-boton hz-boton--secundario" type="button" disabled={enviando || (actual !== null && mismaPregunta(vista, actual))} onClick={() => void mostrar(vista)}>
              Mostrar esta pregunta
            </button>
          </div>
          )}
          {error && (
            <p className="alerta alerta--error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </section>
  )
}

/** Aviso de precierre dentro del control: quién terminó y los botones para ver el resultado preliminar. */
function AvisoPrecierre({ d, ver, setVer }: { d: SalaDetalle; ver: string | null; setVer: (v: string | null) => void }) {
  const ronda = rondaAbierta(d.sala.estado)
  if (!ronda) return null
  const conInscritos = d.mesas.filter((m) => m.inscritos > 0)
  const enPrecierre = conInscritos.filter((m) => m.precierre)
  if (enPrecierre.length === 0) return null
  const salaCompleta = enPrecierre.length === conInscritos.length
  const alternar = (v: string) => setVer(ver === v ? null : v)

  return (
    <section className="alerta alerta--exito" role="status" aria-labelledby="t-precierre">
      <strong id="t-precierre">
        {salaCompleta
          ? `Todos votaron en la sala. Puedes cerrar la ronda ${ronda}.`
          : `Todos votaron en ${enPrecierre.map((m) => m.nombre).join(', ')}. Puedes cerrar la ronda ${ronda} cuando las demás mesas terminen.`}
      </strong>
      {/* D2: el resultado en vivo es una foto que se renueva de 3 en 3 votos; al cerrar la ronda queda el exacto. */}
      <p>La ronda sigue abierta y los votos se pueden editar hasta que la cierres. El resultado preliminar se renueva cada 3 votos nuevos; al cerrar la ronda queda el exacto.</p>
      <div className="acciones">
        {salaCompleta && (
          <button type="button" className="hz-boton hz-boton--secundario hz-boton--chico" aria-expanded={ver === 'sala'} onClick={() => alternar('sala')}>
            Ver resultado preliminar de la sala
          </button>
        )}
        {enPrecierre.map((m) => (
          <button key={m.id} type="button" className="hz-boton hz-boton--secundario hz-boton--chico" aria-expanded={ver === m.id} onClick={() => alternar(m.id)}>
            Ver resultado de {m.nombre}
          </button>
        ))}
      </div>
    </section>
  )
}

/**
 * Resultado preliminar de la sala o de una mesa. F-8: mientras llega la lectura nueva se conserva la anterior (no
 * parpadea) y una respuesta vieja que llega tarde no pisa a la nueva.
 */
function ResultadoPreliminar({ d, mesaId, ronda }: { d: SalaDetalle; mesaId?: string; ronda: number }) {
  const [t, setT] = useState<TableroResumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mesa = d.mesas.find((m) => m.id === mesaId) ?? d.mesas[0]
  const urlTablero = mesaId ? mesa?.url_tablero : urlTableroSala(d.sala.url_tablero, mesa?.url_tablero)

  useEffect(() => {
    if (!urlTablero) return
    let vigente = true
    consultar<TableroResumen>(rutaApiTablero(d.sala.id, urlTablero, mesaId))
      .then((r) => {
        if (!vigente || !r) return
        setT(r.datos)
        setError(null)
      })
      .catch((e: Error) => vigente && setError(e.message))
    return () => {
      vigente = false
    }
  }, [d.sala.id, d.version, urlTablero, mesaId])

  const titulo = `Resultado preliminar · ${mesaId ? mesa?.nombre : 'toda la sala'} · ronda ${ronda}`
  if (!t) {
    return (
      <section className="panel" aria-label={titulo}>
        {error ? <p className="alerta alerta--error">No pudimos cargar el resultado preliminar. {error}</p> : <p role="status">Cargando resultado…</p>}
      </section>
    )
  }
  const rondas = ronda === 2 ? [1, 2] : [1]
  const minimo = t.minimo_votos ?? 3
  const bajoMinimo = t.proyectos_vivos.some((p) => p.rondas.some((r) => rondas.includes(r.ronda) && r.bajo_minimo))
  return (
    <section className="panel" aria-labelledby="t-preliminar">
      <h2 id="t-preliminar" className="titulo-3">
        {titulo}
      </h2>
      <p className="pista">Se renueva cada 3 votos nuevos. Para verlo en la matriz, usa Ver en vivo.</p>
      {error && <p className="alerta alerta--aviso">No pudimos actualizarlo. Mostramos la última lectura. {error}</p>}
      {bajoMinimo && (
        <p className="alerta alerta--info">
          Hacen falta al menos {minimo} votos para mostrar {mesaId ? 'esta mesa' : 'estos resultados'}.
        </p>
      )}
      <div className="rejilla">
        {t.proyectos_vivos.map((p) => (
          <TablaResultado key={p.id} proyecto={p} criterios={t.criterios} rondas={rondas} />
        ))}
      </div>
    </section>
  )
}

/** R1 hueco en verde y R2 sólido en rojo, siempre con su texto (se lee sin depender del color). */
function MarcaRonda({ ronda }: { ronda: number }) {
  return <span className={`ronda ronda--${ronda}`}>R{ronda}</span>
}

/** Promedios por criterio. Sin T2M, ejes ni votos (acta A3 y A4) ni fila «Total» (preentrega 19-oct: no dice nada). */
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
              <th scope="row" abbr={c.nombre}>
                {c.nombre}
                {descripcionCriterio(c.id) && <span className="tabla-criterio__desc">{descripcionCriterio(c.id)}</span>}
              </th>
              {porRonda.map((r, i) => (
                <td key={rondas[i]} className="num">
                  {valor(r, r?.promedios?.[c.id])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * QA-A-03: el único lugar con los accesos para ver la sala en vivo, cada uno con un solo nombre: «Tablero de la sala»
 * (el del proyector), «Tablero de Mesa N» y «Vista previa del celular». QA-A-04: la vista previa abre el celular en
 * modo de solo lectura (`?vista=previa`) y avisa que no hay que inscribirse ahí.
 */
function VerEnVivo({ d, refrescar }: { d: SalaDetalle; refrescar: () => Promise<unknown> | void }) {
  const [mesaId, setMesaId] = useState(d.mesas[0]?.id ?? '')
  const [dialogo, confirmar] = useConfirmar()
  const [cambiando, setCambiando] = useState(false)
  const [avisoEnlace, setAvisoEnlace] = useState<{ ok: boolean; texto: string } | null>(null)
  // B-2: si un enlace del tablero se compartió o se vio en un ensayo, uno nuevo deja sin acceso a los anteriores.
  const cambiarEnlace = async () => {
    const ok = await confirmar(
      'Cambiar el enlace del tablero',
      'Los enlaces del tablero que ya se abrieron o compartieron, de la sala y de cada mesa, dejan de funcionar. Tendrás que abrir el tablero de nuevo desde aquí.',
      'Cambiar el enlace',
      { tono: 'primario' },
    )
    if (!ok) return
    setCambiando(true)
    setAvisoEnlace(null)
    try {
      await api.post(`/api/admin/salas/${d.sala.id}/acciones`, { accion: 'regenerar_token_tablero' })
      await refrescar()
      setAvisoEnlace({ ok: true, texto: 'Listo: el tablero tiene un enlace nuevo y los anteriores ya no funcionan.' })
    } catch (e) {
      setAvisoEnlace({ ok: false, texto: `No pudimos cambiar el enlace. ${e instanceof Error ? e.message : ''}`.trim() })
    } finally {
      setCambiando(false)
    }
  }
  const mesa = d.mesas.find((m) => m.id === mesaId) ?? d.mesas[0]
  const tableroSala = enEsteServidor(urlTableroSala(d.sala.url_tablero, d.mesas[0]?.url_tablero))
  return (
    <section className="panel" aria-labelledby="t-en-vivo">
      <h2 id="t-en-vivo">Ver en vivo</h2>
      <p className="pista">Cada enlace se abre en otra pestaña y se actualiza solo.</p>
      <ul className="en-vivo">
        {tableroSala && (
          <li>
            <p className="en-vivo__titulo" id="t-tablero-sala">
              Tablero de la sala
            </p>
            <div className="acciones" role="group" aria-labelledby="t-tablero-sala">
              {MODOS_TABLERO.map((m) => (
                <a
                  key={m.modo}
                  className="hz-boton hz-boton--secundario"
                  href={conModo(tableroSala, m.modo) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  aria-describedby="ayuda-tablero-sala"
                >
                  {m.nombre}
                </a>
              ))}
            </div>
            <p id="ayuda-tablero-sala" className="pista">
              El que se proyecta, con la matriz de toda la sala. Elige el modo según el evento:{' '}
              {MODOS_TABLERO.map((m, i) => (
                <span key={m.modo}>
                  {i > 0 && '; '}
                  <strong>{m.nombre}</strong> muestra {m.ayuda}
                </span>
              ))}
              . {TECLAS_TABLERO}
            </p>
          </li>
        )}
        {mesa && (
          <li>
            <p className="en-vivo__titulo">Una mesa</p>
            <div className="en-vivo__mesa">
              <label className="campo-linea" htmlFor="ver-mesa">
                Mesa
              </label>
              <select id="ver-mesa" value={mesa.id} onChange={(e) => setMesaId(e.target.value)}>
                {d.mesas.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre} · {m.codigo}
                  </option>
                ))}
              </select>
            </div>
            <div className="acciones">
              <a className="hz-boton hz-boton--secundario" href={enEsteServidor(mesa.url_tablero) ?? undefined} target="_blank" rel="noreferrer" aria-describedby="ayuda-tablero-mesa">
                Tablero de {mesa.nombre}
              </a>
              <a className="hz-boton hz-boton--secundario" href={urlVistaPrevia(mesa.url_participante) ?? undefined} target="_blank" rel="noreferrer" aria-describedby="ayuda-vista-previa">
                Vista previa del celular
              </a>
            </div>
            <p id="ayuda-tablero-mesa" className="pista">
              El tablero de una mesa sirve para seguir su avance o proyectarla sola.
            </p>
            <p id="ayuda-vista-previa" className="pista">
              La vista previa muestra la entrada a {mesa.nombre} tal como la ve un participante, solo para mirar: no inscribe a nadie ni cuenta en el avance.
            </p>
          </li>
        )}
      </ul>
      <div className="en-vivo__enlace">
        <button type="button" className="hz-boton hz-boton--secundario" disabled={cambiando} aria-busy={cambiando} aria-describedby="ayuda-cambiar-enlace" onClick={() => void cambiarEnlace()}>
          Cambiar el enlace del tablero
        </button>
        <p id="ayuda-cambiar-enlace" className="pista">
          Si el enlace del tablero se compartió o se vio en un ensayo, crea uno nuevo: los anteriores dejan de funcionar.
        </p>
        {avisoEnlace && (
          <p className={avisoEnlace.ok ? 'alerta alerta--exito' : 'alerta alerta--error'} role={avisoEnlace.ok ? 'status' : 'alert'}>
            {avisoEnlace.texto}
          </p>
        )}
      </div>
      {dialogo}
    </section>
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

/** Avance por mesa. Sin enlaces: los tableros están en «Ver en vivo» (QA-A-03 y QA-A-25). */
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
              </tr>
            </thead>
            <tbody>
              {d.mesas.map((m) => (
                <tr key={m.id}>
                  <th scope="row">{m.nombre}</th>
                  <td data-label="Código">{m.codigo}</td>
                  <td className="num" data-label="Inscritos">
                    {m.inscritos}
                  </td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

const PRIMEROS_EVENTOS = 15

/** QA-A-15: bitácora legible, lo más reciente arriba, sin repeticiones; muestra 15 y deja ver el resto. */
function Eventos({ d, contenido }: { d: SalaDetalle; contenido: ContenidoSala }) {
  const [todos, setTodos] = useState(false)
  const lineas = bitacora(d.eventos, { mesas: d.mesas, participantes: d.participantes, contenido })
  const visibles = todos ? lineas : lineas.slice(0, PRIMEROS_EVENTOS)
  const zona = zonaSala(d.sala.config)
  return (
    <section className="panel" aria-labelledby="t-eventos">
      <h2 id="t-eventos">Bitácora de la sala</h2>
      {lineas.length === 0 ? (
        <p className="vacio">Aún no hay eventos.</p>
      ) : (
        <>
          <p className="pista">Lo más reciente arriba. Horas de {ZONAS[zona].nombre}.</p>
          <ul className="eventos" aria-label="Eventos de la sala">
            {visibles.map((l, i) => (
              <li key={`${l.at}-${i}`}>
                <time dateTime={l.at}>{fechaHora(l.at, zona)}</time>
                <span>
                  {l.texto}
                  {l.veces > 1 && <span className="eventos__veces"> · {l.veces} veces</span>}
                </span>
              </li>
            ))}
          </ul>
          {lineas.length > PRIMEROS_EVENTOS && (
            <button type="button" className="hz-boton hz-boton--secundario" aria-expanded={todos} onClick={() => setTodos((v) => !v)}>
              {todos ? 'Ver menos' : `Ver los ${lineas.length} eventos`}
            </button>
          )}
        </>
      )}
    </section>
  )
}
