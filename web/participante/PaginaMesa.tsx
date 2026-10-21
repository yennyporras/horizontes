import { lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Aviso, BarraProgreso, Boton, Icono } from '../shared/ui'
import { canjearAcceso, ErrorApi, obtenerMesa, type EstadoSala, type Mesa, type RespuestaVoto, type Sesion, type Yo } from './api'
import { usarFuenteLista } from './fuente'
import { encolar, enviarCola, leerCola, nuevoId, quitar as quitarDeCola, type VotoEnCola } from './cola'
import { Cargando, Marco, Mensaje, type MarcoBase } from './Comun'
import { Inscripcion } from './pantallas/Inscripcion'
import { Lectura, type PestanaLectura } from './pantallas/Lectura'
import { CierrePersonal, MIN_VOTOS, ResultadoAlcance, rondaOculta, resultadoVisible, TEXTO_R1_OCULTA, textoAlcance, vistaMatriz } from './pantallas/Resultado'
import { Calificar, ElegirProyecto, PreguntaGuiada, proyectosVivos, votoDe } from './pantallas/Votacion'
import { bienvenidaPendiente, guardarBorrador, guardarToken, guardarVista, leerBorrador, leerToken, leerVista, marcarBienvenida, olvidarDatos } from './sesion'
import { usarYo } from './usarYo'
import { cadaCuantos } from '../shared/votos'

// La muestra del sistema de diseño trae el mock de /api/yo: se carga aparte para no inflar el bundle.
// Solo en desarrollo: en el build no hay import y la muestra no se publica.
const MuestraUI = import.meta.env.DEV ? lazy(() => import('../shared/ui/MuestraUI').then((m) => ({ default: m.MuestraUI }))) : () => null

/**
 * Texto de la decisión D1 (20-oct): la sesión perdida la devuelve el facilitador. Habla de lo que hace la persona en
 * el salón, no del panel del facilitador (QA por roles del 20-oct).
 */
export const PIDE_ACCESO = 'Levanta la mano y pídele al facilitador que te dé acceso de nuevo: te muestra un QR para volver a entrar.'

/** Chip de la cola (QA por roles del 20-oct): qué hacer, sin asustar. */
export const TEXTO_COLA_UNA = 'Deja esta página abierta: la enviamos automáticamente cuando vuelva la señal.'
export const TEXTO_COLA_VARIAS = 'Deja esta página abierta: las enviamos automáticamente cuando vuelva la señal.'
/** Chip de sin señal, desde el tercer fallo seguido del polling. */
export const TEXTO_SIN_SENAL = 'Sin señal por ahora. Lo que marcaste sigue guardado en este celular.'

/** Aviso de conexión en una línea (chip) que flota sobre la barra inferior. */
function Chip({ tono, children }: { tono: 'alerta' | 'ok'; children: ReactNode }) {
  return (
    <p className={`hzp-chip hzp-chip--${tono}`} role="status">
      <Icono tono={tono} />
      <span>{children}</span>
    </p>
  )
}

// Flujo del participante (DISENO §8). Ruta /m/:codigo; /m/_ui es la muestra del sistema de diseño.
export default function PaginaMesa() {
  const { codigo = '' } = useParams()
  // La muestra solo existe en desarrollo: en el build, /m/_ui es un código de mesa más (no existe).
  if (import.meta.env.DEV && codigo === '_ui')
    return (
      <Suspense fallback={<Cargando />}>
        <MuestraUI />
      </Suspense>
    )
  return <FlujoMesa key={codigo} codigo={codigo} />
}

function FlujoMesa({ codigo }: { codigo: string }) {
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [token, setToken] = useState<string | null>(() => leerToken(codigo))
  // Enlace de acceso nuevo (D1): /m/{codigo}?acceso=… lo genera el facilitador con «Dar acceso de nuevo».
  const [acceso, setAcceso] = useState<string | null>(() => new URLSearchParams(ubicacion.search).get('acceso'))
  const [reingreso, setReingreso] = useState(false)
  // QA-A-04: «Vista previa del celular» del panel. Muestra la entrada a la mesa tal como la ve el participante, sin
  // inscribir a nadie ni usar la sesión que hubiera en este navegador.
  const previa = new URLSearchParams(ubicacion.search).get('vista') === 'previa'

  // El enlace es de un solo uso: sale de la URL apenas se lee, así no queda en el historial ni se comparte con la pantalla.
  useEffect(() => {
    const params = new URLSearchParams(ubicacion.search)
    if (!params.has('acceso')) return
    params.delete('acceso')
    const resto = params.toString()
    navegar({ pathname: ubicacion.pathname, search: resto ? `?${resto}` : '' }, { replace: true, state: ubicacion.state })
    // Solo al montar: la URL con el acceso es la de entrada.
  }, [])

  // Antes de D1 el celular guardaba nombre y correo para recuperar la sesión: si quedaron, se borran.
  useEffect(() => olvidarDatos(codigo), [codigo])

  if (previa) return <AntesDeInscribirse codigo={codigo} previa onInscrito={() => undefined} />
  if (acceso) {
    return (
      <CanjeAcceso
        acceso={acceso}
        haySesion={Boolean(token)}
        onListo={(s) => {
          guardarToken(codigo, s.token)
          marcarBienvenida(codigo, false)
          setReingreso(true)
          setToken(s.token)
          setAcceso(null)
        }}
        onSeguir={() => setAcceso(null)}
      />
    )
  }
  if (!token) {
    return (
      <AntesDeInscribirse
        codigo={codigo}
        onInscrito={(t) => {
          guardarToken(codigo, t)
          marcarBienvenida(codigo, true)
          setToken(t)
        }}
      />
    )
  }
  return <Participante key={token} codigo={codigo} token={token} reingreso={reingreso} />
}

