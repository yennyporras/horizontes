import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api } from '../api'
import type { CuerpoAccionSala } from '../../shared/api/contrato'
import type { SalaDetalle } from '../tipos'
import { ESTADOS, opcionesReinicio, type OpcionReinicio } from '../textos'

interface Props {
  d: SalaDetalle
  /** Deshabilita el botón mientras otra acción de la sala está en curso. */
  ocupado?: boolean
  refrescar: () => Promise<void>
  /** Aviso al terminar («Volviste a la ronda 1 abierta…»). */
  alTerminar: (texto: string) => void
}

/**
 * «Reiniciar…» de Corregir en Sala en vivo (decisión 3 de Paola, 21-oct: «el administrador puede escoger qué desea
 * reiniciar»). Un diálogo con las opciones que aplican al estado actual, cada una con su línea de qué pasa. Ninguna
 * viene marcada: el botón se habilita al elegir. «Reiniciar la sala completa» pide además el nombre exacto de la sala.
 * Esc y Cancelar cierran sin cambiar nada; al cerrar, el foco vuelve a «Reiniciar…».
 */
export function Reiniciar({ d, ocupado, refrescar, alTerminar }: Props) {
  const opciones = opcionesReinicio(d.sala.estado)
  const [abierto, setAbierto] = useState(false)
  const [elegida, setElegida] = useState<OpcionReinicio | null>(null)
  const [nombre, setNombre] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogo = useRef<HTMLDialogElement>(null)
  const primera = useRef<HTMLInputElement>(null)
  const origen = useRef<HTMLButtonElement>(null)
  const opcion = opciones.find((o) => o.id === elegida) ?? null
  const pideNombre = opcion?.id === 'sala'
  const listo = !!opcion && (!pideNombre || nombre.trim() === d.sala.nombre)

  useEffect(() => {
    const el = dialogo.current
    if (!abierto || !el) return
    if (!el.open) {
      if (typeof el.showModal === 'function') el.showModal()
      else el.setAttribute('open', '')
    }
    primera.current?.focus()
  }, [abierto])

  // Si la sala cambia de estado con el diálogo abierto y la opción elegida ya no aplica, se desmarca.
  useEffect(() => {
    if (elegida && !opciones.some((o) => o.id === elegida)) setElegida(null)
  }, [d.sala.estado])

  if (opciones.length === 0) return null

  const cerrar = () => {
    const el = dialogo.current
    if (el?.open) {
      if (typeof el.close === 'function') el.close()
      else el.removeAttribute('open')
    }
    setAbierto(false)
    setElegida(null)
    setNombre('')
    setError(null)
    setEnviando(false)
    origen.current?.focus()
  }

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (!opcion || !listo || enviando) return
    setEnviando(true)
    setError(null)
    try {
      const cuerpo: CuerpoAccionSala = { ...opcion.cuerpo, ...(pideNombre ? { confirmar: nombre.trim() } : {}) }
      await api.post(`/api/admin/salas/${encodeURIComponent(d.sala.id)}/acciones`, cuerpo)
      const hecho = opcion.hecho
      cerrar()
      alTerminar(hecho)
      await refrescar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reiniciar. Intenta de nuevo.')
      setEnviando(false)
    }
  }

  return (
    <>
      <button ref={origen} type="button" className="hz-boton hz-boton--peligro" disabled={ocupado} aria-describedby="que-pasa-reiniciar" onClick={() => setAbierto(true)}>
        Reiniciar…
      </button>
      <span id="que-pasa-reiniciar" className="pista">
        Elige qué reiniciar: volver a la ronda anterior, una ronda o la sala completa. Antes de aplicar ves qué pasa con cada opción.
      </span>
      {abierto && (
        <dialog
          ref={dialogo}
          className="dialogo-eliminar"
          aria-labelledby="reiniciar-titulo"
          onCancel={(e) => {
            e.preventDefault()
            cerrar()
          }}
        >
          <h2 id="reiniciar-titulo">¿Qué quieres reiniciar?</h2>
          <form onSubmit={enviar}>
            <fieldset>
              <legend>Estado actual: {ESTADOS[d.sala.estado]}. Solo aparecen las opciones que aplican.</legend>
              {opciones.map((o, i) => (
                <label key={o.id} className="opcion">
                  <input
                    ref={i === 0 ? primera : undefined}
                    type="radio"
                    name="reinicio"
                    value={o.id}
                    checked={elegida === o.id}
                    aria-describedby={`reinicio-${o.id}-que`}
                    onChange={() => {
                      setElegida(o.id)
                      setError(null)
                    }}
                  />
                  <span>
                    {o.titulo}
                    <small id={`reinicio-${o.id}-que`}>{o.quePasa}</small>
                  </span>
                </label>
              ))}
            </fieldset>
            {pideNombre && (
              <div className="campo">
                <label htmlFor="reiniciar-sala-nombre">Escribe el nombre de la sala para confirmar: {d.sala.nombre}</label>
                <input
                  id="reiniciar-sala-nombre"
                  autoComplete="off"
                  spellCheck={false}
                  value={nombre}
                  aria-invalid={error ? true : undefined}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </div>
            )}
            {opcion?.borra && <p className="pista">Lo borrado no se puede deshacer desde el panel. Queda registrado en la bitácora.</p>}
            {error && (
              <p className="alerta alerta--error" role="alert">
                {error}
              </p>
            )}
            <div className="acciones">
              <button type="button" className="hz-boton hz-boton--secundario" onClick={cerrar}>
                Cancelar
              </button>
              <button
                type="submit"
                className={`hz-boton ${opcion && !opcion.borra ? 'hz-boton--primario' : 'hz-boton--destructivo'}`}
                disabled={!listo || enviando}
                aria-busy={enviando}
              >
                {enviando ? 'Aplicando…' : (opcion?.boton ?? 'Reiniciar')}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  )
}
