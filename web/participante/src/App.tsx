import { Aviso, EncabezadoHorizonte, MuestraUI } from '@ui'

/** Enrutador mínimo del participante. R1 lo reemplaza por el del esqueleto. */
export function App({ ruta = window.location.pathname }: { ruta?: string }) {
  if (ruta.replace(/\/$/, '') === '/m/_ui') return <MuestraUI />
  return (
    <div className="hz hz-pagina" lang="es-CO">
      <EncabezadoHorizonte sala="Taller Horizontes" />
      <main className="hz-contenido">
        <h1 className="hz-titulo">No encontramos esta mesa</h1>
        <Aviso tono="info">Revisa el QR de tu mesa o pídele el enlace al facilitador.</Aviso>
      </main>
    </div>
  )
}