// ── Acceso nuevo (D1): canje del enlace de un solo uso ─────────────────────

/**
 * Un canje por enlace: en desarrollo React monta los efectos dos veces y el segundo POST encontraría el acceso
 * ya usado. Si el canje falla se olvida, para poder reintentar.
 */
const canjes = new Map<string, Promise<Sesion>>()
function canjeUnico(acceso: string): Promise<Sesion> {
  let p = canjes.get(acceso)
  if (!p) {
    p = canjearAcceso(acceso)
    canjes.set(acceso, p)
    p.catch(() => canjes.delete(acceso))
  }
  return p
}

function CanjeAcceso({ acceso, haySesion, onListo, onSeguir }: { acceso: string; haySesion: boolean; onListo: (s: Sesion) => void; onSeguir: () => void }) {
  const [error, setError] = useState<ErrorApi | null>(null)
  const [intento, setIntento] = useState(0)
  const listo = useRef(onListo)
  listo.current = onListo

  useEffect(() => {
    let vivo = true
    setError(null)
    canjeUnico(acceso)
      .then((s) => vivo && listo.current(s))
      .catch((e: unknown) => vivo && setError(e instanceof ErrorApi ? e : new ErrorApi(0, 'SIN_RED', 'Sin conexión')))
    return () => {
      vivo = false
    }
  }, [acceso, intento])

  if (!error) return <Cargando />
  const reintentar = { texto: 'Reintentar', onClick: () => setIntento((i) => i + 1) }
  const seguir = haySesion ? { texto: 'Seguir con mi sesión en este celular', onClick: onSeguir } : undefined
  if (error.esRed) {
    return (
      <Mensaje titulo="Sin conexión" accion={reintentar}>
        No pudimos usar tu enlace de acceso. Revisa la señal y vuelve a intentarlo.
      </Mensaje>
    )
  }
  if (error.status === 429) {
    return (
      <Mensaje titulo="Demasiados intentos" accion={reintentar}>
        Espera un minuto y vuelve a intentarlo con el mismo enlace.
      </Mensaje>
    )
  }
  if (error.codigo === 'SALA_CERRADA') {
    return (
      <Mensaje titulo="El taller ya terminó" accion={seguir}>
        Esta sala cerró y ya no da acceso nuevo. Gracias por participar.
      </Mensaje>
    )
  }
  if (error.status === 403 || error.codigo === 'PARTICIPANTE_INACTIVO') return <Desactivado />
  if (error.status === 410 || error.codigo === 'ACCESO_VENCIDO') {
    return (
      <Mensaje titulo="Este enlace ya venció" accion={seguir}>
        Los enlaces para entrar de nuevo duran 15 minutos y sirven una sola vez. Pídele al facilitador uno nuevo con «Dar acceso de nuevo».
      </Mensaje>
    )
  }
  if (error.status === 404 || error.codigo === 'ACCESO_INVALIDO') {
    return (
      <Mensaje titulo="Este enlace no sirve" accion={seguir}>
        Puede que ya lo hayas usado o que no esté completo. Pídele al facilitador uno nuevo con «Dar acceso de nuevo».
      </Mensaje>
    )
  }
  if (error.status >= 500) {
    return (
      <Mensaje titulo="Algo falló de nuestro lado" tono="error" accion={reintentar}>
        Vuelve a intentarlo en unos segundos.
      </Mensaje>
    )
  }
  return (
    <Mensaje titulo="No pudimos darte acceso" tono="error" accion={seguir}>
      {(error.cuerpo as { error?: { mensaje?: string } } | null)?.error?.mensaje ?? 'Pídele al facilitador que te dé acceso de nuevo.'}
    </Mensaje>
  )
}

// ── Antes de inscribirse: 8.0 a 8.3 ─────────────────────────────────────────

