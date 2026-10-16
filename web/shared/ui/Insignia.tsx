import type { ReactNode } from 'react'

export type TonoInsignia = 'neutra' | 'ok' | 'alerta'

export function Insignia({ tono = 'neutra', children }: { tono?: TonoInsignia; children: ReactNode }) {
  return <span className={`hz-insignia hz-insignia--${tono}`}>{children}</span>
}
