import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

export interface OpcionesConfirmar {
  /** Texto del botón que no hace nada. Por defecto «Cancelar». */
  cancelar?: string
  /** `destructivo` (rojo) para lo que borra o cierra; `primario` para lo que solo pide atención. */
  tono?: 'destructivo' | 'primario'
}

interface Pedido extends OpcionesConfirmar {
  titulo: string
  texto: ReactNode
  confirmar: string
  resolver: (ok: boolean) => void
}

export type Confirmar = (titulo: string, texto: ReactNode, confirmar: string, opciones?: OpcionesConfirmar) => Promise<boolean>

/**
 * Diálogo de confirmación accesible (<dialog> nativo). Devuelve el elemento y una función que espera la respuesta.
 * QA-A-02: abre con el foco en «Cancelar», así un Enter o un Espacio accidental no confirma. Esc también cancela. Al
 * cerrar, el foco vuelve al control que abrió el diálogo.
 */
export function useConfirmar(): [ReactNode, Confirmar] {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  const cancelar = useRef<HTMLButtonElement>(null)
  const origen = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const d = ref.current
    if (!d || !pedido) return
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    // showModal() enfoca el primer control del diálogo; el foco va a Cancelar después de abrir.
    cancelar.current?.focus()
  }, [pedido])

  const cerrar = (ok: boolean) => {
    const d = ref.current
    if (d?.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
    pedido?.resolver(ok)
    setPedido(null)
    const volver = origen.current
    origen.current = null
    if (volver?.isConnected) volver.focus()
  }

  const pedir = useCallback<Confirmar>((titulo, texto, confirmar, opciones = {}) => {
    origen.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    return new Promise<boolean>((resolver) => setPedido({ titulo, texto, confirmar, resolver, ...opciones }))
  }, [])

  const elemento = pedido ? (
    <dialog
      ref={ref}
      aria-labelledby="confirmar-titulo"
      aria-describedby="confirmar-texto"
      onCancel={(e) => {
        e.preventDefault()
        cerrar(false)
      }}
    >
      <h2 id="confirmar-titulo">{pedido.titulo}</h2>
      <div id="confirmar-texto" className="dialogo__texto">
        {typeof pedido.texto === 'string' ? <p>{pedido.texto}</p> : pedido.texto}
      </div>
      <div className="acciones">
        <button ref={cancelar} type="button" className="hz-boton hz-boton--secundario" onClick={() => cerrar(false)}>
          {pedido.cancelar ?? 'Cancelar'}
        </button>
        <button type="button" className={`hz-boton hz-boton--${pedido.tono ?? 'destructivo'}`} onClick={() => cerrar(true)}>
          {pedido.confirmar}
        </button>
      </div>
    </dialog>
  ) : null

  return [elemento, pedir]
}
