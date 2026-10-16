import { NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { useSesion } from './sesion'
import { usaMocks } from './api'

const LLAVE_SALA = 'hz_admin_sala'

export function recordarSala(id: string) {
  localStorage.setItem(LLAVE_SALA, id)
}

export function salaRecordada(): string | null {
  return localStorage.getItem(LLAVE_SALA)
}

/** Navegación del panel. Las secciones de sala usan la sala abierta en la URL o la última que se usó. */
export function Marco() {
  const { admin, salir } = useSesion()
  const { salaId } = useParams()
  const navegar = useNavigate()
  if (salaId) recordarSala(salaId)
  const sala = salaId ?? salaRecordada()
  const enSala = (seccion: string) => (sala ? `/admin/salas/${sala}/${seccion}` : `/admin/sala/${seccion}`)

  const enlaces = [
    { a: '/admin/salas', texto: 'Salas', end: true },
    { a: enSala('vivo'), texto: 'Sala en vivo' },
    { a: enSala('mesas'), texto: 'Mesas y QR' },
    { a: enSala('participantes'), texto: 'Participantes' },
    { a: enSala('configuracion'), texto: 'Configuración' },
    { a: enSala('export'), texto: 'Export' },
  ]
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
        <nav aria-label="Secciones del panel" className="nav">
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
      {usaMocks() && <p className="aviso-mock">Modo simulado: los datos vienen de mocks/ y no se guardan.</p>}
      <main id="contenido" className="contenido">
        <Outlet />
      </main>
    </div>
  )
}
