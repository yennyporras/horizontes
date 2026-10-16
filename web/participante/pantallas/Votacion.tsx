import { useRef, useState } from 'react'
import { Aviso, BarraProgreso, Boton, Insignia, Rubrica } from '../../shared/ui'
import { ErrorApi, guardarVoto, type RespuestaVoto, type Yo } from '../api'
import { Marco, type MarcoBase } from '../Comun'
import { guardarBorrador, leerBorrador } from '../sesion'

export const proyectosVivos = (yo: Yo) => yo.contenido.portafolio.filter((p) => p.modo === 'vivo')
export const votoDe = (yo: Yo, proyectoId: string) => yo.mis_votos.find((v) => v.proyecto_id === proyectoId && v.ronda === yo.sala.ronda_actual)

/** 8.7 Elegir proyecto: INSUMEX y NUTRIWHAT con su estado. */
export function ElegirProyecto({ yo, onCalificar }: { yo: Yo; onCalificar: (proyectoId: string) => void }) {
  const vivos = proyectosVivos(yo)
  const hechos = vivos.filter((p) => votoDe(yo, p.id)).length
  return (
    <>
      <h1 className="hz-titulo">Ronda {yo.sala.ronda_actual}: califica los {vivos.length} proyectos</h1>
      <BarraProgreso actual={hechos} total={vivos.length} texto={`Llevas ${hechos} de ${vivos.length} proyectos`} />
      <ul className="hzp-elegir">
        {vivos.map((p) => {
          const hecho = Boolean(votoDe(yo, p.id))
          return (
            <li key={p.id} className="hzp-elegir__fila">
              <div className="hzp-elegir__info">
                <p className="hzp-proyecto__nombre">{p.nombre}</p>
                {hecho ? <Insignia tono="ok">Guardado</Insignia> : <Insignia>Pendiente</Insignia>}
              </div>
              <Boton variante={hecho ? 'secundario' : 'primario'} onClick={() => onCalificar(p.id)} aria-label={`${hecho ? 'Editar' : 'Calificar'} ${p.nombre}`}>
                {hecho ? 'Editar' : 'Calificar'}
              </Boton>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export interface CalificarProps {
  yo: Yo
  codigo: string
  token: string
  proyectoId: string
  onGuardado: (r: RespuestaVoto, proyecto: string) => void
  onVolver: () => void
  marco: MarcoBase
}

/** 8.8 Calificar proyecto: 6 rúbricas obligatorias, borrador en sessionStorage. */
export function Calificar({ yo, codigo, token, proyectoId, onGuardado, onVolver, marco }: CalificarProps) {
  const ronda = yo.sala.ronda_actual
  const proyecto = yo.contenido.portafolio.find((p) => p.id === proyectoId)
  const hoja = yo.contenido.hojas.find((h) => h.proyecto_id === proyectoId && h.perfil_id === yo.participante.perfil.id)
  const [respuestas, setRespuestas] = useState<Record<string, number>>(
    () => leerBorrador(codigo, proyectoId, ronda) ?? { ...(votoDe(yo, proyectoId)?.respuestas ?? {}) },
  )
  const [intento, setIntento] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reintentar, setReintentar] = useState(false)
  const [verHoja, setVerHoja] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  const faltan = yo.criterios.filter((c) => !respuestas[c.id]).length

  const elegir = (criterio: string, valor: number) => {
    const nuevas = { ...respuestas, [criterio]: valor }
    setRespuestas(nuevas)
    guardarBorrador(codigo, proyectoId, ronda, nuevas)
  }

  const guardar = async () => {
    if (guardando) return
    setIntento(true)
    setError(null)
    const pendiente = yo.criterios.find((c) => !respuestas[c.id])
    if (pendiente) {
      contenedor.current?.querySelector<HTMLInputElement>(`[data-criterio="${pendiente.id}"] input`)?.focus()
      return
    }
    setGuardando(true)
    try {
      const resp = {} as Record<string, number>
      for (const c of yo.criterios) resp[c.id] = respuestas[c.id]
      const r = await guardarVoto(token, { proyecto_id: proyectoId, ronda, respuestas: resp })
      guardarBorrador(codigo, proyectoId, ronda, null)
      setReintentar(false)
      onGuardado(r, proyecto?.nombre ?? proyectoId)
    } catch (e) {
      const ea = e instanceof ErrorApi ? e : null
      setReintentar(Boolean(ea?.esRed))
      if (ea?.esRed) setError('Sin conexión. Lo que marcaste está guardado en este celular. Toca "Reintentar guardado" cuando vuelva la señal.')
      else if (ea?.codigo === 'RESPUESTA_INVALIDA') setError('Una de las respuestas no es válida. Vuelve a elegir y guarda de nuevo.')
      else if (ea?.codigo === 'RONDA_CERRADA') setError(`La ronda ${ronda} ya se cerró. Tu última calificación guardada es la que cuenta.`)
      else if (ea?.codigo === 'RONDA_NO_ACTIVA') setError(`La ronda ${ronda} todavía no está abierta.`)
      else setError('Algo falló de nuestro lado. Vuelve a intentarlo en unos segundos.')
    } finally {
      setGuardando(false)
    }
  }

  if (!proyecto) {
    return (
      <Marco {...marco} claveFoco="sin-proyecto">
        <h1 className="hz-titulo">No encontramos ese proyecto</h1>
        <Boton variante="secundario" onClick={onVolver}>
          Volver a los proyectos
        </Boton>
      </Marco>
    )
  }

  return (
    <Marco
      {...marco}
      claveFoco={`calificar-${proyectoId}`}
      notaBarra={faltan > 0 ? `Llevas ${yo.criterios.length - faltan} de ${yo.criterios.length} criterios` : `${yo.criterios.length} de ${yo.criterios.length} criterios listos`}
      barra={
        <Boton bloque cargando={guardando} textoCargando="Guardando…" onClick={() => void guardar()}>
          {reintentar ? 'Reintentar guardado' : 'Guardar calificación'}
        </Boton>
      }
    >
      <Boton variante="fantasma" className="hzp-volver" onClick={onVolver}>
        Volver a los proyectos
      </Boton>
      <h1 className="hz-titulo">{proyecto.nombre}</h1>
      {proyecto.descripcion && <p className="hz-texto-2">{proyecto.descripcion}</p>}
      {hoja && (
        <div className="hzp-hoja-plegable">
          <Boton variante="fantasma" aria-expanded={verHoja} onClick={() => setVerHoja((v) => !v)}>
            {verHoja ? 'Ocultar tu hoja de este proyecto' : 'Ver tu hoja de este proyecto'}
          </Boton>
          {verHoja && <p className="hzp-hoja-plegable__texto">{hoja.texto}</p>}
        </div>
      )}
      {error && <Aviso tono="error">{error}</Aviso>}
      {intento && faltan > 0 && (
        <Aviso tono="error">
          Te faltan {faltan} {faltan === 1 ? 'criterio' : 'criterios'}. Elige una opción en cada uno.
        </Aviso>
      )}
      <div ref={contenedor} className="hzp-rubricas">
        {yo.criterios.map((c, i) => (
          <div key={c.id} data-criterio={c.id}>
            <Rubrica
              criterioId={c.id}
              nombre={c.nombre}
              pregunta={c.pregunta}
              opciones={c.rubrica}
              valor={respuestas[c.id] ?? null}
              onCambio={(v) => elegir(c.id, v)}
              posicion={{ actual: i + 1, total: yo.criterios.length }}
              error={intento && !respuestas[c.id] ? 'Elige una opción para este criterio' : null}
            />
          </div>
        ))}
      </div>
    </Marco>
  )
}
