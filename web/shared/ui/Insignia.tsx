import type { ReactNode } from 'react'

/** `r1` hueco (verde) y `r2` sólido (rojo): la forma y el texto «R1»/«R2» distinguen la ronda sin depender del color. */
export type TonoInsignia = 'neutra' | 'ok' | 'alerta' | 'r1' | 'r2'

export function Insignia({ tono = 'neutra', children }: { tono?: TonoInsignia; children: ReactNode }) {
  return <span className={`hz-insignia hz-insignia--${tono}`}>{children}</span>
}
