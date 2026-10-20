import { Fragment, useEffect, useRef, type ReactNode } from 'react'
import { Aviso, BarraAccion, Boton, EncabezadoProducto, Insignia, useTemaDocumento } from '../shared/ui'
import './participante.css'

/** Cifra con coma decimal (es-CO) y siempre 2 decimales, igual que el tablero (triage #11). */
export function cifra(n: number | null | undefined, decimales = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return 'sin dato'
  const f = 10 ** decimales
  return (Math.round(n * f) / f).toFixed(decimales).replace('.', ',')
}

/** Acta A7: la ronda 1 es individual y en silencio, con la hoja del perfil; la ronda 2, con discusión en la mesa. */
const FASE_RONDA: Record<1 | 2, string> = { 1: 'Individual y en silencio', 2: 'Discusión en la mesa' }

/** Insignia R1 (hueco, verde) o R2 (sólido, rojo) con su fase: se lee sin depender del color. */
export function FaseRonda({ ronda }: { ronda: number }) {
  if (ronda !== 1 && ronda !== 2) return null
  return (
    <p className="hzp-fase">
      <Insignia tono={ronda === 1 ? 'r1' : 'r2'}>R{ronda}</Insignia>
      <span>{FASE_RONDA[ronda]}</span>
    </p>
  )
}

export interface MarcoProps {
  sala: string
  meta?: string
  /** Avisos arriba del contenido que explican la pantalla (ronda cerrada, acceso nuevo). */
  arriba?: ReactNode
  /**
   * Avisos que llegan solos (sin conexión, calificación guardada, por enviar): flotan encima de la barra inferior
   * para no empujar el texto que se está leyendo.
   */
  flotantes?: ReactNode
  barra?: ReactNode
  notaBarra?: ReactNode
  /** Mueve el foco al título al cambiar de pantalla (lectores de pantalla y teclado). */
  claveFoco?: string
  children: ReactNode
}

/** Lo que la página pasa a cada pantalla: encabezado y avisos globales. */
export type MarcoBase = Pick<MarcoProps, 'sala' | 'meta' | 'arriba' | 'flotantes'>

/**
 * Página del celular: tema claro de Estratek, encabezado de producto y, debajo, la sala y la mesa. Encabezado,
 * contexto, contenido y pie usan el contenedor de página (`.hz-pagina`): en escritorio comparten los bordes del panel.
 */
export function Marco({ sala, meta, arriba, flotantes, barra, notaBarra, claveFoco, children }: MarcoProps) {
  useTemaDocumento('claro')
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!claveFoco) return
    const h1 = ref.current?.querySelector('h1')
    if (h1) {
      h1.setAttribute('tabindex', '-1')
      h1.focus({ preventScroll: false })
    }
    document.documentElement.scrollTop = 0
  }, [claveFoco])
  return (
    <div className="hz hz-vista hzp-vista" data-tema="claro" lang="es-CO">
      <EncabezadoProducto href="/" />
      <div className="hzp-contexto hz-pagina">
        <p className="hzp-contexto__sala">{sala}</p>
        {meta && <p className="hzp-contexto__meta">{meta}</p>}
      </div>
      <main ref={ref} className="hz-contenido hz-pagina">
        {arriba}
        {children}
      </main>
      {(flotantes || barra) && (
        <div className={barra ? 'hzp-pie' : 'hzp-pie hzp-pie--sin-barra'}>
          {flotantes && <div className="hzp-flotantes hz-pagina">{flotantes}</div>}
          {barra && <BarraAccion nota={notaBarra}>{barra}</BarraAccion>}
        </div>
      )}
    </div>
  )
}

/** Pantalla de un solo mensaje: mesa no existe, sesión no válida, error del servidor... */
export function Mensaje({
  sala = 'Taller Horizontes',
  meta,
  titulo,
  children,
  accion,
  tono,
}: {
  sala?: string
  meta?: string
  titulo: string
  children: ReactNode
  accion?: { texto: string; onClick: () => void }
  tono?: 'error'
}) {
  return (
    <Marco
      sala={sala}
      meta={meta}
      claveFoco={titulo}
      barra={
        accion && (
          <Boton bloque onClick={accion.onClick}>
            {accion.texto}
          </Boton>
        )
      }
    >
      <h1 className="hz-titulo">{titulo}</h1>
      {tono === 'error' ? <Aviso tono="error">{children}</Aviso> : <p className="hz-texto-2">{children}</p>}
    </Marco>
  )
}

export function Cargando({ sala = 'Taller Horizontes' }: { sala?: string }) {
  return (
    <Marco sala={sala}>
      <div className="hzp-esqueleto" aria-busy="true">
        <span className="hz-visual-oculto" role="status">
          Cargando tu mesa
        </span>
        <div className="hzp-esqueleto__bloque" style={{ height: 32, width: '70%' }} />
        <div className="hzp-esqueleto__bloque" style={{ height: 96 }} />
        <div className="hzp-esqueleto__bloque" style={{ height: 160 }} />
      </div>
    </Marco>
  )
}

/** Markdown mínimo del caso: párrafos (línea en blanco), negrillas (**x**) y listas (- x). Sin HTML crudo. */
export function Md({ texto }: { texto: string }) {
  const bloques = texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className="hzp-md">
      {bloques.map((b, i) => {
        const lineas = b.split('\n')
        if (lineas.every((l) => /^\s*[-*] /.test(l))) {
          return (
            <ul key={i}>
              {lineas.map((l, j) => (
                <li key={j}>{enLinea(l.replace(/^\s*[-*] /, ''))}</li>
              ))}
            </ul>
          )
        }
        return (
          <p key={i}>
            {lineas.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {enLinea(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}

function enLinea(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith('**') && parte.endsWith('**') && parte.length > 4 ? <strong key={i}>{parte.slice(2, -2)}</strong> : parte,
  )
}
