import { useEffect, useMemo, useRef, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useSala } from '../useSala'
import { useSesion } from '../sesion'
import { olvidarSala } from '../memoria'
import type { CuerpoEliminarSala } from '../../shared/api/contrato'
import { ConSala } from './EncabezadoSala'
import { Rubricas } from './Rubricas'
import type { ConfigSala, EstadoSala, Pais, SalaDetalle, Sector, TipoSala, ZonaHoraria } from '../tipos'
import { ESTADOS, LARGO_MAXIMO_EMPRESA, PAISES, SECTORES, TIPOS_SALA, ZONAS, conPunto, fechaHora, horaLocalAIso, isoAHoraLocal, zonaSala, type CampoProgramado } from '../textos'

/** QA-A-13: el resultado de cada cambio sale junto al control que lo produjo (`lugar`), no arriba de la página. */
type Aviso = { lugar: string; tono: 'exito' | 'error' | 'aviso'; texto: string } | null
/** Lo que acepta `PATCH /config`: la configuración y, desde la migración 8, el tipo de sala, la empresa y el sector. */
type CambioSala = Partial<ConfigSala> & { tipo?: TipoSala; empresa?: string | null; sector?: Sector | null }
type GuardarCampo = (cambio: Partial<ConfigSala>) => Promise<void>
type Guardar = (cambio: CambioSala, texto: string, lugar: string) => Promise<boolean>

const CAMPOS_PROGRAMADOS: CampoProgramado[] = [
  'apertura_programada_sala_at',
  'apertura_programada_r1_at',
  'cierre_programado_r1_at',
  'apertura_programada_r2_at',
  'cierre_programado_r2_at',
  'cierre_programado_sala_at',
]

/**
 * F-7 y QA-A-10: al cambiar la zona de la sala, las horas ya programadas conservan la hora del reloj en la zona nueva
 * (23:39 sigue siendo 23:39, ahora de Guatemala). Devuelve los campos con su ISO nuevo y las horas que se movieron.
 */
export function moverProgramacion(c: Partial<Record<CampoProgramado, string | null>>, de: ZonaHoraria, a: ZonaHoraria) {
  const cambio: Partial<Record<CampoProgramado, string>> = {}
  const horas: string[] = []
  if (de === a) return { cambio, horas }
  for (const campo of CAMPOS_PROGRAMADOS) {
    const v = c[campo]
    if (!v) continue
    const local = isoAHoraLocal(v, de)
    const iso = horaLocalAIso(local, a)
    if (!iso) continue
    cambio[campo] = iso
    horas.push(local.slice(11))
  }
  return { cambio, horas }
}

