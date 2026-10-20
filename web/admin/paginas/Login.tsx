import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion'
import { ApiError, usaMocks } from '../api'
import { EncabezadoProducto } from '../../shared/ui'
import { useTituloPagina } from './EncabezadoSala'
import { faltan } from '../textos'

/** Tras demasiados intentos (429), el servidor pide esperar un minuto: el botón espera y dice cuánto falta. */
const ESPERA_MS = 60_000

export function Login() {
  const { admin, entrar, vencida } = useSesion()
  const navegar = useNavigate()
  const desde = (useLocation().state as { desde?: string } | null)?.desde ?? '/admin/salas'
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [esperarHasta, setEsperarHasta] = useState(0)
  const [ahora, setAhora] = useState(() => Date.now())
  const refClave = useRef<HTMLInputElement>(null)
  useTituloPagina('Entrar al panel')

  useEffect(() => {
    if (esperarHasta <= ahora) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [esperarHasta, ahora])

  if (admin) return <Navigate to={desde} replace />
  const esperando = esperarHasta > ahora

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    if (esperando) return
    setError(null)
    setEnviando(true)
    try {
      await entrar(usuario.trim(), clave)
      navegar(desde, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
      if (err instanceof ApiError && err.status === 429) {
        setEsperarHasta(Date.now() + ESPERA_MS)
        setAhora(Date.now())
      }
      setEnviando(false)
      // QA-A-19: el foco vuelve a la clave (seleccionada) para corregir sin volver a tabular desde el principio.
      requestAnimationFrame(() => {
        refClave.current?.focus()
        refClave.current?.select()
      })
      return
    }
    setEnviando(false)
  }

  return (
    <div className="login">
      <div data-tema="carbon">
        <EncabezadoProducto />
      </div>
      <main className="login__cuerpo">
        <form className="panel login__caja" onSubmit={enviar} aria-labelledby="titulo-login">
          <h1 id="titulo-login">Panel de administración</h1>
          {vencida && (
            <p className="alerta alerta--info" role="status">
              Tu sesión terminó. Vuelve a entrar para seguir donde ibas.
            </p>
          )}
          <label className="campo">
            <span>Usuario</span>
            <input autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </label>
          <label className="campo">
            <span>Clave</span>
            <input
              ref={refClave}
              type="password"
              autoComplete="current-password"
              required
              value={clave}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'error-login' : undefined}
              onChange={(e) => setClave(e.target.value)}
            />
          </label>
          {error && (
            <p id="error-login" className="alerta alerta--error" role="alert">
              {error}
              {esperando && ` Podrás intentar de nuevo en ${faltan(esperarHasta - ahora)}.`}
            </p>
          )}
          <button className="hz-boton hz-boton--primario hz-boton--bloque" type="submit" disabled={enviando || esperando} aria-busy={enviando}>
            {enviando ? 'Entrando…' : esperando ? 'Espera un momento' : 'Entrar'}
          </button>
          {usaMocks() && <p className="pista">Modo simulado: los datos no se guardan.</p>}
        </form>
      </main>
    </div>
  )
}