function AntesDeInscribirse({ codigo, onInscrito, previa = false }: { codigo: string; onInscrito: (token: string) => void; previa?: boolean }) {
  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [error, setError] = useState<ErrorApi | null>(null)
  const [intento, setIntento] = useState(0)
  const fuente = usarFuenteLista()

  useEffect(() => {
    let vivo = true
    let t: ReturnType<typeof setTimeout> | undefined
    obtenerMesa(codigo)
      .then((m) => {
        if (!vivo) return
        setMesa(m)
        setError(null)
        // Inscripción cerrada: la pantalla se actualiza sola cuando abre (o cuando el facilitador reabre una ronda).
        // Con la sala cerrada no: ya no hay nada que esperar.
        if (!m.inscripcion_abierta && m.sala.estado !== 'cerrada') t = setTimeout(() => setIntento((i) => i + 1), 5000)
      })
      .catch((e: unknown) => {
        if (!vivo) return
        const ea = e instanceof ErrorApi ? e : new ErrorApi(0, 'SIN_RED', 'Sin conexión')
        setError(ea)
        if (ea.esRed || ea.status >= 500) t = setTimeout(() => setIntento((i) => i + 1), 5000)
      })
    return () => {
      vivo = false
      if (t) clearTimeout(t)
    }
  }, [codigo, intento])

  if (error && !mesa) {
    if (error.status === 404 || error.codigo === 'MESA_NO_EXISTE') {
      return (
        <Mensaje titulo="No encontramos esta mesa">
          El código {codigo} no corresponde a ninguna mesa activa. Revisa el QR de tu mesa o pídele el enlace al facilitador.
        </Mensaje>
      )
    }
    if (error.esRed) {
      return (
        <Mensaje titulo="Sin conexión" accion={{ texto: 'Reintentar', onClick: () => setIntento((i) => i + 1) }}>
          No pudimos cargar tu mesa. Revisa la señal, seguimos intentando.
        </Mensaje>
      )
    }
    return (
      <Mensaje titulo="Algo falló de nuestro lado" tono="error" accion={{ texto: 'Reintentar', onClick: () => setIntento((i) => i + 1) }}>
        Vuelve a intentarlo en unos segundos.
      </Mensaje>
    )
  }
  if (!mesa || !fuente) return <Cargando />

  // En la vista previa el facilitador ve el formulario aunque la inscripción aún no abra.
  if (!mesa.inscripcion_abierta && !previa) {
    if (mesa.sala.estado !== 'preparada') {
      const cerrada = mesa.sala.estado === 'cerrada'
      // Con la ronda 2 cerrada la sala sigue abierta (el facilitador puede reabrir la ronda): no se dice que terminó.
      const votacionTerminada = mesa.sala.estado === 'r2_cerrada'
      return (
        <Marco sala={mesa.sala.nombre} meta={mesa.mesa.nombre} claveFoco="inscripcion-cerrada">
          <h1 className="hz-titulo">{cerrada ? 'El taller ya terminó' : votacionTerminada ? 'La votación ya terminó' : 'La inscripción está cerrada'}</h1>
          <p className="hz-texto-2">
            {cerrada
              ? 'Esta sala cerró y no recibe más inscripciones.'
              : votacionTerminada
                ? 'Las dos rondas de esta sala ya se cerraron y no recibe inscripciones nuevas.'
                : 'Esta sala no recibe inscripciones nuevas en este momento. Si llegaste tarde, pídele ayuda al facilitador.'}
          </p>
          {/* D1: con la sala cerrada no hay acceso nuevo; antes, quien ya se inscribió lo pide al facilitador. */}
          {!cerrada && <Aviso tono="info" titulo="¿Ya te inscribiste y perdiste la sesión?">{PIDE_ACCESO}</Aviso>}
        </Marco>
      )
    }
    return (
      <Mensaje sala={mesa.sala.nombre} meta={mesa.mesa.nombre} titulo="Aún no abrimos la inscripción">
        El facilitador la abrirá en unos minutos. Deja esta pantalla abierta: se actualiza automáticamente.
      </Mensaje>
    )
  }
  return <Inscripcion codigo={codigo} mesa={mesa} onInscrito={onInscrito} previa={previa} />
}

// ── Inscrito: 8.4 a 8.17 ────────────────────────────────────────────────────

type Vista = 'inicio' | 'lectura' | 'elegir' | `calificar:${string}`
/** Aviso de lo que pasó con la ronda; vale mientras la sala siga en el estado en que se dio. */
type AvisoRonda = { texto: string; tono: 'error' | 'info'; estado: EstadoSala | undefined }

const esAbierta = (e: EstadoSala | undefined) => e === 'r1_abierta' || e === 'r2_abierta'

