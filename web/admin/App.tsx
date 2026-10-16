import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSesion } from './sesion'
import { Marco } from './Marco'
import { Login } from './paginas/Login'
import { CambiarClave } from './paginas/CambiarClave'
import { Salas } from './paginas/Salas'
import { SalaEnVivo } from './paginas/SalaEnVivo'
import { Participantes } from './paginas/Participantes'
import { Configuracion } from './paginas/Configuracion'
import { Exportar } from './paginas/Exportar'
import { Administradores } from './paginas/Administradores'
import { ElegirSala } from './paginas/ElegirSala'
import { MesasQR } from './paginas/MesasQR'
import { Salud } from './paginas/Salud'

function RequiereSesion({ children }: { children: ReactNode }) {
  const { admin, cargando } = useSesion()
  const ubicacion = useLocation()
  if (cargando) return <p className="cargando" role="status">Cargando…</p>
  if (!admin) return <Navigate to="/admin/login" replace state={{ desde: ubicacion.pathname }} />
  if (admin.debe_cambiar_clave && ubicacion.pathname !== '/admin/cambiar-clave') return <Navigate to="/admin/cambiar-clave" replace />
  return <>{children}</>
}

export function SoloSuperadmin({ children }: { children: ReactNode }) {
  const { admin } = useSesion()
  if (admin?.rol !== 'superadmin') {
    return (
      <section className="panel" aria-labelledby="t403">
        <h1 id="t403">Sin permiso</h1>
        <p>La gestión de administradores es solo para el superadmin. Si necesitas una cuenta nueva, pídesela a Paola.</p>
      </section>
    )
  }
  return <>{children}</>
}

/** Rutas del panel, relativas a /admin (el BrowserRouter usa basename="/admin"). */
export function Rutas() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route
        path="cambiar-clave"
        element={
          <RequiereSesion>
            <CambiarClave />
          </RequiereSesion>
        }
      />
      <Route
        element={
          <RequiereSesion>
            <Marco />
          </RequiereSesion>
        }
      >
        <Route index element={<Navigate to="/admin/salas" replace />} />
        <Route path="salas" element={<Salas />} />
        <Route path="sala/:seccion" element={<ElegirSala />} />
        <Route path="salas/:salaId/vivo" element={<SalaEnVivo />} />
        <Route path="salas/:salaId/mesas" element={<MesasQR />} />
        <Route path="salas/:salaId/participantes" element={<Participantes />} />
        <Route path="salas/:salaId/configuracion" element={<Configuracion />} />
        <Route path="salas/:salaId/export" element={<Exportar />} />
        <Route
          path="administradores"
          element={
            <SoloSuperadmin>
              <Administradores />
            </SoloSuperadmin>
          }
        />
        <Route path="salud" element={<Salud />} />
        <Route path="*" element={<Navigate to="/admin/salas" replace />} />
      </Route>
    </Routes>
  )
}
