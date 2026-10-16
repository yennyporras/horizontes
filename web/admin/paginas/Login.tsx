import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion'
import { usaMocks } from '../api'

export function Login() {
  const { admin, entrar } = useSesion()
  const navegar = useNavigate()
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/admin/salas'
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (admin) return <Navigate to={desde} replace />

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await entrar(usuario.trim(), clave)
      navegar(desde, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="login">
      <form className="panel login__caja" onSubmit={enviar} aria-labelledby="titulo-login">
        <p className="marca">Horizontes</p>
        <h1 id="titulo-login">Panel de administración</h1>
        <label className="campo">
          <span>Usuario</span>
          <input autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
        </label>
        <label className="campo">
          <span>Clave</span>
          <input type="password" autoComplete="current-password" required value={clave} onChange={(e) => setClave(e.target.value)} />
        </label>
        {error && (
          <p className="alerta alerta--error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn--primario btn--bloque" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        {usaMocks() && <p className="pista">Modo simulado: paola o jorge, clave demo1234.</p>}
      </form>
    </main>
  )
}
