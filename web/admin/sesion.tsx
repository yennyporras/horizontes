import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, ApiError } from './api'
import type { AdminYo } from './tipos'

interface Sesion {
  admin: AdminYo | null
  cargando: boolean
  entrar: (usuario: string, clave: string) => Promise<void>
  salir: () => Promise<void>
  refrescar: () => Promise<void>
}

const Ctx = createContext<Sesion | null>(null)

export function SesionProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminYo | null>(null)
  const [cargando, setCargando] = useState(true)

  const refrescar = useCallback(async () => {
    try {
      setAdmin(await api.get<AdminYo>('/api/admin/yo'))
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAdmin(null)
      else throw e
    }
  }, [])

  useEffect(() => {
    refrescar()
      .catch(() => setAdmin(null))
      .finally(() => setCargando(false))
  }, [refrescar])

  const entrar = async (usuario: string, clave: string) => {
    await api.post('/api/admin/login', { usuario, clave })
    await refrescar()
  }

  const salir = async () => {
    await api.post('/api/admin/logout').catch(() => undefined)
    setAdmin(null)
  }

  return <Ctx.Provider value={{ admin, cargando, entrar, salir, refrescar }}>{children}</Ctx.Provider>
}

export function useSesion() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSesion fuera de SesionProvider')
  return s
}
