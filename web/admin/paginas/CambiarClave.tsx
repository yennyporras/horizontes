import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useSesion } from '../sesion'
import { EncabezadoProducto } from '../../shared/ui'
import { PiePanel } from '../Marco'
import { useTituloPagina } from './EncabezadoSala'
import { LARGO_MINIMO_CLAVE } from '../textos'

/**
 * Cambio de clave. En el primer ingreso es obligatorio (la clave actual es la temporal); QA-A-22: después, cualquier
 * admin entra aquí desde «Cambiar mi clave» y puede volver sin cambiarla.
 */
export function CambiarClave() {
  const { admin, refrescar } = useSesion()
  const navegar = useNavigate()
  const obligatorio = Boolean(admin?.debe_cambiar_clave)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  useTituloPagina('Cambiar mi clave')

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (nueva !== repetir) return setError('Las dos claves nuevas no coinciden.')
    setError(null)
    setEnviando(true)
    try {
      await api.post('/api/admin/cambiar-clave', { actual, nueva })
      await refrescar()
      navegar('/admin/salas', { replace: true, state: { claveCambiada: true } })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la clave.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div data-tema="carbon">
        <EncabezadoProducto href="/admin/salas" />
      </div>
      <main className="login__cuerpo hz-pagina">
        <form className="panel login__caja" onSubmit={enviar} aria-labelledby="titulo-clave">
          <h1 id="titulo-clave">{obligatorio ? 'Cambia tu clave' : 'Cambiar mi clave'}</h1>
          <p>
            {obligatorio
              ? `Es tu primer ingreso. Elige una clave propia de al menos ${LARGO_MINIMO_CLAVE} caracteres.`
              : `Escribe tu clave actual y elige una nueva de al menos ${LARGO_MINIMO_CLAVE} caracteres.`}
          </p>
          <label className="campo">
            <span>{obligatorio ? 'Clave temporal' : 'Clave actual'}</span>
            <input type="password" autoComplete="current-password" required value={actual} onChange={(e) => setActual(e.target.value)} />
          </label>
          <label className="campo">
            <span>Clave nueva</span>
            <input type="password" autoComplete="new-password" minLength={LARGO_MINIMO_CLAVE} required value={nueva} onChange={(e) => setNueva(e.target.value)} />
          </label>
          <label className="campo">
            <span>Repite la clave nueva</span>
            <input type="password" autoComplete="new-password" minLength={LARGO_MINIMO_CLAVE} required value={repetir} onChange={(e) => setRepetir(e.target.value)} />
          </label>
          {error && (
            <p className="alerta alerta--error" role="alert">
              {error}
            </p>
          )}
          <button className="hz-boton hz-boton--primario hz-boton--bloque" type="submit" disabled={enviando} aria-busy={enviando}>
            {enviando ? 'Guardando…' : 'Guardar clave'}
          </button>
          {!obligatorio && (
            <Link className="hz-boton hz-boton--secundario hz-boton--bloque" to="/admin/salas">
              Volver sin cambiarla
            </Link>
          )}
        </form>
      </main>
      <PiePanel />
    </div>
  )
}
