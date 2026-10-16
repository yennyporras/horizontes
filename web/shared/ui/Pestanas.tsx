import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

export interface Pestana {
  id: string
  titulo: string
  contenido: ReactNode
}

export interface PestanasProps {
  pestanas: Pestana[]
  activa: string
  onCambio: (id: string) => void
  etiqueta: string
}

const TECLAS: Record<string, (i: number, n: number) => number> = {
  ArrowRight: (i) => i + 1,
  ArrowLeft: (i) => i - 1,
  Home: () => 0,
  End: (_i, n) => n - 1,
}

/** Patrón ARIA tablist con flechas, Inicio y Fin. */
export function Pestanas({ pestanas, activa, onCambio, etiqueta }: PestanasProps) {
  const base = useId()
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const indice = Math.max(0, pestanas.findIndex((p) => p.id === activa))
  const actual = pestanas[indice]

  const mover = (e: KeyboardEvent) => {
    const calc = TECLAS[e.key]
    if (!calc) return
    e.preventDefault()
    const n = pestanas.length
    const i = (calc(indice, n) + n) % n
    onCambio(pestanas[i].id)
    refs.current[i]?.focus()
  }

  return (
    <div className="hz-pestanas">
      <div className="hz-pestanas__lista" role="tablist" aria-label={etiqueta} onKeyDown={mover}>
        {pestanas.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            id={`${base}-tab-${p.id}`}
            role="tab"
            type="button"
            className="hz-pestanas__tab"
            aria-selected={i === indice}
            aria-controls={`${base}-panel-${p.id}`}
            tabIndex={i === indice ? 0 : -1}
            onClick={() => onCambio(p.id)}
          >
            {p.titulo}
          </button>
        ))}
      </div>
      {actual && (
        <div id={`${base}-panel-${actual.id}`} role="tabpanel" aria-labelledby={`${base}-tab-${actual.id}`} className="hz-pestanas__panel" tabIndex={0}>
          {actual.contenido}
        </div>
      )}
    </div>
  )
}
