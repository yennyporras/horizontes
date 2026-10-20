import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react'
import { Aviso, BarraProgreso, Boton, Hoja, Insignia, Rubrica } from '../../shared/ui'
import { ErrorApi, guardarVoto, type Criterio, type ProyectoPortafolio, type RespuestaVoto, type Yo } from '../api'
import type { VotoEnCola } from '../cola'
import { FaseRonda, Marco, Md, type MarcoBase } from '../Comun'
import { hojasDeProyecto, nombrePerfil } from './Lectura'
import { guardarBorrador, leerBorrador } from '../sesion'

export const proyectosVivos = (yo: Yo) => yo.contenido.portafolio.filter((p) => p.modo === 'vivo')
export const votoDe = (yo: Yo, proyectoId: string) => yo.mis_votos.find((v) => v.proyecto_id === proyectoId && v.ronda === yo.sala.ronda_actual)

/** 8.7 Elegir proyecto: INSUMEX y NUTRIWHAT con su estado. */
export function ElegirProyecto({ yo, porEnviar = [], onCalificar }: { yo: Yo; porEnviar?: string[]; onCalificar: (proyectoId: string) => void }) {
  const vivos = proyectosVivos(yo)
  const hechos = vivos.filter((p) => votoDe(yo, p.id) || porEnviar.includes(p.id)).length
  const ronda = yo.sala.ronda_actual
  // Una sola acción principal por vista: el primer proyecto pendiente.
  const siguiente = vivos.find((p) => !votoDe(yo, p.id) && !porEnviar.includes(p.id))?.id
  return (
    <>
      <h1 className="hz-titulo">Ronda {ronda}: califica los {vivos.length} proyectos</h1>
      <FaseRonda ronda={ronda} />
      <p className="hz-texto-2">
        {ronda === 1
          ? `Califica por tu cuenta, sin comentar con tu mesa. Usa el caso y tu hoja como ${yo.participante.perfil.nombre}.`
          : 'Compartan en la mesa lo que dice cada hoja y discutan cada proyecto. Después cada quien califica: cuenta tu calificación, no la de la mesa.'}
      </p>
      <BarraProgreso actual={hechos} total={vivos.length} texto={`Llevas ${hechos} de ${vivos.length} proyectos`} />
      <ul className="hzp-elegir">
        {vivos.map((p) => {
          const enCola = porEnviar.includes(p.id)
          const hecho = Boolean(votoDe(yo, p.id)) || enCola
          return (
            <li key={p.id} className="hzp-elegir__fila">
              <div className="hzp-elegir__info">
                <p className="hzp-proyecto__nombre">{p.nombre}</p>
                {enCola ? <Insignia tono="alerta">Por enviar</Insignia> : hecho ? <Insignia tono="ok">Guardado</Insignia> : <Insignia>Pendiente</Insignia>}
              </div>
              <Boton variante={p.id === siguiente ? 'primario' : 'secundario'} onClick={() => onCalificar(p.id)} aria-label={`${hecho ? 'Editar' : 'Calificar'} ${p.nombre}`}>
                {hecho ? 'Editar' : 'Calificar'}
              </Boton>
            </li>
          )
        })}
      </ul>
    </>
  )
}

/** Pausa antes de pasar sola a la siguiente pregunta: deja ver la opción elegida. */
export const AVANCE_MS = 300

type Respuestas = Record<string, number>
const completas = (yo: Yo, r: Respuestas) => yo.criterios.every((c) => Boolean(r[c.id]))
const iguales = (a: Respuestas | null | undefined, b: Respuestas) => Boolean(a) && Object.keys(b).every((k) => a![k] === b[k])

interface EnvioProps {
  yo: Yo
  codigo: string
  token: string
  onGuardado: (r: RespuestaVoto, proyecto: string) => void
  /** Sin señal o con el servidor ocupado (429, 5xx): el voto pasa a la cola del celular y se reenvía solo. */
  onSinSenal: (voto: Omit<VotoEnCola, 'id' | 'participante_id'>) => void
  /** Proyectos de esta ronda con un voto en la cola, todavía sin enviar. */
  porEnviar?: string[]
  /** Espera el reenvío de la cola en curso antes del PUT. */
  esperarCola?: () => Promise<void>
  /** 401: la página revisa la sesión y explica cómo entrar de nuevo (lo marcado queda en el borrador). */
  onSesionVencida: () => void
  marco: MarcoBase
}

