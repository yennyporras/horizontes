import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useSesion } from './sesion'
import { api, lista, usaMocks } from './api'
import { recordarSala, salaRecordada } from './memoria'
import { dominioDistinto } from './textos'
import { EncabezadoProducto } from '../shared/ui'
import { ProveedorPendientes, usePendientes } from './componentes/Pendientes'
import { useGuiaUso } from './componentes/GuiaUso'
import { GRUPOS, seccionesDe, type Grupo } from './secciones'

/** Navegación del panel. Las secciones de sala usan la sala abierta en la URL o la última que se usó. */
export function Marco() {
  return (
    <ProveedorPendientes>
      <MarcoInterno />
    </ProveedorPendientes>
  )
}

function MarcoInterno() {
  const { admin, salir } = useSesion()
  const { salaId } = useParams()
  const navegar = useNavigate()
  const { pathname } = useLocation()
  const { confirmarSalida, hayPendientes } = usePendientes()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const primeraVista = useRef(true)
  const esSuperadmin = admin?.rol === 'superadmin'
  // Guía de uso: se abre sola la primera vez de cada admin en este navegador (nunca con datos simulados).
  const guia = useGuiaUso(admin?.id, esSuperadmin, !usaMocks())

  // Recordar la sala es un efecto, no algo que pasa en cada render.
  useEffect(() => {
    if (salaId) recordarSala(salaId)
  }, [salaId])

  // QA-A-24: al cambiar de sección el foco va al título nuevo (el lector de pantalla anuncia la página) y el menú
  // del celular se cierra. En la primera carga el foco se queda donde lo deja el navegador.
  useEffect(() => {
    setMenuAbierto(false)
    if (primeraVista.current) {
      primeraVista.current = false
      return
    }
    const id = window.setTimeout(() => document.querySelector<HTMLElement>('#contenido h1')?.focus({ preventScroll: false }), 0)
    return () => window.clearTimeout(id)
  }, [pathname])

  const sala = salaId ?? salaRecordada()
  const enSala = (seccion: string) => (sala ? `/admin/salas/${sala}/${seccion}` : `/admin/sala/${seccion}`)

  // El menú sigue el orden del taller (secciones.ts): preparar, conducir, después y el sistema.
  const enlaces = seccionesDe(esSuperadmin).map((s) => ({
    a: s.deSala ? enSala(s.ruta) : `/admin/${s.ruta}`,
    texto: s.texto,
    grupo: s.grupo,
    end: s.ruta === 'salas',
  }))
  const grupos = [...new Set(enlaces.map((e) => e.grupo))] as Grupo[]

  /** QA-A-14: con cambios sin guardar, se pregunta antes de salir de la sección. */
  const irA = (a: string) => async (e: MouseEvent) => {
    // Abrir en otra pestaña (Ctrl, Cmd, Mayús o clic central) no sale de esta sección.
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || !hayPendientes()) return
    e.preventDefault()
    if (await confirmarSalida()) navegar(a)
  }

  return (
    <div className="marco">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <div className="cabecera" data-tema="carbon">
        <EncabezadoProducto
          href="/admin/salas"
          onIr={async (e) => {
            // El logo lleva al panel principal (Salas) sin recargar; con cambios sin guardar, pregunta antes.
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
            e.preventDefault()
            if (await confirmarSalida()) navegar('/admin/salas')
          }}
        >
          {/* QA-A-23: en el celular el menú se abre con un botón que dice en qué sección estás. */}
          <button
            type="button"
            className="hz-boton hz-boton--secundario menu-boton"
            aria-expanded={menuAbierto}
            aria-controls="menu-panel"
            onClick={() => setMenuAbierto((v) => !v)}
          >
            Menú<span className="menu-boton__actual"> · {enlaces.find((e) => (e.end ? pathname === e.a : pathname.startsWith(e.a)))?.texto ?? 'Panel'}</span>
          </button>
          <nav id="menu-panel" aria-label="Secciones del panel" className={menuAbierto ? 'nav nav--abierto' : 'nav'}>
            {grupos.map((g) => (
              <div key={g} className="nav__grupo" role="group" aria-label={GRUPOS[g]}>
                {enlaces
                  .filter((e) => e.grupo === g)
                  .map((e) => (
                    <NavLink
                      key={e.texto}
                      to={e.a}
                      end={e.end}
                      onClick={irA(e.a)}
                      className={({ isActive }) =>
                        ['nav__item', isActive && 'nav__item--activo', guia.seccion === e.texto && 'nav__item--guia'].filter(Boolean).join(' ')
                      }
                    >
                      {e.texto}
                    </NavLink>
                  ))}
              </div>
            ))}
          </nav>
          {/* En el celular estas dos van dentro del menú plegable; Salir queda siempre a la vista. */}
          <div className={menuAbierto ? 'cuenta-extra cuenta-extra--abierta' : 'cuenta-extra'}>
            <button type="button" className="hz-boton hz-boton--fantasma" onClick={guia.abrir}>
              Guía de uso
            </button>
            {/* QA-A-22: cada quien cambia su clave cuando quiera. */}
            <Link className="hz-boton hz-boton--fantasma" to="/admin/cambiar-clave" onClick={irA('/admin/cambiar-clave')}>
              Cambiar mi clave
            </Link>
          </div>
          <div className="usuario">
            <span className="usuario__nombre">{admin?.nombre}</span>
            <span className="etiqueta">{esSuperadmin ? 'Superadmin' : 'Admin'}</span>
            <button
              type="button"
              className="hz-boton hz-boton--fantasma"
              onClick={async () => {
                if (!(await confirmarSalida())) return
                await salir()
                navegar('/admin/login', { replace: true })
              }}
            >
              Salir
            </button>
          </div>
        </EncabezadoProducto>
      </div>
      <AvisoDominio sala={sala} />
      {usaMocks() && <p className="aviso-mock">Modo simulado: los datos vienen de mocks/ y no se guardan.</p>}
      <main id="contenido" className="contenido hz-pagina">
        <Outlet />
      </main>
      <PiePanel />
      {guia.elemento}
    </div>
  )
}

/** Pie del panel: en el mismo contenedor de página que la barra y el contenido (ancho común del 20-oct). */
export function PiePanel() {
  return (
    <footer className="pie hz-pagina">
      <p>
        Horizontes, panel del facilitador · por Estratek <span className="pie__flecha" aria-hidden="true">»</span>
      </p>
    </footer>
  )
}

/**
 * C19-1 (A5): si los QR y enlaces que arma el servidor (BASE_URL) no son del dominio desde el que se abre el panel,
 * los participantes entrarían a otro ambiente. base_url es del servidor y viene en el detalle de cualquier sala: la
 * abierta, la recordada o, si no hay, la primera de la lista.
 */
function AvisoDominio({ sala }: { sala: string | null }) {
  const [baseUrl, setBaseUrl] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    const id = sala ? Promise.resolve(sala) : api.get<unknown>('/api/admin/salas').then((r) => lista<{ id: string }>(r, 'salas')[0]?.id)
    id.then((i) => (i ? api.get<{ base_url?: string }>(`/api/admin/salas/${i}`).then((d) => d.base_url ?? null) : null))
      .catch(() => null)
      .then((b) => vigente && setBaseUrl(b))
    return () => {
      vigente = false
    }
  }, [sala])
  if (!baseUrl || !dominioDistinto(baseUrl, window.location.origin)) return null
  return (
    <p className="alerta alerta--error aviso-dominio no-imprimir" role="alert">
      Los QR apuntan a {baseUrl}, pero estás en {window.location.origin}. Corrige BASE_URL en Coolify.
    </p>
  )
}
