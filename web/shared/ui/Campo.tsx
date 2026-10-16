import { useId, type InputHTMLAttributes } from 'react'
import { Icono } from './Icono'

export interface CampoProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etiqueta: string
  ayuda?: string
  error?: string | null
}

export function Campo({ etiqueta, ayuda, error, className, ...resto }: CampoProps) {
  const id = useId()
  const idAyuda = ayuda ? `${id}-ayuda` : undefined
  const idError = error ? `${id}-error` : undefined
  const describe = [idError, idAyuda].filter(Boolean).join(' ') || undefined
  return (
    <div className={['hz-campo', className].filter(Boolean).join(' ')}>
      <label className="hz-campo__etiqueta" htmlFor={id}>
        {etiqueta}
      </label>
      <input {...resto} id={id} className="hz-campo__entrada" aria-invalid={error ? true : undefined} aria-describedby={describe} />
      {error && (
        <p id={idError} className="hz-campo__error">
          <Icono tono="error" />
          {error}
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="hz-campo__ayuda">
          {ayuda}
        </p>
      )}
    </div>
  )
}
