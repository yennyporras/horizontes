import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSesion } from './sesion'
import { api, usaMocks } from './api'
import { dominioDistinto } from './textos'

const LLAVE_SALA = 'hz_admin_sala'

export function recordarSala(id: string) {
  localStorage.setItem(LLAVE_SALA, id)
}

export function salaRecordada(): string | null {
  return localStorage.getItem(LLAVE_SALA)
}

/** La sala recordada ya no existe (otra base, sala de otro ambiente): las secciones vuelven a pedir sala. */
export function olvidarSala(id: string) {
  if (salaRecordada() === id) localStorage.removeItem(LLAVE_SALA)
}

/** Navegación del panel. Las secciones de sala usan la sala abierta en la URL o la última que se usó. */
export function Marco() {
  const { admin, salir } = useSesion()
  const { salaId } = useParams()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const refNav = useRef<HTMLElement>(null)
  // En celular el menú es una fila deslizable: lleva la sección actual a la vista.
  useEffect(() => {
    const nav = refNav.current
    const activo = nav?.querySelector<HTMLElement>('.nav__item--activo')
    if (nav && activo && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = activo.offsetLeft - nav.offsetLeft - 16
  }, [pathname])
  if (salaId) recordarSala(salaId)
  const sala = salaId ?? salaRecordada()
  const enSala = (seccion: string) => (sala ? `/admin/salas/${sala}/${seccion}` : `/admin/sala/${seccion}`)

  const enlaces = [
    { a: '/admin/salas', texto: 'Salas', end: true },
    { a: enSala('vivo'), texto: 'Sala en vivo' },
    { a: enSala('mesas'), texto: 'Mesas y QR' },
    { a: enSala('participantes'), texto: 'Participantes' },
    { a: enSala('respuestas'), texto: 'Respuestas' },
    { a: enSala('hojas'), texto: 'Hojas' },
    { a: enSala('configuracion'), texto: 'Configuración' },
    { a: enSala('export'), texto: 'Exportar' },
  ]
  enlaces.push({ a: '/admin/salud', texto: 'Salud' })
  if (admin?.rol === 'superadmin') enlaces.push({ a: '/admin/administradores', texto: 'Administradores' })

  return (
    <div className="marco">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="cabecera">
        <span className="marca">
          Horizontes <span className="marca__sub">Administración</span>
        </span>
        <nav aria-label="Secciones del panel" className="nav" ref={refNav}>
          {enlaces.map((e) => (
            <NavLink key={e.texto} to={e.a} end={e.end} className={({ isActive }) => (isActive ? 'nav__item nav__item--activo' : 'nav__item')}>
              {e.texto}
            </NavLink>
          ))}
        </nav>
        <div className="usuario">
          <span>
            {admin?.nombre} <span className="etiqueta">{admin?.rol === 'superadmin' ? 'Superadmin' : 'Admin'}</span>
          </span>
          <button
            className="btn btn--fantasma"
            onClick={async () => {
              await salir()
              navegar('/admin/login', { replace: true })
            }}
          >
            Salir
          </button>
        </div>
      </header>
      <AvisoDominio sala={sala} />
      {usaMocks() && <p className="aviso-mock">Modo simulado: los datos vienen de mocks/ y no se guardan.</p>}
      <main id="contenido" className="contenido">
        <Outlet />
      </main>
    </div>
  )
}

/**
 * C19-1 (A5): si los QR y enlaces que arma el servidor (BASE_URL) no son del dominio desde el que se abre el panel,
 * los participantes entrarían a otro ambiente. base_url sale de /api/admin/salud o, si no existe, del detalle de la sala.
 */
function AvisoDominio({ sala }: { sala: string | null }) {
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    const leer = (ruta: string) => api.get<{ base_url?: string } | null>(ruta).then((r) => r?.base_url ?? null)
    leer('/api/admin/salud')
      .catch(() => null)
      .then((b) => b ?? (sala ? leer(`/api/admin/salas/${sala}`).catch(() => null) : null))
      .then((b) => vigente && setBaseUrl(b))
    return () => {
      vigente = false
    }
  }, [sala])
  if (!baseUrl || !dominioDistinto(baseUrl, window.location.origin)) return null
  return (
    <p className="alerta alerta--error aviso-dominio" role="alert">
      Los QR apuntan a {baseUrl}, pero estás en {window.location.origin}. Corrige BASE_URL en Coolify.
    </p>
  )
}
