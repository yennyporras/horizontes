import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useSesion } from '../sesion'
import { ApiError, usaMocks } from '../api'
import { CabeceraPagina, EncabezadoProducto, PiePagina } from '../../shared/ui'
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
  const [verClave, setVerClave] = useState(false)
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
      <EncabezadoProducto href="/" />
      {/* Misma composición que el resto del panel: cabecera de página en el borde del contenido y el formulario debajo. */}
      <main className="login__cuerpo hz-pagina">
        <CabeceraPagina id="titulo-login" titulo="Panel del facilitador" contexto="Entra con el usuario y la clave que te dio Estratek." />
        <form className="panel login__caja" onSubmit={enviar} aria-labelledby="titulo-login">
          {vencida && (
            <p className="alerta alerta--info" role="status">
              Tu sesión terminó. Vuelve a entrar para seguir donde ibas.
            </p>
          )}
          <label className="campo">
            <span>Usuario</span>
            <input autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} />
          </label>
          <div className="campo">
            <label htmlFor="clave-login">Clave</label>
            <div className="login__clave">
              <input
                id="clave-login"
                ref={refClave}
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={clave}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'error-login' : undefined}
                onChange={(e) => setClave(e.target.value)}
              />
              <button
                type="button"
                className="hz-boton hz-boton--secundario"
                aria-controls="clave-login"
                aria-pressed={verClave}
                onClick={() => setVerClave((v) => !v)}
              >
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          {error && (
            <p id="error-login" className="alerta alerta--error" role="alert">
              {error}
              {esperando && ` Podrás intentar de nuevo en ${faltan(esperarHasta - ahora)}.`}
            </p>
          )}
          <button className="hz-boton hz-boton--primario hz-boton--bloque" type="submit" disabled={enviando || esperando} aria-busy={enviando}>
            {enviando ? 'Entrando…' : esperando ? 'Espera un momento' : 'Entrar'}
          </button>
          <details className="login__olvido">
            <summary>¿Olvidaste tu clave?</summary>
            <p>
              <strong>Si eres administrador:</strong> pídele al superadministrador de Estratek que la restablezca en
              Administradores. Te dará una clave temporal y al entrar eliges la tuya.
            </p>
            <p>
              <strong>Si eres el superadministrador:</strong> pon la clave nueva en la variable <code>SUPERADMIN_CLAVE</code> del
              servidor y corre <code>node_modules/.bin/tsx server/restablecer_superadmin.ts --confirmar</code> en la terminal
              del contenedor. Los pasos están en la guía de despliegue.
            </p>
          </details>
          {usaMocks() && <p className="pista">Modo simulado: los datos no se guardan.</p>}
        </form>
      </main>
      <PiePagina />
    </div>
  )
}
