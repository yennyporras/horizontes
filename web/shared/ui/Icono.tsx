export type TonoIcono = 'info' | 'ok' | 'alerta' | 'error'

const SIGNO: Record<TonoIcono, string> = { info: 'i', ok: '✓', alerta: '!', error: '!' }

/** Icono de estado en círculo. Decorativo: el significado siempre va en el texto que lo acompaña. */
export function Icono({ tono }: { tono: TonoIcono }) {
  return (
    <span className="hz-icono" aria-hidden="true">
      <span>{SIGNO[tono]}</span>
    </span>
  )
}
