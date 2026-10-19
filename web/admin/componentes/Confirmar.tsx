import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

interface Pedido {
  titulo: string
  texto: string
  confirmar: string
  resolver: (ok: boolean) => void
}

/** Diálogo de confirmación accesible (<dialog> nativo). Devuelve el elemento y una función que espera la respuesta. */
export function useConfirmar(): [ReactNode, (titulo: string, texto: string, confirmar: string) => Promise<boolean>] {
  const [pedido, setPedido] = useState<Pedido | null>(null)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = ref.current
    if (!d || !pedido) return
    if (d.open) return
    if (typeof d.showModal === 'function') d.showModal()
    else d.setAttribute('open', '')
  }, [pedido])

  const cerrar = (ok: boolean) => {
    const d = ref.current
    if (d?.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
    pedido?.resolver(ok)
    setPedido(null)
  }

  const pedir = useCallback(
    (titulo: string, texto: string, confirmar: string) => new Promise<boolean>((resolver) => setPedido({ titulo, texto, confirmar, resolver })),
    [],
  )

  const elemento = pedido ? (
    <dialog ref={ref} aria-labelledby="confirmar-titulo" onCancel={() => cerrar(false)}>
      <h2 id="confirmar-titulo">{pedido.titulo}</h2>
      <p>{pedido.texto}</p>
      <div className="acciones">
        <button className="hz-boton hz-boton--destructivo" onClick={() => cerrar(true)}>
          {pedido.confirmar}
        </button>
        <button className="hz-boton hz-boton--secundario" autoFocus onClick={() => cerrar(false)}>
          Cancelar
        </button>
      </div>
    </dialog>
  ) : null

  return [elemento, pedir]
}
