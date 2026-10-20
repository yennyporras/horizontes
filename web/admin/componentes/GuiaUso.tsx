import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Un paso de la guía de uso. `seccion` es el texto del menú que se resalta mientras el paso está en pantalla. */
export interface PasoGuia {
  titulo: string
  seccion?: string
  /** Qué se hace en esa sección. */
  hace: ReactNode
  /** Qué esperar: lo que cambia para los participantes o en la pantalla. */
  espera?: ReactNode
  /** Solo para el superadmin (como Administradores en el menú). */
  soloSuperadmin?: boolean
}

/**
 * Pasos de la guía: la bienvenida y una sección por paso, en el orden exacto del menú (secciones.ts). Administradores
 * solo aparece para el superadmin, igual que en el menú. Cada texto describe lo que hay hoy en esa sección.
 */
export const PASOS_GUIA: PasoGuia[] = [
  {
    titulo: 'Te damos la bienvenida al panel',
    hace: (
      <p>
        Desde aquí preparas y conduces el taller. El menú sigue su orden: primero preparas la sala, después la conduces en
        vivo y al final revisas y descargas los resultados. En unos pasos te mostramos qué hay en cada sección.
      </p>
    ),
    espera: <p>Los participantes nunca ven este panel. Ven su celular y, en el salón, el tablero que tú proyectas.</p>,
  },
  {
    titulo: 'Salas',
    seccion: 'Salas',
    hace: (
      <p>
        Crea una sala por evento con el nombre del taller, el número de mesas (una por cada 6 personas) y si es un taller con
        cliente o un ensayo; la empresa y el sector son opcionales. En la lista ves el código, las personas y el estado de cada
        sala; «Duplicar para ensayo» crea una copia vacía para probar sin tocar la real.
      </p>
    ),
    espera: (
      <p>
        Arriba están las cifras de los talleres con cliente: talleres, personas, quiénes completaron la ronda 2 y países. Los
        ensayos no cuentan. Si eres superadmin, «Crear demostración» arma una sala con 24 personas simuladas que votan las dos
        rondas en un minuto.
      </p>
    ),
  },
  {
    titulo: 'Configuración',
    seccion: 'Configuración',
    hace: (
      <p>
        Elige primero el país, que define el aviso de datos personales y la hora de la sala. Después decide qué ven los
        participantes y si las preguntas avanzan solas o las pasas tú, programa la apertura y el cierre de la sala y de cada
        ronda, y ajusta los textos de las rúbricas.
      </p>
    ),
    espera: (
      <p>
        Los cambios se aplican de inmediato. Las horas programadas se cumplen solas y las rúbricas se bloquean con el primer
        voto. Siempre puedes abrir o cerrar a mano desde Sala en vivo.
      </p>
    ),
  },
  {
    titulo: 'Hojas',
    seccion: 'Hojas',
    hace: <p>Lee lo que sabe cada perfil de INSUMEX y NUTRIWHAT: las 6 hojas de cada proyecto, de solo lectura.</p>,
    espera: <p>En la ronda 1 cada persona ve solo la hoja de su perfil; al abrir la ronda 2 se abren las 6 para todos. Te sirven para la plenaria.</p>,
  },
  {
    titulo: 'Mesas y QR',
    seccion: 'Mesas y QR',
    hace: (
      <p>
        Pulsa «Imprimir los QR», cuatro mesas por página, y pon cada QR en su mesa. Si llega más gente de la esperada, agrega
        mesas al final de la sección.
      </p>
    ),
    espera: <p>Cuando abres la inscripción, quien escanea el QR de su mesa se inscribe con su nombre y correo, y recibe su perfil.</p>,
  },
  {
    titulo: 'Sala en vivo',
    seccion: 'Sala en vivo',
    hace: (
      <p>
        Es el control del taller: un solo botón con el paso que sigue (abrir la inscripción, abrir y cerrar cada ronda,
        cerrar la sala) y, aparte, Corregir. Ves cuántas personas de cada mesa ya votaron, la pregunta en pantalla si usas el
        modo guiado y la bitácora.
      </p>
    ),
    espera: (
      <p>
        En «Proyectar el tablero» abres el tablero de la sala en Gráfica o Detallado, con la lista de teclas (F pantalla
        completa, → y ← cambian de vista, C repite la animación de la comparación, ? muestra la ayuda). Con la ronda 1 abierta
        el tablero no muestra resultados hasta que todos voten o la cierres; tú sí los ves aquí. «Ver quién falta» en cada mesa
        abre Participantes con los pendientes, y al cerrar la ronda 2 sale el resumen del taller.
      </p>
    ),
  },
  {
    titulo: 'Participantes',
    seccion: 'Participantes',
    hace: (
      <p>
        Revisa quién se inscribió, en qué mesa y con qué perfil. Puedes cambiar la mesa o el perfil, desactivar a quien se
        fue y, si alguien cambió de celular, usar «Dar acceso de nuevo».
      </p>
    ),
    espera: <p>Ese acceso es un QR personal que sirve una vez y vence en 15 minutos. Nadie entra solo con el correo.</p>,
  },
  {
    titulo: 'Respuestas',
    seccion: 'Respuestas',
    hace: <p>Mira qué calificó cada persona en cada ronda y proyecto, con filtros por mesa, ronda y proyecto.</p>,
    espera: <p>Los datos por persona solo los ven los administradores: no los proyectes. El público ve promedios y solo con 3 votos o más.</p>,
  },
  {
    titulo: 'Exportar',
    seccion: 'Exportar',
    hace: (
      <p>
        Al terminar el taller, descarga resultados.csv y la matriz en SVG: es lo que se entrega al cliente, sin nombres ni IP.
        Inscritos y votos son registro interno.
      </p>
    ),
    espera: <p>Inscritos y votos llevan país e IP y no se entregan al cliente. Guárdalos solo donde lo permita la política de datos de Estratek.</p>,
  },
  {
    titulo: 'Salud',
    seccion: 'Salud',
    hace: <p>Antes de empezar, confirma que el servidor responde: «Todo bien», «Lento» o «No responde».</p>,
    espera: <p>Si el servidor no responde por más de 3 minutos, pasa al plan B en papel (plantillas que entrega Estratek).</p>,
  },
  {
    titulo: 'Administradores',
    seccion: 'Administradores',
    soloSuperadmin: true,
    hace: <p>Crea las cuentas de los demás facilitadores, restablece su clave o desactiva a quien ya no deba entrar.</p>,
    espera: <p>Solo tú, como superadmin, ves esta sección. Las cuentas nuevas manejan salas, pero no crean otros administradores.</p>,
  },
]

