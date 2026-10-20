import { useEffect, useRef } from 'react'

/** Teclas del tablero, en el orden en que se usan durante el taller. */
export const TECLAS: { teclas: string[]; texto: string }[] = [
  { teclas: ['F'], texto: 'Pantalla completa de la matriz (entra y sale; Esc también sale)' },
  { teclas: ['Rueda', 'pellizco'], texto: 'Acerca la matriz en pantalla completa o con el foco en ella; arrastrar la mueve' },
  { teclas: ['0'], texto: 'Matriz entera (quita el zoom)' },
  { teclas: ['G'], texto: 'Gráfica: solo la matriz' },
  { teclas: ['D'], texto: 'Detallado: la matriz con los promedios' },
  { teclas: ['M'], texto: 'Cambia entre Gráfica y Detallado' },
  { teclas: ['V'], texto: 'Promedios o «Cómo votó»' },
  { teclas: ['1'], texto: 'Ronda 1' },
  { teclas: ['2'], texto: 'Ronda 2' },
  { teclas: ['C'], texto: 'Comparación; otra vez, repite la animación' },
  { teclas: ['→', 'Página siguiente'], texto: 'Vista siguiente' },
  { teclas: ['←', 'Página anterior'], texto: 'Vista anterior' },
  { teclas: ['?'], texto: 'Esta ayuda' },
]

/**
 * Ayuda de teclas superpuesta (tecla ?, pedido de Nicolai). Se cierra con Esc (lo maneja usePantallaCompleta), con
 * ? otra vez o con el botón. No bloquea los atajos: el facilitador puede probarlos con la ayuda abierta.
 */
export function AyudaTeclas({ onCerrar }: { onCerrar: () => void }) {
  const boton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null
    boton.current?.focus()
    return () => previo?.focus?.()
  }, [])
  return (
    <div className="hz-ayuda" role="dialog" aria-modal="false" aria-labelledby="hz-ayuda-t">
      <div className="hz-ayuda-caja">
        <h2 id="hz-ayuda-t">Teclas del tablero</h2>
        <dl className="hz-ayuda-lista">
          {TECLAS.map((t) => (
            <div key={t.texto}>
              <dt>
                {t.teclas.map((k, i) => (
                  <span key={k}>
                    {i > 0 && <span className="hz-ayuda-o"> o </span>}
                    <kbd>{k}</kbd>
                  </span>
                ))}
              </dt>
              <dd>{t.texto}</dd>
            </div>
          ))}
        </dl>
        <button ref={boton} type="button" className="hz-boton-pantalla" onClick={onCerrar}>
          Cerrar <kbd>Esc</kbd>
        </button>
      </div>
    </div>
  )
}
