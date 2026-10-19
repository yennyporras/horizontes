// T4: panel admin (salas, mesas y QR, rondas, configuración, participantes, export, admins).
import { useTemaDocumento } from '../shared/ui'
import './admin.css'
import { SesionProvider } from './sesion'
import { Rutas } from './App'

/** Tema claro de la familia Estratek; la barra superior lleva su propio data-tema="carbon" (Marco y Login). */
export default function PaginaAdmin() {
  useTemaDocumento('claro')
  return (
    <div className="hz-admin" data-ruta="admin" data-tema="claro">
      <SesionProvider>
        <Rutas />
      </SesionProvider>
    </div>
  )
}
