import { useId } from 'react'
import { ArcoHorizonte } from './ArcoHorizonte'
import { Icono } from './Icono'

export interface OpcionRubrica {
  valor: number
  texto: string
}

export interface RubricaProps {
  /** Id del criterio (nombre del grupo de radios). */
  criterioId: string
  nombre: string
  pregunta: string
  opciones: OpcionRubrica[]
  valor: number | null
  onCambio: (valor: number) => void
  /** Para el texto "Criterio 3 de 6". */
  posicion?: { actual: number; total: number }
  error?: string | null
}

/** Tarjeta de rúbrica seleccionable. Muestra las opciones de 9 a 1 con el texto completo. */
export function Rubrica({ criterioId, nombre, pregunta, opciones, valor, onCambio, posicion, error }: RubricaProps) {
  const id = useId()
  const ordenadas = [...opciones].sort((a, b) => b.valor - a.valor)
  return (
    <fieldset className={['hz-rubrica', error && 'hz-rubrica--error'].filter(Boolean).join(' ')} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className="hz-rubrica__encabezado">
        <span className="hz-rubrica__criterio">
          {posicion ? `Criterio ${posicion.actual} de ${posicion.total}: ` : ''}
          {nombre}
        </span>
        <span className="hz-rubrica__pregunta">{pregunta}</span>
      </legend>
      <div className="hz-rubrica__opciones">
        {ordenadas.map((o) => (
          <label key={o.valor} className="hz-opcion">
            <input className="hz-opcion__input" type="radio" name={`${criterioId}-${id}`} value={o.valor} checked={valor === o.valor} onChange={() => onCambio(o.valor)} />
            <ArcoHorizonte valor={o.valor} />
            <span className="hz-opcion__valor" aria-hidden="true">
              {o.valor}
            </span>
            <span className="hz-opcion__texto">
              <span className="hz-visual-oculto">{o.valor}: </span>
              {o.texto}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className="hz-rubrica__error">
          <Icono tono="error" />
          {error}
        </p>
      )}
    </fieldset>
  )
}
