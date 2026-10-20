import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { alPerderSesion, api, ApiError } from './api'
import type { AdminYo } from './tipos'

interface Sesion {
  admin: AdminYo | null
  cargando: boolean
  /** F-5: la sesión venció mientras se usaba el panel (un 401 en cualquier sección). El login lo explica. */
  vencida: boolean
  entrar: (usuario: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  refrescar: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminYo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [vencida, setVencida] = useState(false)

  const refrescar = useCallback(async () => {
    try {
      setAdmin(await api.get<AdminYo>('/api/admin/yo'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAdmin(null)
      else throw e
    }
  }, [])

  // Un 401 en cualquier sección lleva al login (RequiereSesion redirige al quedar sin admin).
  const conSesion = useRef(false)
  conSesion.current = admin !== null
  useEffect(
    () =>
      alPerderSesion(() => {
        if (conSesion.current) setVencida(true)
        setAdmin(null)
      }),
    [],
  )

  useEffect(() => {
    refrescar()
      .catch(() => setAdmin(null))
      .finally(() => setCargando(false))
  }, [refrescar])

  const entrar = async (usuario: string, clave: string) => {
    await api.post('/api/admin/login', { usuario, clave })
    await refrescar()
    setVencida(false)
  }

  const salir = async () => {
    await api.post('/api/admin/logout').catch(() => undefined)
    setVencida(false)
    setAdmin(null)
  }

  return <Ctx.Provider value={{ admin, cargando, vencida, entrar, salir, refrescar }}>{children}</Ctx.Provider>
}

export function useSesion() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSesion fuera de SesionProvider')
  return s
}
