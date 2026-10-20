import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ReactNode } from 'react'
import { useConfirmar } from './Confirmar'

interface Pendientes {
  registrar: (id: string, mensaje: string | null) => void
  /** true si alguna vista tiene cambios sin guardar. */
  hayPendientes: () => boolean
  /** true si se puede salir: no hay cambios sin guardar o la persona eligió descartarlos. */
  confirmarSalida: () => Promise<boolean>
}

const Ctx = createContext<Pendientes>({ registrar: () => undefined, hayPendientes: () => false, confirmarSalida: async () => true })

/**
 * QA-A-14: cambios sin guardar (por ahora, las rúbricas). Antes de cambiar de sección o salir del panel se pregunta si
 * se descartan; al cerrar o recargar la pestaña, el navegador avisa con su propio diálogo.
 */
export function ProveedorPendientes({ children }: { children: ReactNode }) {
  const pendientes = useRef(new Map<string, string>())
  const [dialogo, confirmar] = useConfirmar()

  useEffect(() => {
    const antesDeSalir = (e: BeforeUnloadEvent) => {
      if (pendientes.current.size === 0) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', antesDeSalir)
    return () => window.removeEventListener('beforeunload', antesDeSalir)
  }, [])

  const registrar = useCallback((id: string, mensaje: string | null) => {
    if (mensaje) pendientes.current.set(id, mensaje)
    else pendientes.current.delete(id)
  }, [])

  const confirmarSalida = useCallback(async () => {
    const mensaje = [...pendientes.current.values()][0]
    if (!mensaje) return true
    const ok = await confirmar('¿Salir sin guardar?', mensaje, 'Salir sin guardar', { cancelar: 'Seguir editando' })
    if (ok) pendientes.current.clear()
    return ok
  }, [confirmar])

  const hayPendientes = useCallback(() => pendientes.current.size > 0, [])
  const valor = useMemo(() => ({ registrar, hayPendientes, confirmarSalida }), [registrar, hayPendientes, confirmarSalida])
  return (
    <Ctx.Provider value={valor}>
      {dialogo}
      {children}
    </Ctx.Provider>
  )
}

/** Marca que esta vista tiene cambios sin guardar (`mensaje` explica cuáles); null cuando ya no los hay. */
export function usePendiente(mensaje: string | null) {
  const { registrar } = useContext(Ctx)
  const id = useId()
  useEffect(() => {
    registrar(id, mensaje)
    return () => registrar(id, null)
  }, [registrar, id, mensaje])
}

export const usePendientes = () => useContext(Ctx)
