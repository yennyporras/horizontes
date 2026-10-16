import type { ReactNode } from 'react'
import { Icono, type TonoIcono } from './Icono'
import { Boton } from './Boton'

export interface AvisoProps {
  tono?: TonoIcono
  titulo?: string
  children?: ReactNode
  accion?: { texto: string; onClick: () => void }
}

/** info y ok se anuncian con role=status; alerta y error con role=alert. */
export function Aviso({ tono = 'info', titulo, children, accion }: AvisoProps) {
  const rol = tono === 'error' || tono === 'alerta' ? 'alert' : 'status'
  return (
    <div className={`hz-aviso hz-aviso--${tono}`} role={rol}>
      <Icono tono={tono} />
      <div className="hz-aviso__cuerpo">
        {titulo && <p className="hz-aviso__titulo">{titulo}</p>}
        {children && <div>{children}</div>}
        {accion && (
          <Boton variante="fantasma" onClick={accion.onClick}>
            {accion.texto}
          </Boton>
        )}
      </div>
    </div>
  )
}