/**
 * PUT del voto completo con los avisos de siempre. Los envíos van en fila y, si llega uno más nuevo
 * mientras otro está en curso, solo sale el último (en guiado, cada cambio de un proyecto completo reenvía).
 */
function usarEnvio({ yo, codigo, token, onGuardado, onSinSenal, onSesionVencida, esperarCola }: EnvioProps, proyecto: ProyectoPortafolio) {
  const ronda = yo.sala.ronda_actual
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fila = useRef<Promise<void>>(Promise.resolve())
  const ultimo = useRef(0)

  const enviarYa = async (respuestas: Respuestas) => {
    setGuardando(true)
    setError(null)
    try {
      await esperarCola?.()
      const r = await guardarVoto(token, { proyecto_id: proyecto.id, ronda, respuestas })
      // Si entretanto cambió una respuesta, ese borrador sigue: sale en el próximo envío.
      if (iguales(leerBorrador(codigo, proyecto.id, ronda), respuestas)) guardarBorrador(codigo, proyecto.id, ronda, null)
      onGuardado(r, proyecto.nombre)
    } catch (e) {
      const ea = e instanceof ErrorApi ? e : null
      if (!ea || ea.esRed || ea.status === 429 || ea.status >= 500) {
        // Sin señal o el servidor no pudo atenderlo: queda en la cola del celular y la cola lo reintenta sola.
        onSinSenal({ proyecto_id: proyecto.id, nombre: proyecto.nombre, ronda, respuestas })
        return
      }
      if (ea.status === 401) {
        setError('Tu sesión se cerró. Lo que marcaste está guardado en este celular. Pídele al facilitador que te dé acceso de nuevo y guarda otra vez.')
        onSesionVencida()
      } else if (ea.codigo === 'RESPUESTA_INVALIDA') setError('Una de las respuestas no es válida. Vuelve a elegir y guarda de nuevo.')
      else if (ea.codigo === 'RONDA_CERRADA') setError(`La ronda ${ronda} ya se cerró. Tu última calificación guardada es la que cuenta.`)
      else if (ea.codigo === 'RONDA_NO_ACTIVA') setError(`La ronda ${ronda} todavía no está abierta.`)
      else setError('No pudimos guardar tu calificación. Vuelve a intentarlo en unos segundos.')
    } finally {
      setGuardando(false)
    }
  }

  const enviar = (respuestas: Respuestas) => {
    const resp: Respuestas = {}
    for (const c of yo.criterios) resp[c.id] = respuestas[c.id]
    const n = ++ultimo.current
    fila.current = fila.current.then(() => (n === ultimo.current ? enviarYa(resp) : undefined))
    return fila.current
  }
  return { guardando, error, enviar }
}

/** Lo marcado sin enviar (borrador) encima del voto ya guardado en esta ronda. */
const respuestasIniciales = (yo: Yo, codigo: string, proyectoId: string): Respuestas => ({
  ...(votoDe(yo, proyectoId)?.respuestas ?? {}),
  ...(leerBorrador(codigo, proyectoId, yo.sala.ronda_actual) ?? {}),
})

/** P1: una pregunta con su encabezado (lector de pantalla), la barra «Pregunta 3 de 6 · INSUMEX» y su rúbrica. */
function Pregunta({
  yo,
  proyecto,
  indice,
  valor,
  onElegir,
  titulo,
}: {
  yo: Yo
  proyecto: ProyectoPortafolio
  indice: number
  valor: number | null
  /** `conFlechas`: recorre las opciones con las flechas del teclado; elegir así no pasa de pregunta. */
  onElegir: (valor: number, conFlechas: boolean) => void
  titulo?: Ref<HTMLHeadingElement>
}) {
  const c = yo.criterios[indice]
  const total = yo.criterios.length
  const flechas = useRef(false)
  return (
    <section
      className="hzp-pregunta"
      data-paso={indice}
      onKeyDown={(e) => {
        if (e.key.startsWith('Arrow')) flechas.current = true
      }}
      onKeyUp={() => {
        flechas.current = false
      }}
    >
      <BarraProgreso actual={indice + 1} total={total} texto={`Pregunta ${indice + 1} de ${total} · ${proyecto.nombre}`} />
      <h2 ref={titulo} tabIndex={-1} className="hz-visual-oculto">
        Pregunta {indice + 1} de {total}: {c.nombre}
      </h2>
      <Rubrica
        key={c.id}
        criterioId={c.id}
        nombre={c.nombre}
        pregunta={c.pregunta}
        opciones={c.rubrica}
        valor={valor}
        onCambio={(v) => onElegir(v, flechas.current)}
      />
    </section>
  )
}

