// T4: panel admin (salas, mesas y QR, rondas, configuración, participantes, export, admins).
import './admin.css'
import { SesionProvider } from './sesion'
import { Rutas } from './App'

export default function PaginaAdmin() {
  return (
    <div className="hz-admin" data-ruta="admin">
      <SesionProvider>
        <Rutas />
      </SesionProvider>
    </div>
  )
}
