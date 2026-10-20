import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

/** Un paso del recorrido. `seccion` es el texto del menú que se resalta mientras el paso está en pantalla. */
export interface PasoRecorrido {
  titulo: string
  seccion?: string
  /** Qué se hace en esa sección. */
  hace: ReactNode
  /** Qué esperar: lo que cambia para los participantes o en la pantalla. */
  espera?: ReactNode
}

export const PASOS_RECORRIDO: PasoRecorrido[] = [
  {
    titulo: 'Te damos la bienvenida al panel',
    hace: (
      <p>
        Desde aquí preparas y conduces el taller: creas la sala, imprimes los QR, abres y cierras las rondas y proyectas
        la matriz. En unos pasos te mostramos qué hay en cada sección del menú.
      </p>
    ),
    espera: <p>Los participantes nunca ven este panel. Ven su celular y, en la sala, el tablero que tú proyectas.</p>,
  },
  {
    titulo: 'Salas',
    seccion: 'Salas',
    hace: <p>Crea una sala por evento con su nombre, el país y el número de mesas. Aquí ves todas las salas y su estado.</p>,
    espera: <p>Cada sala tiene su propio código, sus mesas y su copia del caso. Lo que hagas en una no toca a las demás.</p>,
  },
  {
    titulo: 'Configuración',
    seccion: 'Configuración',
    hace: (
      <p>
        Elige el país (define el aviso de datos personales), programa la apertura y el cierre de la sala y de cada
        ronda, decide si las preguntas avanzan solas o las pasas tú y ajusta las rúbricas mientras no haya votos.
      </p>
    ),
    espera: <p>Las horas programadas se cumplen solas. Siempre puedes abrir o cerrar a mano desde Sala en vivo.</p>,
  },
  {
    titulo: 'Mesas y QR',
    seccion: 'Mesas y QR',
    hace: <p>Arma una mesa por cada 6 personas e imprime la hoja de QR: un código para poner en cada mesa.</p>,
    espera: <p>Quien escanea el QR de su mesa se inscribe en ella con su nombre y correo, y recibe su hoja según el perfil.</p>,
  },
  {
    titulo: 'Sala en vivo',
    seccion: 'Sala en vivo',
    hace: (
      <p>
        Es el control del taller: abre la inscripción, la ronda 1 y la ronda 2, y ciérralas. El panel te dice cuál es el
        paso que sigue y cuántas personas de cada mesa ya votaron.
      </p>
    ),
    espera: (
      <p>
        En «Ver en vivo» abres el tablero de la sala o de una mesa. Puedes proyectarlo en vivo, solo con la gráfica
        moviéndose, o con la tabla de votación al lado. En el tablero, F lo pone en pantalla completa.
      </p>
    ),
  },
  {
    titulo: 'Participantes',
    seccion: 'Participantes',
    hace: <p>Revisa quién se inscribió, en qué mesa y con qué perfil. Si alguien cambia de celular, usa «Dar acceso de nuevo».</p>,
    espera: <p>Ese acceso es un enlace personal de un solo uso que vence en 15 minutos. Nadie entra solo con el correo.</p>,
  },
  {
    titulo: 'Respuestas, Hojas y Exportar',
    seccion: 'Respuestas',
    hace: (
      <p>
        En Respuestas ves la calificación de cada persona; en Hojas, el texto que recibe cada perfil; en Exportar
        descargas inscritos y votos.
      </p>
    ),
    espera: <p>Los datos por persona solo los ven los administradores. El público ve promedios y solo con 3 votos o más.</p>,
  },
  {
    titulo: 'Salud y ayuda',
    seccion: 'Salud',
    hace: <p>En Salud confirmas que el servidor y la base responden antes de empezar el taller.</p>,
    espera: <p>Puedes volver a ver este recorrido cuando quieras con el botón «Recorrido» de la barra superior.</p>,
  },
]

/** Ids de los admins que ya vieron el recorrido en este navegador, separados por coma. */
export const CLAVE_RECORRIDO = 'hz-recorrido-v1'

function visto(adminId: string): boolean {
  try {
    return (localStorage.getItem(CLAVE_RECORRIDO) ?? '').split(',').includes(adminId)
  } catch {
    return true
  }
}

function marcarVisto(adminId: string) {
  try {
    const ids = new Set((localStorage.getItem(CLAVE_RECORRIDO) ?? '').split(',').filter(Boolean))
    ids.add(adminId)
    localStorage.setItem(CLAVE_RECORRIDO, [...ids].join(','))
  } catch {
    /* sin almacenamiento: el recorrido se vuelve a ofrecer, no pasa nada más */
  }
}

/**
 * Recorrido guiado del panel. Se abre solo la primera vez que cada admin entra en este navegador y después con el
 * botón «Recorrido». Usa el <dialog> nativo como las confirmaciones: Esc lo cierra, las flechas cambian de paso y al
 * cerrar el foco vuelve a donde estaba. `seccion` es el texto del menú que el marco resalta.
 */
export function useRecorrido(id: string | number | undefined, automatico: boolean) {
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

  const total = PASOS_RECORRIDO.length
  const actual = paso === null ? null : PASOS_RECORRIDO[paso]
  const ultimo = paso === total - 1

  const elemento =
    actual && paso !== null ? (
      <dialog
        ref={ref}
        className="recorrido"
        aria-labelledby="recorrido-titulo"
        aria-describedby="recorrido-texto"
        onCancel={(e) => {
          e.preventDefault()
          cerrar()
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' && !ultimo) setPaso(paso + 1)
          if (e.key === 'ArrowLeft' && paso > 0) setPaso(paso - 1)
        }}
      >
        <p className="recorrido__paso" aria-live="polite">
          Paso {paso + 1} de {total}
          {actual.seccion && <span className="etiqueta">Menú · {actual.seccion}</span>}
        </p>
        <div className="recorrido__progreso" aria-hidden="true">
          <span style={{ width: `${((paso + 1) / total) * 100}%` }} />
        </div>
        <h2 id="recorrido-titulo" tabIndex={-1}>
          {actual.titulo}
        </h2>
        <div id="recorrido-texto" className="recorrido__texto">
          {actual.hace}
          {actual.espera && (
            <div className="recorrido__espera">
              <strong>Qué esperar</strong>
              {actual.espera}
            </div>
          )}
        </div>
        <div className="acciones recorrido__acciones">
          <button type="button" className="hz-boton hz-boton--fantasma" onClick={cerrar}>
            {ultimo ? 'Cerrar' : 'Saltar recorrido'}
          </button>
          <span className="recorrido__nav">
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