/** Pasos que ve cada rol: los mismos del menú, en su orden. */
export const pasosDe = (esSuperadmin: boolean) => PASOS_GUIA.filter((p) => esSuperadmin || !p.soloSuperadmin)

/**
 * Ids de los admins que ya vieron la guía en este navegador, separados por coma. La llave conserva su nombre de antes
 * («recorrido»): quien ya la vio no la recibe otra vez solo porque cambió de nombre.
 */
export const CLAVE_GUIA = 'hz-recorrido-v1'

function visto(adminId: string): boolean {
  try {
    return (localStorage.getItem(CLAVE_GUIA) ?? '').split(',').includes(adminId)
  } catch {
    return true
  }
}

function marcarVisto(adminId: string) {
  try {
    const ids = new Set((localStorage.getItem(CLAVE_GUIA) ?? '').split(',').filter(Boolean))
    ids.add(adminId)
    localStorage.setItem(CLAVE_GUIA, [...ids].join(','))
  } catch {
    /* sin almacenamiento: la guía se vuelve a ofrecer, no pasa nada más */
  }
}

/**
 * Guía de uso del panel. Se abre sola la primera vez que cada admin entra en este navegador y después con el botón
 * «Guía de uso». Usa el <dialog> nativo como las confirmaciones: Esc la cierra, las flechas cambian de paso y al cerrar
 * el foco vuelve a donde estaba. `seccion` es el texto del menú que el marco resalta.
 */
export function useGuiaUso(id: string | number | undefined, esSuperadmin: boolean, automatico: boolean) {
  const adminId = id === undefined ? undefined : String(id)
  const [paso, setPaso] = useState<number | null>(null)
  const ref = useRef<HTMLDialogElement>(null)
  const origen = useRef<HTMLElement | null>(null)

  const abrir = useCallback(() => {
    origen.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setPaso(0)
  }, [])

  useEffect(() => {
    if (automatico && adminId && !visto(adminId)) setPaso(0)
  }, [automatico, adminId])

  useEffect(() => {
    const d = ref.current
    if (!d || paso === null) return
    if (!d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    d.querySelector<HTMLElement>('h2')?.focus()
  }, [paso])

  const cerrar = () => {
    const d = ref.current
    if (d?.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
    if (adminId) marcarVisto(adminId)
    setPaso(null)
    const volver = origen.current
    origen.current = null
    if (volver?.isConnected) volver.focus()
  }

  const pasos = pasosDe(esSuperadmin)
  const total = pasos.length
  const actual = paso === null ? null : pasos[paso]
  const ultimo = paso === total - 1

  const elemento =
    actual && paso !== null ? (
      <dialog
        ref={ref}
        className="guia-uso"
        aria-labelledby="guia-titulo"
        aria-describedby="guia-texto"
        onCancel={(e) => {
          e.preventDefault()
          cerrar()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !ultimo) setPaso(paso + 1)
          if (e.key === 'ArrowLeft' && paso > 0) setPaso(paso - 1)
        }}
      >
        <p className="guia-uso__paso" aria-live="polite">
          Paso {paso + 1} de {total}
          {actual.seccion && <span className="etiqueta">Menú · {actual.seccion}</span>}
        </p>
        <div className="guia-uso__progreso" aria-hidden="true">
          <span style={{ width: `${((paso + 1) / total) * 100}%` }} />
        </div>
        <h2 id="guia-titulo" tabIndex={-1}>
          {actual.titulo}
        </h2>
        <div id="guia-texto" className="guia-uso__texto">
          {actual.hace}
          {actual.espera && (
            <div className="guia-uso__espera">
              <strong>Qué esperar</strong>
              {actual.espera}
            </div>
          )}
          {ultimo && <p className="pista">Vuelve a esta guía cuando quieras con el botón «Guía de uso» de la barra superior.</p>}
        </div>
        <div className="acciones guia-uso__acciones">
          <button type="button" className="hz-boton hz-boton--fantasma" onClick={cerrar}>
            {ultimo ? 'Cerrar' : 'Saltar la guía'}
          </button>
          <span className="guia-uso__nav">
            {paso > 0 && (
              <button type="button" className="hz-boton hz-boton--secundario" onClick={() => setPaso(paso - 1)}>
                Anterior
              </button>
            )}
            <button type="button" className="hz-boton hz-boton--primario" onClick={() => (ultimo ? cerrar() : setPaso(paso + 1))}>
              {ultimo ? 'Empezar' : 'Siguiente'}
            </button>
          </span>
        </div>
      </dialog>
    ) : null

  return { elemento, abrir, seccion: actual?.seccion ?? null }
}