export function Configuracion() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const { admin } = useSesion()
  const [aviso, setAviso] = useState<Aviso>(null)
  /** QA-A-13: lo que se acaba de elegir se ve marcado de inmediato, mientras responde el servidor. */
  const [pendiente, setPendiente] = useState<Partial<ConfigSala>>({})

  const guardar: Guardar = async (cambio, texto, lugar) => {
    setAviso(null)
    setPendiente((p) => ({ ...p, ...cambio }))
    try {
      await api.patch(`/api/admin/salas/${salaId}/config`, cambio)
      await refrescar()
      setAviso({ lugar, tono: 'exito', texto })
      return true
    } catch (e) {
      setAviso({ lugar, tono: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar el cambio.' })
      return false
    } finally {
      setPendiente({})
    }
  }

  /** Para los campos que muestran su resultado al lado: si el servidor rechaza, lanza el error con su mensaje. */
  const guardarCampo: GuardarCampo = async (cambio) => {
    await api.patch(`/api/admin/salas/${salaId}/config`, cambio)
    await refrescar()
  }

  return (
    <ConSala titulo="Configuración" datos={datos} error={error}>
      {(d) => {
        const vista: SalaDetalle = { ...d, sala: { ...d.sala, config: { ...d.sala.config, ...pendiente } } }
        return (
          <>
            <p className="pista">Los cambios se aplican de inmediato y los celulares los ven en menos de 5 segundos.</p>
            {/* Orden de la preparación: el país primero (define el aviso de datos y la hora de lo programado). */}
            <PaisSala d={vista} guardar={guardar} aviso={aviso} setAviso={setAviso} />
            <TipoYCliente d={d} guardar={guardar} aviso={aviso} />
            <Visibilidad d={vista} guardar={guardar} aviso={aviso} />
            <Programacion d={d} guardarCampo={guardarCampo} />
            <Rubricas salaId={d.sala.id} version={d.version} />
            {admin?.rol === 'superadmin' && <EliminarSala d={d} />}
          </>
        )
      }}
    </ConSala>
  )
}

/** Aviso que Salas muestra al volver de eliminar una sala (`location.state`). */
export interface EstadoSalaEliminada {
  salaEliminada?: string
}

/** Estados en los que hay gente entrando o votando: el diálogo de eliminar lo advierte. */
const ESTADOS_ABIERTOS: EstadoSala[] = ['inscripcion', 'r1_abierta', 'r2_abierta']

/**
 * Pedido de Paola (21-oct): eliminar la sala, solo superadmin, en la zona final de Configuración. El diálogo pide escribir
 * el nombre exacto (el botón se habilita solo entonces), dice que no se puede deshacer y que queda un respaldo en el
 * servidor, y advierte si la sala está abierta. Al terminar vuelve a Salas con un aviso.
 */
function EliminarSala({ d }: { d: SalaDetalle }) {
  const [abierto, setAbierto] = useState(false)
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null)
  const dialogo = useRef<HTMLDialogElement>(null)
  const campo = useRef<HTMLInputElement>(null)
  const origen = useRef<HTMLButtonElement>(null)
  const navegar = useNavigate()
  const abiertaAhora = ESTADOS_ABIERTOS.includes(d.sala.estado)
  const coincide = nombre.trim() === d.sala.nombre

  useEffect(() => {
    const el = dialogo.current
    if (!abierto || !el) return
    if (!el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    }
    campo.current?.focus()
  }, [abierto])

  const cerrar = () => {
    const el = dialogo.current
    if (el?.open) {
      if (typeof el.close === 'function') el.close()
      else el.removeAttribute('open')
    }
    setAbierto(false)
    setNombre('')
    setErrorEliminar(null)
    origen.current?.focus()
  }

  const eliminar = async (e: FormEvent) => {
    e.preventDefault()
    if (!coincide || enviando) return
    setEnviando(true)
    setErrorEliminar(null)
    try {
      await api.delete(`/api/admin/salas/${encodeURIComponent(d.sala.id)}`, { confirmar: nombre.trim() } satisfies CuerpoEliminarSala)
      olvidarSala(d.sala.id)
      navegar('/admin/salas', { state: { salaEliminada: d.sala.nombre } satisfies EstadoSalaEliminada })
    } catch (err) {
      setErrorEliminar(err instanceof Error ? err.message : 'No se pudo eliminar la sala.')
      setEnviando(false)
    }
  }

  return (
    <section className="panel zona-peligro" aria-labelledby="t-eliminar-sala">
      <h2 id="t-eliminar-sala">Eliminar sala</h2>
      <p>
        Borra la sala con sus mesas, inscritos, avisos de datos aceptados, votos, bitácora y rúbricas. No se puede deshacer. Antes de borrar, el servidor guarda un
        respaldo de la base.
      </p>
      <button ref={origen} type="button" className="hz-boton hz-boton--peligro" onClick={() => setAbierto(true)}>
        Eliminar sala
      </button>
      {abierto && (
        <dialog
          ref={dialogo}
          className="dialogo-eliminar"
          aria-labelledby="eliminar-sala-titulo"
          aria-describedby="eliminar-sala-texto"
          onCancel={(e) => {
            e.preventDefault()
            cerrar()
          }}
        >
          <h2 id="eliminar-sala-titulo">¿Eliminar «{d.sala.nombre}»?</h2>
          <form onSubmit={eliminar}>
            <div id="eliminar-sala-texto" className="dialogo__texto">
              {abiertaAhora && (
                <p className="alerta alerta--error">
                  La sala está abierta ({ESTADOS[d.sala.estado].toLowerCase()}): hay gente entrando o votando. Si la eliminas, sus celulares y el tablero dejan de
                  funcionar.
                </p>
              )}
              <p>Se borran sus mesas, inscritos, avisos de datos aceptados, votos y bitácora. No se puede deshacer.</p>
              <p>Antes de borrar queda un respaldo de la base en el servidor, por si hay que recuperarla.</p>
            </div>
            <div className="campo">
              <label htmlFor="eliminar-sala-nombre">Escribe el nombre de la sala para confirmar: {d.sala.nombre}</label>
              <input
                ref={campo}
                id="eliminar-sala-nombre"
                autoComplete="off"
                spellCheck={false}
                value={nombre}
                aria-invalid={errorEliminar ? true : undefined}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            {errorEliminar && (
              <p className="alerta alerta--error" role="alert">
                {errorEliminar}
              </p>
            )}
            <div className="acciones">
              <button type="button" className="hz-boton hz-boton--secundario" onClick={cerrar}>
                Cancelar
              </button>
              <button type="submit" className="hz-boton hz-boton--destructivo" disabled={!coincide || enviando} aria-busy={enviando}>
                {enviando ? 'Eliminando…' : 'Eliminar sala'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  )
}

interface PropsSeccion {
  d: SalaDetalle
  guardar: Guardar
  aviso: Aviso
}

/** El aviso del último cambio, si fue en este lugar. */
function AvisoEn({ aviso, lugar }: { aviso: Aviso; lugar: string }) {
  if (!aviso || aviso.lugar !== lugar) return null
  return (
    <p className={`alerta alerta--${aviso.tono} aviso-campo`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
      {aviso.texto}
    </p>
  )
}

function Opcion({ children, ...input }: { children: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="opcion">
      <input {...input} />
      <span>{children}</span>
    </label>
  )
}

function Visibilidad({ d, guardar, aviso }: PropsSeccion) {
  const c = d.sala.config
  return (
    <section className="panel" aria-labelledby="t-visibilidad">
      <h2 id="t-visibilidad">Qué ven los participantes</h2>
      <div className="rejilla rejilla--campos">
        <fieldset>
          <legend>Alcance de los resultados</legend>
          <Opcion type="radio" name="alcance" checked={c.alcance_resultados === 'sala'} onChange={() => guardar({ alcance_resultados: 'sala' }, 'Ahora todos ven el resultado de toda la sala.', 'alcance')}>
            Todos ven la sala completa <span className="etiqueta">Por defecto</span>
            <small>Promedio de todas las mesas en una sola matriz.</small>
          </Opcion>
          <Opcion type="radio" name="alcance" checked={c.alcance_resultados === 'mesa'} onChange={() => guardar({ alcance_resultados: 'mesa' }, 'Ahora cada mesa ve solo su resultado.', 'alcance')}>
            Cada mesa ve su resultado
            <small>Cada mesa funciona como una empresa y discute su propia matriz.</small>
          </Opcion>
          <AvisoEn aviso={aviso} lugar="alcance" />
        </fieldset>
        <fieldset>
          <legend>Después de votar</legend>
          <Opcion
            type="radio"
            name="vista"
            checked={c.vista_participante === 'en_vivo'}
            onChange={() => guardar({ vista_participante: 'en_vivo' }, 'Tras votar, el participante ve el resultado en vivo.', 'vista')}
          >
            Resultado en vivo <span className="etiqueta">Por defecto</span>
            {/* D2: el consolidado en vivo se renueva de 3 en 3 votos. */}
            <small>Apenas vota, cada persona ve el resultado consolidado. Se renueva cada 3 votos nuevos, así nadie deduce el voto de otro. Al cerrar la ronda se muestra el resultado final.</small>
          </Opcion>
          <Opcion
            type="radio"
            name="vista"
            checked={c.vista_participante === 'registrado'}
            onChange={() => guardar({ vista_participante: 'registrado' }, 'Tras votar, el participante ve «Voto registrado».', 'vista')}
          >
            Voto registrado
            <small>Ven el progreso de su mesa hasta que todos en su mesa voten o cierres la ronda.</small>
          </Opcion>
          <AvisoEn aviso={aviso} lugar="vista" />
        </fieldset>
        <fieldset>
          <legend>Hojas de información</legend>
          <Opcion
            type="checkbox"
            checked={c.revelar_hojas}
            onChange={(e) =>
              guardar(
                { revelar_hojas: e.target.checked },
                e.target.checked ? 'Todos ven ahora las 6 hojas.' : 'Cada participante ve ahora solo la hoja de su perfil.',
                'hojas',
              )
            }
          >
            Mostrar las 6 hojas a todos
            <small>Se enciende sola al abrir la ronda 2. Puedes apagarla o encenderla cuando quieras.</small>
          </Opcion>
          <AvisoEn aviso={aviso} lugar="hojas" />
        </fieldset>
        <fieldset>
          <legend>Preguntas en el celular</legend>
          <Opcion
            type="radio"
            name="modo"
            checked={c.modo_preguntas !== 'guiado'}
            onChange={() => guardar({ modo_preguntas: 'automatico' }, 'Cada persona avanza sola: al responder pasa a la siguiente pregunta.', 'modo')}
          >
            Automático <span className="etiqueta">Por defecto</span>
            <small>Una pregunta por pantalla. Al responder, pasa sola a la siguiente.</small>
          </Opcion>
          <Opcion
            type="radio"
            name="modo"
            checked={c.modo_preguntas === 'guiado'}
            onChange={() => guardar({ modo_preguntas: 'guiado' }, 'Modo guiado: todos ven la pregunta que elijas en Sala en vivo.', 'modo')}
          >
            Guiado
            <small>Todos ven la misma pregunta y tú decides cuándo pasar a la siguiente, desde Sala en vivo. El tablero la muestra en grande.</small>
          </Opcion>
          <AvisoEn aviso={aviso} lugar="modo" />
        </fieldset>
      </div>
    </section>
  )
}

/**
 * País de la sala: define la ley que cita el aviso de datos y la hora de los cierres (acta del 16-oct, C4 y C6).
 * F-7 y QA-A-10: si hay horas programadas, conservan su hora de reloj en la zona nueva y el aviso lo dice.
 * QA-A-17: si la zona no es la del país, se advierte.
 */
function PaisSala({ d, guardar, aviso, setAviso }: PropsSeccion & { setAviso: (a: Aviso) => void }) {
  const c = d.sala.config
  const pais = c.pais ?? 'CO'
  const zona = zonaSala(c)
  const zonaDelPais = PAISES[pais].zona

  const cambiarZona = async (cambioBase: Partial<ConfigSala>, zonaNueva: ZonaHoraria, texto: string) => {
    const { cambio, horas } = moverProgramacion(d.sala.config, zona, zonaNueva)
    if (horas.length === 0) return void guardar(cambioBase, texto, 'pais')
    const nombreZona = ZONAS[zonaNueva].nombre.replace(/ \(.*\)$/, '')
    const ok = await guardar(
      { ...cambioBase, ...cambio },
      `${texto} Las horas programadas siguen en el mismo reloj, ahora en hora de ${nombreZona}: ${horas.join(', ')}. Revísalas en Apertura y cierre programados.`,
      'pais',
    )
    if (ok) return
    // El servidor rechazó alguna hora movida (por ejemplo, ya pasó en la zona nueva): se cambia la zona sin moverlas.
    if (await guardar(cambioBase, texto, 'pais'))
      setAviso({ lugar: 'pais', tono: 'aviso', texto: `${texto} No pudimos mantener las horas programadas en el mismo reloj: revísalas en Apertura y cierre programados.` })
  }

  return (
    <section className="panel" aria-labelledby="t-pais">
      <h2 id="t-pais">País y hora</h2>
      <div className="fila-form fila-form--corta">
        <label className="campo">
          <span>País de la sala</span>
          <select
            value={pais}
            onChange={(e) => {
              const p = e.target.value as Pais
              void cambiarZona({ pais: p, zona_horaria: PAISES[p].zona }, PAISES[p].zona, `La sala quedó en ${PAISES[p].nombre}, con hora de ${ZONAS[PAISES[p].zona].nombre}.`)
            }}
          >
            {(Object.keys(PAISES) as Pais[]).map((p) => (
              <option key={p} value={p}>
                {PAISES[p].nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Zona horaria</span>
          <select
            value={zona}
            aria-describedby={zona !== zonaDelPais ? 'zona-distinta' : undefined}
            onChange={(e) => {
              const z = e.target.value as ZonaHoraria
              void cambiarZona({ zona_horaria: z }, z, `Las aperturas y los cierres programados quedan en hora de ${ZONAS[z].nombre}.`)
            }}
          >
            {(Object.keys(ZONAS) as ZonaHoraria[]).map((z) => (
              <option key={z} value={z}>
                {ZONAS[z].nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      {zona !== zonaDelPais && (
        <p id="zona-distinta" className="alerta alerta--aviso">
          La zona no es la de {PAISES[pais].nombre} ({ZONAS[zonaDelPais].nombre}). Las aperturas y los cierres se aplican en {ZONAS[zona].nombre}. Si no es lo que quieres, elige la
          zona del país.
        </p>
      )}
      <AvisoEn aviso={aviso} lugar="pais" />
      <p className="pista">Elige el país antes de programar horas. El aviso de datos que firma cada participante cita la ley del país de la sala. La zona horaria se ajusta sola al cambiar el país.</p>
    </section>
  )
}

/**
 * QA por roles del 20-oct (inversionista): tipo de sala, empresa cliente y sector. Los ensayos no cuentan en las cifras
 * de Salas. Se guardan con `PATCH /config` como el resto de la configuración.
 */
function TipoYCliente({ d, guardar, aviso }: PropsSeccion) {
  const s = d.sala
  const tipo: TipoSala = s.tipo ?? 'taller'
  const [empresa, setEmpresa] = useState(s.empresa ?? '')
  useEffect(() => setEmpresa(s.empresa ?? ''), [s.empresa])
  const empresaGuardada = (s.empresa ?? '').trim()
  const guardarEmpresa = (e: FormEvent) => {
    e.preventDefault()
    const v = empresa.trim()
    void guardar({ empresa: v || null }, v ? `La empresa cliente quedó como «${v}».` : 'Quitamos la empresa cliente.', 'cliente')
  }
  return (
    <section className="panel" aria-labelledby="t-cliente">
      <h2 id="t-cliente">Tipo y cliente</h2>
      <div className="fila-form fila-form--corta">
        <label className="campo">
          <span>Tipo</span>
          <select
            value={tipo}
            onChange={(e) => {
              const t = e.target.value as TipoSala
              void guardar({ tipo: t }, t === 'ensayo' ? 'La sala quedó como ensayo: no cuenta en las cifras de Salas.' : 'La sala quedó como taller con cliente: cuenta en las cifras de Salas.', 'cliente')
            }}
          >
            {(Object.keys(TIPOS_SALA) as TipoSala[]).map((t) => (
              <option key={t} value={t}>
                {TIPOS_SALA[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Sector (opcional)</span>
          <select
            value={s.sector ?? ''}
            onChange={(e) => {
              const v = (e.target.value || null) as Sector | null
              void guardar({ sector: v }, v ? `El sector quedó como ${SECTORES[v]}.` : 'Quitamos el sector.', 'cliente')
            }}
          >
            <option value="">Sin definir</option>
            {(Object.keys(SECTORES) as Sector[]).map((x) => (
              <option key={x} value={x}>
                {SECTORES[x]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <form className="fila-form" onSubmit={guardarEmpresa}>
        <label className="campo">
          <span>Empresa cliente (opcional)</span>
          <input maxLength={LARGO_MAXIMO_EMPRESA} value={empresa} autoComplete="organization" onChange={(e) => setEmpresa(e.target.value)} />
        </label>
        <button className="hz-boton hz-boton--secundario" type="submit" disabled={empresa.trim() === empresaGuardada}>
          Guardar empresa
        </button>
      </form>
      <AvisoEn aviso={aviso} lugar="cliente" />
      <p className="pista">Un ensayo no cuenta en las cifras de Salas. Empresa y sector sirven para saber con quién se hizo cada taller; no se muestran a los participantes.</p>
    </section>
  )
}

/** Programación de C19-4 (S2). El servidor aplica cada campo a su hora, aunque nadie tenga el panel abierto. */
interface Paso {
  campo: CampoProgramado
  etiqueta: string
  /** Qué pasa a esa hora, en una línea (preentrega 19-oct). */
  descripcion: string
  /** «La ronda 1 se abrirá»: se completa con la fecha. */
  efecto: string
  quitado: string
  /** Por qué ya no aplica en el estado actual (null si aún aplica). */
  yaNo: (estado: EstadoSala, ronda: number) => string | null
}

const GRUPOS: { titulo: string; pasos: Paso[] }[] = [
  {
    titulo: 'Sala',
    pasos: [
      {
        campo: 'apertura_programada_sala_at',
        etiqueta: 'Abrir inscripción el',
        descripcion: 'A partir de esta hora se puede entrar con el QR.',
        efecto: 'La inscripción se abrirá',
        quitado: 'Quitamos la apertura programada de la inscripción.',
        yaNo: (e) => (e === 'preparada' ? null : 'La inscripción ya se abrió.'),
      },
      {
        campo: 'cierre_programado_sala_at',
        etiqueta: 'Cerrar la sala el',
        descripcion: 'Después de esta hora nadie más puede inscribirse ni responder. Los resultados quedan a la vista.',
        efecto: 'La sala se cerrará',
        quitado: 'Quitamos el cierre programado de la sala.',
        yaNo: () => null,
      },
    ],
  },
  {
    titulo: 'Ronda 1',
    pasos: [
      {
        campo: 'apertura_programada_r1_at',
        etiqueta: 'Abrir el',
        descripcion: 'A partir de esta hora se califica la ronda 1, individual y en silencio.',
        efecto: 'La ronda 1 se abrirá',
        quitado: 'Quitamos la apertura programada de la ronda 1.',
        yaNo: (_e, r) => (r >= 1 ? 'La ronda 1 ya se abrió.' : null),
      },
      {
        campo: 'cierre_programado_r1_at',
        etiqueta: 'Cerrar el',
        descripcion: 'Después de esta hora nadie más puede responder la ronda 1.',
        efecto: 'La ronda 1 se cerrará',
        quitado: 'Quitamos el cierre programado de la ronda 1.',
        yaNo: (e, r) => (r >= 2 || e === 'r1_cerrada' ? 'La ronda 1 ya se cerró.' : null),
      },
    ],
  },
  {
    titulo: 'Ronda 2',
    pasos: [
      {
        campo: 'apertura_programada_r2_at',
        etiqueta: 'Abrir el',
        descripcion: 'A partir de esta hora se califica la ronda 2, con discusión en la mesa.',
        efecto: 'La ronda 2 se abrirá',
        quitado: 'Quitamos la apertura programada de la ronda 2.',
        yaNo: (_e, r) => (r >= 2 ? 'La ronda 2 ya se abrió.' : null),
      },
      {
        campo: 'cierre_programado_r2_at',
        etiqueta: 'Cerrar el',
        descripcion: 'Después de esta hora nadie más puede responder la ronda 2.',
        efecto: 'La ronda 2 se cerrará',
        quitado: 'Quitamos el cierre programado de la ronda 2.',
        yaNo: (e) => (e === 'r2_cerrada' ? 'La ronda 2 ya se cerró.' : null),
      },
    ],
  },
]

/** Hora del servidor que avanza cada segundo: el desfase se mide al recibir `servidor_at`. */
function HoraServidor({ servidorAt, zona }: { servidorAt?: string; zona: ZonaHoraria }) {
  const desfase = useMemo(() => (servidorAt ? Date.parse(servidorAt) - Date.now() : 0), [servidorAt])
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const instante = new Date(ahora + desfase)
  return (
    <p className="pista">
      {servidorAt ? 'Hora del servidor' : 'Hora de este equipo'}:{' '}
      <time dateTime={instante.toISOString()} className="cuenta">
        {instante.toLocaleString('es-CO', { timeZone: zona, dateStyle: 'medium', timeStyle: 'medium' })}
      </time>
    </p>
  )
}

function Programacion({ d, guardarCampo }: { d: SalaDetalle; guardarCampo: GuardarCampo }) {
  const c = d.sala.config
  const zona = zonaSala(c)
  const ronda = d.sala.ronda_actual ?? 0
  return (
    <section className="panel" aria-labelledby="t-programacion">
      <h2 id="t-programacion">Apertura y cierre programados</h2>
      <p className="pista">
        Hora de {ZONAS[zona].nombre}. A esa hora el servidor abre o cierra solo, aunque nadie tenga el panel abierto. Si en ese momento no aplica (por
        ejemplo, la ronda ya está abierta), lo descarta y lo anota en la bitácora. Los botones de Sala en vivo siguen funcionando.
      </p>
      <HoraServidor servidorAt={d.servidor_at} zona={zona} />
      <div className="rejilla">
        {GRUPOS.map((g) => (
          <fieldset key={g.titulo}>
            <legend>{g.titulo}</legend>
            {g.pasos.map((p) => (
              <CampoHora
                key={p.campo}
                id={p.campo}
                zona={zona}
                etiqueta={p.etiqueta}
                descripcion={p.descripcion}
                valor={c[p.campo] ?? null}
                bloqueo={d.sala.estado === 'cerrada' ? 'La sala está cerrada.' : p.yaNo(d.sala.estado, ronda)}
                alGuardar={(iso) => guardarCampo({ [p.campo]: iso })}
                exito={(iso) => (iso ? conPunto(`${p.efecto} el ${fechaHora(iso, zona)}`) : p.quitado)}
              />
            ))}
          </fieldset>
        ))}
      </div>
    </section>
  )
}

/**
 * Fecha y hora en la zona de la sala, con Programar y Quitar. El resultado sale junto al campo; los rechazos del
 * servidor (422 HORA_PASADA, 422 ORDEN_INVALIDO) se muestran tal cual.
 */
function CampoHora({
  id,
  zona,
  etiqueta,
  descripcion,
  valor,
  alGuardar,
  exito,
  bloqueo,
}: {
  id: string
  zona: ZonaHoraria
  etiqueta: string
  descripcion: string
  valor: string | null
  /** Por qué ya no se puede programar (null si se puede). */
  bloqueo: string | null
  alGuardar: (iso: string | null) => Promise<void>
  exito: (iso: string | null) => string
}) {
  const [local, setLocal] = useState(isoAHoraLocal(valor, zona))
  const [resultado, setResultado] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null)
  const [guardando, setGuardando] = useState(false)
  useEffect(() => setLocal(isoAHoraLocal(valor, zona)), [valor, zona])

  const enviar = async (iso: string | null) => {
    setGuardando(true)
    setResultado(null)
    try {
      await alGuardar(iso)
      setResultado({ tono: 'exito', texto: exito(iso) })
    } catch (e) {
      setResultado({ tono: 'error', texto: e instanceof Error ? e.message : 'No se pudo guardar la hora.' })
    } finally {
      setGuardando(false)
    }
  }

  const programar = () => {
    const iso = horaLocalAIso(local, zona)
    if (!iso) return setResultado({ tono: 'error', texto: 'Elige fecha y hora completas.' })
    void enviar(iso)
  }

  const describe = [`${id}-descripcion`, bloqueo && `${id}-bloqueo`, resultado && `${id}-resultado`].filter(Boolean).join(' ')
  return (
    // La etiqueta va sola arriba y la caja con sus dos botones en una fila: alineados aunque los botones bajen de línea.
    <div className="campo-hora">
      <label className="campo-hora__etiqueta" htmlFor={id} id={`${id}-etiqueta`}>
        {etiqueta}
      </label>
      <div className="campo-hora__fila">
        <input
          id={id}
          type="datetime-local"
          value={local}
          disabled={bloqueo !== null}
          aria-invalid={resultado?.tono === 'error' ? true : undefined}
          aria-describedby={describe}
          onChange={(e) => setLocal(e.target.value)}
        />
        <button className="hz-boton hz-boton--secundario" type="button" onClick={programar} disabled={bloqueo !== null || guardando} aria-describedby={`${id}-etiqueta`}>
          Programar
        </button>
        <button className="hz-boton hz-boton--secundario" type="button" disabled={!valor || guardando} onClick={() => void enviar(null)} aria-describedby={`${id}-etiqueta`}>
          Quitar
        </button>
      </div>
      <p id={`${id}-descripcion`} className="pista campo-hora__nota">
        {descripcion}
      </p>
      {bloqueo && (
        <p id={`${id}-bloqueo`} className="pista campo-hora__nota">
          <strong>{bloqueo}</strong>
        </p>
      )}
      {resultado && (
        <p id={`${id}-resultado`} className={`alerta alerta--${resultado.tono} campo-hora__nota`} role={resultado.tono === 'error' ? 'alert' : 'status'}>
          {resultado.texto}
        </p>
      )}
    </div>
  )
}
