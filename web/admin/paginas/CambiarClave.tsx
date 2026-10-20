import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSesion } from '../sesion'
import { EncabezadoProducto } from '../../shared/ui'

export function CambiarClave() {
  const { refrescar } = useSesion()
  const navegar = useNavigate()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (nueva !== repetir) return setError('Las dos claves nuevas no coinciden.')
    try {
      await api.post('/api/admin/cambiar-clave', { actual, nueva })
      await refrescar()
      navegar('/admin/salas', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la clave.')
    }
  }

  return (
    <div className="login">
      <div data-tema="carbon">
        <EncabezadoProducto href="/" />
      </div>
      <main className="login__cuerpo">
        <form className="panel login__caja" onSubmit={enviar} aria-labelledby="titulo-clave">
          <h1 id="titulo-clave">Cambia tu clave</h1>
          <p>Es tu primer ingreso. Elige una clave propia de al menos 10 caracteres.</p>
          <label className="campo">
            <span>Clave temporal</span>
            <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label className="campo">
            <span>Clave nueva</span>
            <input type="password" autoComplete="new-password" minLength={10} required value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </label>
          <label className="campo">
            <span>Repite la clave nueva</span>
            <input type="password" autoComplete="new-password" minLength={10} required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          </label>
          {error && (
            <p className="alerta alerta--error" role="alert">
              {error}
            </p>
          )}
          <button className="hz-boton hz-boton--primario hz-boton--bloque" type="submit">
            Guardar clave
          </button>
        </form>
      </main>
    </div>
  )
}