function Participante({ codigo, token, reingreso }: { codigo: string; token: string; reingreso: boolean }) {
  const { yo, fatal, errorCarga, sinConexion, recuperada, refrescar, aplicar } = usarYo(token)
  const navegar = useNavigate()
  const ubicacion = useLocation()
  const [vista, setVistaEstado] = useState<Vista>(() => (leerVista(codigo) as Vista | null) ?? 'inicio')
  const [bienvenida, setBienvenida] = useState(() => bienvenidaPendiente(codigo))
  // Pestaña del material (caso u hoja): el botón principal de la lectura depende de ella.
  const [pestana, setPestana] = useState<PestanaLectura>('caso')
  const [avisoOk, setAvisoOk] = useState<string | null>(null)
  const [avisoReingreso, setAvisoReingreso] = useState(reingreso)
  // Votos guardados sin señal, a la espera de reenvío (sobreviven a recargas).
  const [cola, setCola] = useState<VotoEnCola[]>(() => leerCola(codigo))
  // Lo que pasó al cerrarse la ronda (o al rechazarse la cola): se queda hasta cambiar de pantalla o de ronda.
  const [avisoRonda, setAvisoRonda] = useState<AvisoRonda | null>(null)
  // Reenvío de la cola en curso: guardar en línea lo espera para que un envío viejo no llegue después.
  const envio = useRef<Promise<void> | null>(null)
  const fuente = usarFuenteLista()
  const estadoActual = useRef<EstadoSala | undefined>(undefined)
  estadoActual.current = yo?.sala.estado

  /**
   * Cada pantalla interna es una entrada del historial: el botón atrás del celular vuelve a la anterior
   * (de la pregunta a los proyectos, de los proyectos al caso) en vez de salir de la app.
   */
  const cambiarVista = useCallback(
    (v: Vista, reemplazar = false) => {
      setVistaEstado(v)
      guardarVista(codigo, v)
      navegar({ pathname: ubicacion.pathname, search: ubicacion.search }, { replace: reemplazar, state: { hzVista: v } })
    },
    [codigo, navegar, ubicacion.pathname, ubicacion.search],
  )
  const ir = useCallback(
    (v: Vista, reemplazar = false) => {
      cambiarVista(v, reemplazar)
      setAvisoReingreso(false)
      setAvisoRonda(null)
      // El material se abre siempre por el caso.
      if (v === 'lectura') setPestana('caso')
    },
    [cambiarVista],
  )

  // Atrás y adelante del navegador: la entrada trae su pantalla. La primera entrada se marca con la pantalla actual.
  const vistaHistorial = (ubicacion.state as { hzVista?: Vista } | null)?.hzVista
  useEffect(() => {
    if (!vistaHistorial) {
      navegar({ pathname: ubicacion.pathname, search: ubicacion.search }, { replace: true, state: { hzVista: vista } })
      return
    }
    if (vistaHistorial === vista) return
    setVistaEstado(vistaHistorial)
    guardarVista(codigo, vistaHistorial)
    setAvisoRonda(null)
    // Solo cuando cambia la entrada del historial.
  }, [ubicacion.key])
  // El botón atrás del navegador se escucha directo. El router aplica la ubicación dentro de una transición: si la
  // persona vuelve atrás justo después de cambiar de pantalla (un celular lento, un toque rápido), la entrada nueva
  // y la vuelta se juntan, el router queda en la misma ubicación de antes y el efecto de arriba no se entera.
  useEffect(() => {
    const alVolver = (e: PopStateEvent) => {
      const v = (e.state as { usr?: { hzVista?: Vista } } | null)?.usr?.hzVista
      if (!v) return
      setVistaEstado(v)
      guardarVista(codigo, v)
      setAvisoRonda(null)
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [codigo])

  // Reenvío de la cola: al cargar, cada 4 s mientras haya algo pendiente y apenas vuelve la señal.
  const participanteId = yo?.participante.id
  const vaciarCola = useCallback(async () => {
    if (envio.current || !participanteId || leerCola(codigo).length === 0) return
    const tarea = (async () => {
      const hechos = await enviarCola(codigo, token, participanteId)
      if (hechos.length === 0) return
      const quedan = leerCola(codigo)
      for (const h of hechos) {
        // Si entretanto se encoló una edición más nueva del mismo proyecto, esa sigue su curso.
        const reemplazado = quedan.some((v) => v.proyecto_id === h.voto.proyecto_id && v.ronda === h.voto.ronda)
        if (h.tipo === 'enviado') {
          if (reemplazado) continue
          guardarBorrador(codigo, h.voto.proyecto_id, h.voto.ronda, null)
          aplicar((y) => conVoto(y, h.respuesta))
          setAvisoOk(`Enviamos tu calificación de ${h.voto.nombre}.`)
        } else {
          if (reemplazado) continue
          // Rechazo definitivo: lo marcado vuelve al borrador para no perderlo.
          guardarBorrador(codigo, h.voto.proyecto_id, h.voto.ronda, h.voto.respuestas)
          const c = h.error.codigo
          const texto =
            c === 'RONDA_CERRADA' || c === 'RONDA_NO_ACTIVA'
              ? `La ronda ${h.voto.ronda} se cerró antes de que llegara tu calificación de ${h.voto.nombre}. Lo que marcaste sigue en este celular por si el facilitador reabre la ronda.`
              : `No pudimos guardar tu calificación de ${h.voto.nombre}. Ábrela de nuevo y guarda otra vez. Lo que marcaste sigue aquí.`
          setAvisoRonda((a) => ({ texto: a ? `${a.texto} ${texto}` : texto, tono: 'error', estado: estadoActual.current }))
        }
      }
      setCola(leerCola(codigo))
      void refrescar()
    })()
    envio.current = tarea.finally(() => {
      envio.current = null
    })
    await envio.current
  }, [codigo, token, participanteId, aplicar, refrescar])

  const hayCola = cola.length > 0
  useEffect(() => {
    if (!hayCola) return
    void vaciarCola()
    const t = setInterval(() => void vaciarCola(), 4000)
    const alVolver = () => void vaciarCola()
    window.addEventListener('online', alVolver)
    return () => {
      clearInterval(t)
      window.removeEventListener('online', alVolver)
    }
  }, [hayCola, vaciarCola])

  /** Antes de guardar en línea: termina el reenvío en curso (si lo hay) para no pisar lo nuevo con lo viejo. */
  const esperarCola = useCallback(async () => {
    if (envio.current) await envio.current.catch(() => {})
  }, [])

  /**
   * La ronda se cerró: se revisa lo marcado en este celular que no alcanzó a llegar al servidor, en los dos modos.
   * En automático, la calificación abierta en pantalla; en guiado (y en automático, lo que quedó a medias),
   * cada proyecto con respuestas sin enviar. Lo que está en la cola lo avisa la cola cuando el servidor lo rechace.
   */
  const estadoSala = yo?.sala.estado
  const estadoPrevio = useRef<EstadoSala | undefined>(undefined)
  useEffect(() => {
    if (!yo) return
    const antes = estadoPrevio.current
    estadoPrevio.current = yo.sala.estado
    if (esAbierta(yo.sala.estado)) {
      // Otra ronda abierta: el aviso del cierre anterior ya no aplica.
      if (antes && antes !== yo.sala.estado) setAvisoRonda(null)
      return
    }
    const calificando = vista.startsWith('calificar:') ? vista.slice('calificar:'.length) : null
    // Al cerrar en vivo, o al volver a la página con la calificación abierta (recarga).
    if (!esAbierta(antes) && !(antes === undefined && calificando)) return
    const r = yo.sala.ronda_actual
    const textos: string[] = []
    let perdio = false
    for (const p of proyectosVivos(yo)) {
      if (cola.some((v) => v.proyecto_id === p.id && v.ronda === r && v.participante_id === yo.participante.id)) continue
      const borrador = leerBorrador(codigo, p.id, r)
      const guardado = votoDe(yo, p.id)?.respuestas as Record<string, number> | undefined
      const cambios = Boolean(borrador && Object.entries(borrador).some(([k, v]) => guardado?.[k] !== v))
      if (p.id === calificando) {
        perdio ||= cambios || !guardado
        textos.push(
          cambios
            ? `La ronda ${r} se cerró mientras calificabas ${p.nombre}. Esos cambios no alcanzaron a guardarse${guardado ? ' y cuenta tu calificación anterior' : ''}. Lo que marcaste sigue en este celular por si el facilitador reabre la ronda.`
            : `La ronda ${r} se cerró mientras calificabas ${p.nombre}. ${guardado ? 'Cuenta tu última calificación guardada.' : 'No alcanzaste a guardar esa calificación.'}`,
        )
      } else if (cambios && borrador) {
        perdio = true
        const completo = yo.criterios.every((c) => borrador[c.id])
        textos.push(
          guardado
            ? `La ronda ${r} se cerró antes de que llegaran tus cambios en ${p.nombre}. Cuenta tu calificación anterior.`
            : completo
              ? `La ronda ${r} se cerró antes de que llegara tu calificación de ${p.nombre}. Tu calificación de ${p.nombre} no cuenta en esta ronda.`
              : `La ronda ${r} se cerró antes de que respondieras las ${yo.criterios.length} preguntas de ${p.nombre}. Tu calificación de ${p.nombre} no cuenta en esta ronda.`,
        )
      }
    }
    if (calificando) cambiarVista('inicio', true)
    if (textos.length) setAvisoRonda({ texto: textos.join(' '), tono: perdio ? 'error' : 'info', estado: yo.sala.estado })
    // Solo al cambiar el estado de la sala (o al llegar el primer /api/yo).
  }, [estadoSala, Boolean(yo)])

  // Quien espera la ronda 1 está leyendo el caso: cuando la ronda abre, sigue en el caso (con el botón para calificar)
  // en vez de saltar a los proyectos. En guiado sí salta: la pregunta la marca el facilitador.
  const esperaInicio = (estadoSala === 'preparada' || estadoSala === 'inscripcion') && vista === 'inicio' && !bienvenida
  const modoGuiado = yo?.config.modo_preguntas === 'guiado'
  useEffect(() => {
    if (esperaInicio && !modoGuiado) cambiarVista('lectura', true)
  }, [esperaInicio, modoGuiado, cambiarVista])

  // Un "guardada" de la ronda anterior no sigue en la pantalla de ronda cerrada (triage #15).
  useEffect(() => {
    setAvisoOk(null)
  }, [estadoSala])

  useEffect(() => {
    if (!avisoOk) return
    const t = setTimeout(() => setAvisoOk(null), 4000)
    return () => clearTimeout(t)
  }, [avisoOk])

  if (fatal) {
    if (fatal.codigo === 'PARTICIPANTE_INACTIVO' || fatal.codigo === 'PARTICIPANTE_DESACTIVADO') return <Desactivado />
    return (
      <Mensaje titulo="Tu sesión ya no está activa">
        Puede que hayas entrado desde otro celular o que el facilitador te haya dado acceso nuevo. {PIDE_ACCESO} Lo que habías marcado sigue en este
        celular.
      </Mensaje>
    )
  }
  if (!yo) {
    if (errorCarga) {
      // El título dice lo que pasó: sin señal no es una falla del servidor.
      if (errorCarga.esRed) {
        return (
          <Mensaje titulo="Sin conexión" accion={{ texto: 'Reintentar', onClick: () => void refrescar() }}>
            No pudimos cargar tu mesa. Revisa la señal, seguimos intentando.
          </Mensaje>
        )
      }
      return (
        <Mensaje titulo="Algo falló de nuestro lado" tono="error" accion={{ texto: 'Reintentar', onClick: () => void refrescar() }}>
          Vuelve a intentarlo en unos segundos.
        </Mensaje>
      )
    }
    return <Cargando />
  }
  if (!fuente) return <Cargando />
  if (yo.participante.activo === false) return <Desactivado sala={yo.sala.nombre} />

  const ronda = yo.sala.ronda_actual
  const estado = yo.sala.estado
  const abierta = esAbierta(estado)
  const alcance = yo.config.alcance_resultados
  const vivos = proyectosVivos(yo)
  // Solo los votos de esta persona: si en el celular entró otra, los suyos no cuentan aquí.
  const porEnviar = cola.filter((v) => v.ronda === ronda && v.participante_id === yo.participante.id).map((v) => v.proyecto_id)
  const completo = yo.completo_ronda || (vivos.length > 0 && vivos.every((p) => votoDe(yo, p.id) || porEnviar.includes(p.id)))
  // El precierre que cuenta es el del alcance de los resultados (SPEC §4): con alcance «sala», que termine de votar
  // la mesa no muestra nada nuevo (el resultado de la sala espera a toda la sala) y la pantalla no cambia.
  const precierre = abierta && (alcance === 'sala' ? Boolean(yo.resultados?.progreso?.precierre) : yo.progreso_mesa.precierre)
  const donde = textoAlcance(yo.resultados, alcance)
  const hayResultado = resultadoVisible(yo.resultados)
  // Decisión 1 de Paola (20-oct): con la ronda 1 abierta y sin precierre, el servidor manda la ronda oculta. Quien ya
  // votó no ve promedios ni matriz hasta que todos voten o se cierre la ronda.
  const r1Oculta = abierta && ronda === 1 && rondaOculta(yo.resultados, 1)
  const minimo = yo.resultados?.minimo_votos ?? MIN_VOTOS
  // D2: la foto del consolidado se renueva cuando llegan estos votos nuevos (desde el 21-oct, 1 en todas las salas).
  const deAPocos = yo.resultados?.votos_por_actualizacion ?? 1
  // C19-5: en guiado cada quien ve la pregunta que elige el facilitador; sin dato, automático.
  const guiado = yo.config.modo_preguntas === 'guiado'

  const arriba: ReactNode[] = []
  // Con la ronda siguiente abierta, el aviso del cierre ya no aplica: no se pinta ni un instante.
  if (avisoRonda && avisoRonda.estado === estado)
    arriba.push(
      <Aviso key="ronda" tono={avisoRonda.tono}>
        {avisoRonda.texto}
      </Aviso>,
    )
  if (avisoReingreso) arriba.push(<Aviso key="reingreso" tono="ok">Listo, entraste de nuevo. Retomas donde ibas.</Aviso>)

  // Lo que llega solo flota sobre la barra inferior: no empuja lo que se está leyendo. Los avisos de conexión son
  // un chip de una línea que no asusta (QA por roles del 20-oct); la falta de señal se avisa desde el tercer fallo.
  const flotantes: ReactNode[] = []
  if (porEnviar.length > 0 && abierta)
    flotantes.push(
      <Chip key="cola" tono="alerta">
        <strong>{porEnviar.length === 1 ? '1 calificación por enviar' : `${porEnviar.length} calificaciones por enviar`}</strong>.{' '}
        {porEnviar.length === 1 ? TEXTO_COLA_UNA : TEXTO_COLA_VARIAS}
      </Chip>,
    )
  else if (sinConexion) flotantes.push(<Chip key="red" tono="alerta">{TEXTO_SIN_SENAL}</Chip>)
  if (recuperada && !sinConexion) flotantes.push(<Chip key="ok-red" tono="ok">Conexión recuperada.</Chip>)
  if (avisoOk && abierta) flotantes.push(<Aviso key="ok" tono="ok">{avisoOk}</Aviso>)

  const marco: MarcoBase = {
    sala: yo.sala.nombre,
    meta: `${yo.participante.mesa.nombre} · ${yo.participante.perfil.nombre}`,
    arriba: arriba.length ? <div className="hzp-avisos">{arriba}</div> : undefined,
    flotantes: flotantes.length ? flotantes : undefined,
  }

  // 8.4 Perfil asignado (primera vez)
  if (bienvenida) {
    const nombres = vivos.map((p) => p.nombre).join(' y ') || 'los proyectos'
    return (
      <Marco
        {...marco}
        claveFoco="bienvenida"
        barra={
          <Boton
            bloque
            onClick={() => {
              marcarBienvenida(codigo, false)
              setBienvenida(false)
              ir('lectura')
            }}
          >
            Leer el caso
          </Boton>
        }
      >
        {/* El saludo va pegado al título: es su antetítulo, no un párrafo suelto. */}
        <div className="hzp-titular">
          <p className="hzp-saludo">Hola, {yo.participante.nombre.split(' ')[0]}</p>
          <h1 className="hz-titulo">Tu perfil: {yo.participante.perfil.nombre}</h1>
        </div>
        <p className="hz-texto-2">
          En tu mesa cada persona tiene información distinta sobre {nombres}. Tú aportas la mirada del perfil {yo.participante.perfil.nombre}. Lee el caso y
          tu hoja. En la ronda 1 calificas por tu cuenta y en silencio. En la ronda 2 compartes tu hoja y discuten en la mesa.
        </p>
      </Marco>
    )
  }

  // Guardado en línea (los dos modos): sale de la cola, se refleja en local y se confirma con el servidor.
  const alGuardar = (r: RespuestaVoto, nombre: string) => {
    setCola(quitarDeCola(codigo, r.voto))
    aplicar((y) => conVoto(y, r))
    setAvisoOk(`Calificación de ${nombre} guardada.`)
    void refrescar()
  }
  const paraVotar = {
    yo,
    codigo,
    token,
    marco,
    esperarCola,
    porEnviar,
    onSesionVencida: () => void refrescar(),
    onSinSenal: (voto: Omit<VotoEnCola, 'id' | 'participante_id'>) => {
      setCola(encolar(codigo, { ...voto, id: nuevoId(), participante_id: yo.participante.id }))
      setAvisoOk(null)
    },
  }

  const botonLeer = (
    <Boton variante="fantasma" onClick={() => ir('lectura')}>
      Leer el caso y {yo.config.revelar_hojas ? 'las hojas' : 'tu hoja'}
    </Boton>
  )
  const todosMisVotos = [...yo.mis_votos, ...(yo.mis_votos_anteriores ?? [])]
  // Al cerrar la ronda 2: cuántas de tus respuestas cambiaron (QA por roles del 20-oct). Solo cuenta tus votos.
  const cierrePersonal = ronda === 2 && <CierrePersonal misVotos={todosMisVotos} criterios={yo.criterios} />
  const resultado = (preliminar: boolean) =>
    yo.resultados ? (
      <ResultadoAlcance resultados={yo.resultados} criterios={yo.criterios} alcance={alcance} misVotos={todosMisVotos} preliminar={preliminar} />
    ) : null
  // 8.11 Precierre: va al final de la pantalla para no empujar lo que se está leyendo cuando llega.
  const quienes = alcance === 'sala' ? 'la sala' : yo.participante.mesa.nombre
  const seccionPreliminar = precierre && (
    <section className="hzp-seccion" aria-labelledby="hzp-pre">
      <h2 id="hzp-pre" className="hz-subtitulo">
        {hayResultado ? `Resultado preliminar de ${donde}` : `Todos votaron en ${quienes}`}
      </h2>
      <Aviso tono="alerta" titulo={hayResultado ? `Todos votaron en ${quienes}` : undefined}>
        {hayResultado
          ? 'Puedes editar tus calificaciones hasta que el facilitador cierre la ronda. Al cerrarla sale el resultado final.'
          : `Puedes editar tus calificaciones hasta que el facilitador cierre la ronda. El resultado se muestra cuando hay al menos ${minimo === 1 ? '1 voto' : `${minimo} votos`}.`}
      </Aviso>
      {hayResultado && resultado(true)}
    </section>
  )

  // P1 modo guiado: la pregunta del facilitador reemplaza la lista de proyectos mientras la ronda está abierta.
  if (abierta && guiado && vista !== 'lectura') {
    return (
      <PreguntaGuiada {...paraVotar} onGuardado={alGuardar}>
        {botonLeer}
        {seccionPreliminar}
      </PreguntaGuiada>
    )
  }

  // 8.8 Calificar (modo automático)
  if (vista.startsWith('calificar:') && abierta) {
    const pid = vista.slice('calificar:'.length)
    return (
      <Calificar
        key={`${pid}-${ronda}`}
        {...paraVotar}
        proyectoId={pid}
        onVolver={() => ir('elegir')}
        onGuardado={(r, nombre) => {
          alGuardar(r, nombre)
          ir('inicio', true)
        }}
        onSinSenal={(voto) => {
          paraVotar.onSinSenal(voto)
          ir('inicio', true)
        }}
      />
    )
  }

  // 8.5 Lectura (también es la pantalla de espera 8.6 antes de cada ronda)
  const esperaRonda1 = estado === 'preparada' || estado === 'inscripcion'
  const sinResultadoCerrada = (estado === 'r1_cerrada' || estado === 'r2_cerrada') && !yo.resultados
  if (vista === 'lectura' || esperaRonda1 || sinResultadoCerrada) {
    const siguiente = estado === 'r1_cerrada' ? 2 : 1
    const esperando = esperaRonda1 || estado === 'r1_cerrada'
    const enLectura = vista === 'lectura' && !esperaRonda1 && !sinResultadoCerrada
    const textoRonda = (n: number) => (n === 1 ? 'En la ronda 1 calificas por tu cuenta y en silencio.' : 'En la ronda 2 comparten sus hojas y discuten en la mesa.')
    const accion = guiado ? 'Ir a la pregunta' : completo ? 'Ver mis calificaciones' : 'Calificar proyectos'
    let barra: ReactNode = undefined
    let nota: ReactNode = undefined
    // Antes y después de abrir la ronda la barra mide lo mismo (un botón y una nota de 2 líneas): nada salta mientras se lee.
    const notaEspera = <span className="hzp-nota-barra">La votación se abre cuando el facilitador lo indique.</span>
    // QA por roles del 20-oct: en la pestaña Caso el paso que sigue es leer la hoja; calificar solo se ofrece desde
    // la hoja. «Leer mi hoja» cambia de pestaña y sube al comienzo de la hoja.
    if (pestana === 'caso') {
      barra = (
        <Boton
          bloque
          onClick={() => {
            setPestana('hoja')
            requestAnimationFrame(() => {
              document.documentElement.scrollTop = 0
              document.querySelector<HTMLElement>('.hzp-vista [role="tab"][aria-selected="true"]')?.focus({ preventScroll: true })
            })
          }}
        >
          {yo.config.revelar_hojas ? 'Leer las hojas' : 'Leer mi hoja'}
        </Boton>
      )
      nota = abierta ? (
        <span className="hzp-nota-barra">La ronda {ronda} está abierta.</span>
      ) : esperando ? (
        notaEspera
      ) : enLectura ? undefined : (
        'El resultado aparece aquí en unos segundos.'
      )
    } else if (abierta) {
      barra = (
        <Boton bloque onClick={() => ir(completo || guiado ? 'inicio' : 'elegir')}>
          {accion}
        </Boton>
      )
      nota = <span className="hzp-nota-barra">La ronda {ronda} está abierta.</span>
    } else if (enLectura) {
      barra = (
        <Boton bloque variante="secundario" onClick={() => ir('inicio')}>
          {estado === 'cerrada' || yo.resultados ? 'Ver el resultado' : 'Volver'}
        </Boton>
      )
      if (esperando) nota = notaEspera
    } else if (esperando) {
      barra = (
        <Boton bloque deshabilitado>
          {accion}
        </Boton>
      )
      nota = notaEspera
    } else {
      nota = 'El resultado aparece aquí en unos segundos.'
      barra = <span className="hz-visual-oculto">Esperando el resultado</span>
    }
    return (
      <Marco {...marco} claveFoco="lectura" barra={barra} notaBarra={nota}>
        <h1 className="hz-titulo">El caso y {yo.config.revelar_hojas ? 'las hojas' : 'tu hoja'}</h1>
        {/* El aviso de la ronda cambia de texto en el mismo lugar cuando la ronda abre: el caso no se mueve. */}
        {esperando && (
          <Aviso tono="info">
            {sinResultadoCerrada && estado === 'r1_cerrada' ? 'La ronda 1 se cerró. ' : ''}
            La ronda {siguiente} aún no está abierta. Mientras tanto, lee el caso y tu hoja. {textoRonda(siguiente)}
          </Aviso>
        )}
        {abierta && (
          <Aviso tono="info">
            {completo
              ? `Ya calificaste los ${vivos.length} proyectos en la ronda ${ronda}. Puedes editar mientras la ronda siga abierta.`
              : guiado
                ? `La ronda ${ronda} ya está abierta. Cuando termines de leer, ve a la pregunta que marca el facilitador. ${textoRonda(ronda)}`
                : `La ronda ${ronda} ya está abierta. Cuando termines de leer, califica los ${vivos.length} proyectos. ${textoRonda(ronda)}`}
          </Aviso>
        )}
        {sinResultadoCerrada && estado === 'r2_cerrada' && <Aviso tono="info">La ronda 2 se cerró. El resultado aparece aquí en unos segundos.</Aviso>}
        <Lectura yo={yo} codigo={codigo} activa={pestana} onCambio={setPestana} />
      </Marco>
    )
  }

  // 8.13 Sala cerrada
  if (estado === 'cerrada') {
    return (
      <Marco {...marco} claveFoco="cerrada">
        <h1 className="hz-titulo">El taller terminó</h1>
        <p className="hz-texto-2">{hayResultado ? `Gracias por participar. Este es el resultado final de ${donde}.` : 'Gracias por participar.'}</p>
        {cierrePersonal}
        {resultado(false)}
        {botonLeer}
      </Marco>
    )
  }

  // 8.12 Ronda cerrada. El texto solo promete lo que se muestra (con el mínimo de votos puede no haber resultado).
  if (estado === 'r1_cerrada' || estado === 'r2_cerrada') {
    let texto: string | null
    if (ronda === 1) texto = hayResultado ? `Este es el resultado de ${donde}. Discútanlo en la mesa antes de la ronda\u00a02.` : 'Discutan el caso en la mesa antes de la ronda\u00a02.'
    else if (yo.resultados && vistaMatriz(yo.resultados) === 'comparacion')
      texto = `Así se movieron ${vivos.map((p) => p.nombre).join(' y ')} de la ronda 1 a la ronda 2 en ${donde}.`
    else texto = hayResultado ? `Este es el resultado de ${donde}.` : null
    return (
      <Marco {...marco} claveFoco={`cerrada-${ronda}`}>
        <h1 className="hz-titulo">Ronda {ronda} cerrada</h1>
        {texto && <p className="hz-texto-2">{texto}</p>}
        {cierrePersonal}
        {ronda === 1 && (
          <Aviso tono="info">La ronda 2 aún no está abierta. Cuando el facilitador la abra, compartan sus hojas antes de calificar.</Aviso>
        )}
        {resultado(false)}
        {botonLeer}
      </Marco>
    )
  }

  // Ronda abierta. 8.7 Elegir proyecto (pendiente o editando)

  if (!completo || vista === 'elegir') {
    return (
      <Marco {...marco} claveFoco={`elegir-${ronda}`}>
        <ElegirProyecto yo={yo} codigo={codigo} porEnviar={porEnviar} onCalificar={(pid) => ir(`calificar:${pid}`)} />
        {completo && (
          <Boton variante="secundario" onClick={() => ir('inicio')}>
            Listo, ya no voy a editar
          </Boton>
        )}
        {botonLeer}
        {seccionPreliminar}
      </Marco>
    )
  }

  // 8.10 Resultado parcial (D2): el consolidado se renueva con lo que diga el servidor (desde el 21-oct, con cada voto).
  if (yo.config.vista_participante === 'en_vivo' && yo.resultados && !precierre && !r1Oculta) {
    return (
      <Marco {...marco} claveFoco={`envivo-${ronda}`}>
        <h1 className="hz-titulo">Resultado parcial de {donde}</h1>
        <p className="hz-texto-2">
          Calificaste los {vivos.length} proyectos en la ronda {ronda}. Este resultado se renueva {cadaCuantos(deAPocos)} y el final sale
          cuando el facilitador cierra la ronda. Puedes editar mientras la ronda siga abierta.
        </p>
        {resultado(true)}
        <Boton variante="secundario" onClick={() => ir('elegir')}>
          Editar mis calificaciones
        </Boton>
        {botonLeer}
      </Marco>
    )
  }

  // 8.9 Voto registrado (y 8.11 precierre debajo)
  const { inscritos } = yo.progreso_mesa
  // Sin señal el servidor aún no cuenta el voto propio: la barra lo suma para no contradecir el título.
  const completos = Math.min(inscritos, yo.progreso_mesa.completos + (porEnviar.length > 0 && !yo.completo_ronda ? 1 : 0))
  return (
    <Marco {...marco} claveFoco={`registrado-${ronda}`}>
      <h1 className="hz-titulo">{porEnviar.length > 0 ? 'Calificación guardada en este celular' : 'Calificación enviada'}</h1>
      <p className="hz-texto-2">
        Calificaste {vivos.map((p) => p.nombre).join(' y ')} en la ronda {ronda}.{' '}
        {porEnviar.length > 0 ? 'La enviamos automáticamente en cuanto se pueda.' : 'Puedes editar mientras la ronda siga abierta.'}
      </p>
      {r1Oculta && !precierre && <Aviso tono="info">{TEXTO_R1_OCULTA}</Aviso>}
      <BarraProgreso actual={completos} total={inscritos} texto={`${completos} de ${inscritos} completaron en ${yo.participante.mesa.nombre}`} />
      <div className="hzp-acciones">
        <Boton variante="secundario" bloque onClick={() => ir('elegir')}>
          Editar mis calificaciones
        </Boton>
        {botonLeer}
      </div>
      {seccionPreliminar}
    </Marco>
  )
}

function Desactivado({ sala }: { sala?: string }) {
  return (
    <Mensaje sala={sala} titulo="El facilitador te retiró de esta mesa">
      Si es un error, avísale en el salón.
    </Mensaje>
  )
}

/** Refleja en local el voto recién guardado (la siguiente versión del servidor lo confirma). */
function conVoto(yo: Yo, r: RespuestaVoto): Yo {
  const otros = yo.mis_votos.filter((v) => !(v.proyecto_id === r.voto.proyecto_id && v.ronda === r.voto.ronda))
  return {
    ...yo,
    mis_votos: [...otros, r.voto],
    pendientes: yo.pendientes.filter((p) => p !== r.voto.proyecto_id),
    completo_ronda: r.completo_ronda,
    progreso_mesa: r.progreso_mesa ?? yo.progreso_mesa,
  }
}