/** Tu hoja (o las 6 hojas en R2) del proyecto, plegada para no tapar la pregunta. */
function HojaPlegable({ yo, proyectoId }: { yo: Yo; proyectoId: string }) {
  const [ver, setVer] = useState(false)
  const hojas = hojasDeProyecto(yo, proyectoId)
  const mio = yo.participante.perfil.id
  const varias = hojas.length > 1
  if (hojas.length === 0) return null
  return (
    <div className="hzp-hoja-plegable">
      <Boton variante="fantasma" aria-expanded={ver} aria-controls="hzp-hojas-calificar" onClick={() => setVer((v) => !v)}>
        {`${ver ? 'Ocultar' : 'Ver'} ${varias ? 'las hojas' : 'tu hoja'} de este proyecto`}
      </Boton>
      {ver && (
        <div id="hzp-hojas-calificar" className="hzp-grupo-hojas">
          {varias ? (
            hojas.map((h) => (
              <Hoja key={h.perfil_id} titulo={nombrePerfil(h)} activa={h.perfil_id === mio} extra={h.perfil_id === mio ? <Insignia tono="ok">Tu hoja</Insignia> : undefined}>
                <Md texto={h.texto} />
              </Hoja>
            ))
          ) : (
            <div className="hzp-hoja-plegable__texto">
              <Md texto={hojas[0].texto} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const textoNivel = (c: Criterio, v: number) => c.rubrica.find((o) => o.valor === v)?.texto ?? ''

export interface CalificarProps extends EnvioProps {
  proyectoId: string
  onVolver: () => void
}

/**
 * 8.8 Calificar en modo automático (C19-5, P1): una pregunta por pantalla. Al elegir pasa sola a la
 * siguiente sin responder; al final, el resumen con Guardar. Borrador en sessionStorage.
 */
export function Calificar(props: CalificarProps) {
  const proyecto = props.yo.contenido.portafolio.find((p) => p.id === props.proyectoId)
  if (!proyecto) {
    return (
      <Marco {...props.marco} claveFoco="sin-proyecto">
        <h1 className="hz-titulo">No encontramos ese proyecto</h1>
        <Boton variante="secundario" onClick={props.onVolver}>
          Volver a los proyectos
        </Boton>
      </Marco>
    )
  }
  return <CalificarProyecto {...props} proyecto={proyecto} />
}

function CalificarProyecto(props: CalificarProps & { proyecto: ProyectoPortafolio }) {
  const { yo, codigo, proyecto, onVolver, marco } = props
  const ronda = yo.sala.ronda_actual
  const criterios = yo.criterios
  const total = criterios.length
  const [respuestas, setRespuestas] = useState<Respuestas>(() => respuestasIniciales(yo, codigo, proyecto.id))
  // Empieza en la primera sin responder; con todo respondido (editar), en el resumen.
  const [paso, setPaso] = useState(() => {
    const i = criterios.findIndex((c) => !respuestas[c.id])
    return i === -1 ? total : i
  })
  const [intento, setIntento] = useState(false)
  const { guardando, error, enviar } = usarEnvio(props, proyecto)
  const titulo = useRef<HTMLHeadingElement>(null)
  const reloj = useRef<ReturnType<typeof setTimeout>>()
  const pasoAnterior = useRef(paso)

  useEffect(() => () => clearTimeout(reloj.current), [])
  // Al cambiar de pregunta el foco va a su encabezado (al entrar lo toma el título de la pantalla).
  useEffect(() => {
    if (pasoAnterior.current === paso) return
    pasoAnterior.current = paso
    titulo.current?.focus()
  }, [paso])

  const irA = (n: number) => {
    clearTimeout(reloj.current)
    setPaso(Math.min(Math.max(n, 0), total))
  }
  const faltan = criterios.filter((c) => !respuestas[c.id]).length

  const elegir = (valor: number, conFlechas: boolean) => {
    const nuevas = { ...respuestas, [criterios[paso].id]: valor }
    setRespuestas(nuevas)
    guardarBorrador(codigo, proyecto.id, ronda, nuevas)
    clearTimeout(reloj.current)
    if (conFlechas) return
    // Pasa a la siguiente sin responder; si no queda ninguna, al resumen.
    const desde = paso
    reloj.current = setTimeout(() => {
      const sig = criterios.findIndex((c, i) => i > desde && !nuevas[c.id])
      irA(sig === -1 ? total : sig)
    }, AVANCE_MS)
  }

  const guardar = () => {
    if (guardando) return
    setIntento(true)
    if (faltan === 0) void enviar(respuestas)
  }

  const enResumen = paso >= total
  const barra = enResumen ? (
    <Boton bloque cargando={guardando} textoCargando="Guardando…" onClick={guardar}>
      Guardar calificación
    </Boton>
  ) : (
    <div className="hzp-navegacion">
      <Boton variante="secundario" deshabilitado={paso === 0} onClick={() => irA(paso - 1)}>
        Anterior
      </Boton>
      <Boton variante={respuestas[criterios[paso].id] ? 'primario' : 'secundario'} onClick={() => irA(paso + 1)}>
        {paso === total - 1 ? 'Ver resumen' : 'Siguiente'}
      </Boton>
    </div>
  )

  return (
    <Marco {...marco} claveFoco={`calificar-${proyecto.id}`} barra={barra}>
      <Boton variante="fantasma" className="hzp-volver" onClick={onVolver}>
        Volver a los proyectos
      </Boton>
      <h1 className="hz-titulo">{proyecto.nombre}</h1>
      <FaseRonda ronda={ronda} />
      {error && <Aviso tono="error">{error}</Aviso>}
      {enResumen ? (
        <section className="hzp-resumen" aria-labelledby="hzp-resumen-titulo">
          <BarraProgreso actual={total - faltan} total={total} texto={`${total - faltan} de ${total} respondidas · ${proyecto.nombre}`} />
          <h2 id="hzp-resumen-titulo" ref={titulo} tabIndex={-1} className="hz-subtitulo">
            Revisa tus respuestas
          </h2>
          {intento && faltan > 0 && (
            <Aviso tono="error">{faltan === 1 ? 'Te falta 1 pregunta. Respóndela para guardar.' : `Te faltan ${faltan} preguntas. Respóndelas para guardar.`}</Aviso>
          )}
          <ol className="hzp-resumen__lista">
            {criterios.map((c, i) => {
              const v = respuestas[c.id]
              return (
                <li key={c.id} className="hzp-resumen__fila" data-criterio={c.id}>
                  <div className="hzp-resumen__dato">
                    <p className="hzp-resumen__criterio">{c.nombre}</p>
                    {v ? (
                      <p className="hzp-resumen__valor">
                        <strong className="hzp-resumen__cifra">{v}</strong> {textoNivel(c, v)}
                      </p>
                    ) : (
                      <p className="hzp-resumen__valor hzp-resumen__valor--falta">Sin responder</p>
                    )}
                  </div>
                  <Boton variante="secundario" aria-label={`${v ? 'Cambiar' : 'Responder'} ${c.nombre}`} onClick={() => irA(i)}>
                    {v ? 'Cambiar' : 'Responder'}
                  </Boton>
                </li>
              )
            })}
          </ol>
        </section>
      ) : (
        <Pregunta yo={yo} proyecto={proyecto} indice={paso} valor={respuestas[criterios[paso].id] ?? null} onElegir={elegir} titulo={titulo} />
      )}
      <HojaPlegable yo={yo} proyectoId={proyecto.id} />
    </Marco>
  )
}

export interface GuiadaProps extends EnvioProps {
  /** Debajo de la pregunta: leer el caso y, en precierre, el resultado preliminar. */
  children?: ReactNode
}

/**
 * Modo guiado (C19-5, P1): solo la pregunta que eligió el facilitador (`sala.pregunta_guiada`). La respuesta
 * queda en este celular y el voto sale cuando las 6 del proyecto están respondidas. Se puede cambiar mientras
 * la ronda siga abierta: con el proyecto completo, el cambio se reenvía.
 */
export function PreguntaGuiada(props: GuiadaProps) {
  const { yo, marco, children } = props
  const g = yo.sala.pregunta_guiada
  const vivos = proyectosVivos(yo)
  const proyecto = g ? vivos.find((p) => p.id === g.proyecto_id) : undefined
  const indice = proyecto && g ? yo.criterios.findIndex((c) => c.id === g.criterio_id) : -1
  if (!proyecto || indice < 0) {
    const hechos = vivos.filter((p) => votoDe(yo, p.id)).length
    return (
      <Marco {...marco} claveFoco="guiada-espera">
        <h1 className="hz-titulo">Espera la pregunta del facilitador</h1>
        <FaseRonda ronda={yo.sala.ronda_actual} />
        <p className="hz-texto-2">El facilitador elige cada pregunta y aparece aquí sola. Deja esta pantalla abierta.</p>
        <BarraProgreso actual={hechos} total={vivos.length} texto={`Llevas ${hechos} de ${vivos.length} proyectos`} />
        {children}
      </Marco>
    )
  }
  return <RespuestaGuiada {...props} key={`${proyecto.id}-${yo.sala.ronda_actual}`} proyecto={proyecto} indice={indice} />
}

function RespuestaGuiada(props: GuiadaProps & { proyecto: ProyectoPortafolio; indice: number }) {
  const { yo, codigo, proyecto, indice, marco, children, porEnviar = [] } = props
  const ronda = yo.sala.ronda_actual
  const criterio = yo.criterios[indice]
  const total = yo.criterios.length
  const [respuestas, setRespuestas] = useState<Respuestas>(() => respuestasIniciales(yo, codigo, proyecto.id))
  const { guardando, error, enviar } = usarEnvio(props, proyecto)
  const valor = respuestas[criterio.id] ?? null
  const respondidas = yo.criterios.filter((c) => respuestas[c.id]).length
  const listas = completas(yo, respuestas)
  const enviado = listas && iguales(votoDe(yo, proyecto.id)?.respuestas, respuestas)
  const enCola = porEnviar.includes(proyecto.id)
  // El facilitador cambia de pregunta: el foco va al encabezado de la pregunta nueva, así el lector la anuncia
  // («Pregunta 2 de 6: …») y no solo el nombre del proyecto, que no cambió.
  const titulo = useRef<HTMLHeadingElement>(null)
  const criterioAnterior = useRef(criterio.id)
  useEffect(() => {
    if (criterioAnterior.current === criterio.id) return
    criterioAnterior.current = criterio.id
    titulo.current?.focus()
  }, [criterio.id])

  const elegir = (v: number) => {
    const nuevas = { ...respuestas, [criterio.id]: v }
    setRespuestas(nuevas)
    guardarBorrador(codigo, proyecto.id, ronda, nuevas)
    if (completas(yo, nuevas)) void enviar(nuevas)
  }

  return (
    <Marco {...marco} claveFoco={`guiada-${proyecto.id}`}>
      <h1 className="hz-titulo">{proyecto.nombre}</h1>
      <FaseRonda ronda={ronda} />
      {error && (
        <Aviso tono="error" accion={listas && !guardando ? { texto: 'Reintentar', onClick: () => void enviar(respuestas) } : undefined}>
          {error}
        </Aviso>
      )}
      <Pregunta yo={yo} proyecto={proyecto} indice={indice} valor={valor} onElegir={elegir} titulo={titulo} />
      {valor !== null && !error && (
        <Aviso tono={enviado ? 'ok' : enCola ? 'alerta' : 'info'} titulo="Espera la siguiente pregunta del facilitador">
          {enviado
            ? `Tus ${total} respuestas de ${proyecto.nombre} quedaron guardadas. Puedes cambiar esta mientras la ronda siga abierta.`
            : respondidas < total
              ? `Tu respuesta quedó en este celular. Enviamos tu calificación de ${proyecto.nombre} cuando respondas las ${total} preguntas (llevas ${respondidas}).`
              : enCola
                ? `Tus ${total} respuestas de ${proyecto.nombre} están guardadas en este celular y todavía no llegan. Las enviamos solas en cuanto se pueda.`
                : `Enviando tus ${total} respuestas de ${proyecto.nombre}…`}
        </Aviso>
      )}
      <HojaPlegable yo={yo} proyectoId={proyecto.id} />
      {children}
    </Marco>
  )
}
