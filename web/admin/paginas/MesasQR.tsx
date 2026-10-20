import { Fragment, useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, usaMocks } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import type { Mesa } from '../tipos'

/** En modo simulado no hay servidor que dibuje el QR: se muestra una tarjeta con el código. */
function srcQR(m: Mesa) {
  if (!usaMocks()) return `/api/admin/mesas/${encodeURIComponent(m.id)}/qr.svg`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff" stroke="#141414" stroke-width="4"/>` +
    `<text x="100" y="95" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#141414">QR simulado</text>` +
    `<text x="100" y="125" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#141414">${m.codigo}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Dominio y ruta sin protocolo, para leer en la hoja impresa. */
const urlCorta = (u: string) => u.replace(/^https?:\/\//, '')

/** La URL corta con cortes posibles solo después de cada barra (no a mitad del código de la mesa). */
function UrlPartida({ url }: { url: string }) {
  const partes = urlCorta(url).split(/(?<=\/)/)
  return (
    <span className="url">
      {partes.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          <span className="sin-corte">{p}</span>
        </Fragment>
      ))}
    </span>
  )
}

/**
 * QA-A-26: la acción principal es imprimir la hoja de QR (agregar mesas es raro y va al final, en secundario). Cada
 * tarjeta impresa lleva la llamada a la acción «Escanea para entrar». QA-A-31: la URL va en Montserrat.
 */
export function MesasQR() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [proyectada, setProyectada] = useState<Mesa | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null)
  const [copiada, setCopiada] = useState<string | null>(null)
  const [agregando, setAgregando] = useState(false)
  const enCurso = useRef(false)

  const agregar = async (e: FormEvent) => {
    e.preventDefault()
    // F-6: un doble clic no crea las mesas dos veces.
    if (enCurso.current) return
    enCurso.current = true
    setAgregando(true)
    setAviso(null)
    try {
      await api.post(`/api/admin/salas/${salaId}/mesas`, { cantidad })
      await refrescar()
      setAviso({ tono: 'exito', texto: cantidad === 1 ? 'Agregamos 1 mesa.' : `Agregamos ${cantidad} mesas.` })
    } catch (err) {
      setAviso({ tono: 'error', texto: err instanceof Error ? err.message : 'No se pudieron agregar las mesas.' })
    } finally {
      enCurso.current = false
      setAgregando(false)
    }
  }

  const copiar = async (m: Mesa) => {
    try {
      await navigator.clipboard.writeText(m.url_participante)
      setCopiada(m.id)
    } catch {
      setCopiada(null)
    }
  }

  return (
    <ConSala titulo="Mesas y QR" datos={datos} error={error}>
      {(d) => (
        <>
          <section className="panel no-imprimir" aria-labelledby="t-hoja">
            <h2 id="t-hoja">QR de las mesas</h2>
            <p>
              <strong>Imprime el QR de cada mesa y ponlo en su mesa, así cada persona entra a la suya. Proyecta un QR solo si a una mesa le falta el suyo.</strong>
            </p>
            <div className="acciones">
              <button className="hz-boton hz-boton--primario" type="button" onClick={() => window.print()} disabled={d.mesas.length === 0} aria-describedby="ayuda-hoja">
                Imprimir los QR
              </button>
            </div>
            <p id="ayuda-hoja" className="pista">
              La hoja trae cuatro mesas por página A4, cada una con su QR, su código y su enlace.
            </p>
          </section>

          {d.mesas.length === 0 ? (
            <p className="vacio">Esta sala aún no tiene mesas. Agrega la primera con el formulario de abajo.</p>
          ) : (
            <ul className="qr-lista">
              {d.mesas.map((m) => (
                <li key={m.id} className="panel qr-tarjeta">
                  <h2>{m.nombre}</h2>
                  <p className="pista">{d.sala.nombre}</p>
                  <img src={srcQR(m)} alt={`Código QR de ${m.nombre}: ${m.url_participante}`} />
                  <p className="qr-tarjeta__cta">Escanea para entrar</p>
                  <p>
                    Código <strong>{m.codigo}</strong>
                  </p>
                  <p>
                    <UrlPartida url={m.url_participante} />
                  </p>
                  <div className="acciones no-imprimir">
                    <button className="hz-boton hz-boton--secundario hz-boton--chico" type="button" onClick={() => setProyectada(m)}>
                      Proyectar QR
                    </button>
                    <button className="hz-boton hz-boton--secundario hz-boton--chico" type="button" onClick={() => copiar(m)}>
                      {copiada === m.id ? 'Enlace copiado' : 'Copiar enlace'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <section className="panel no-imprimir seccion-final" aria-labelledby="t-agregar">
            <h2 id="t-agregar">Agregar mesas</h2>
            <p className="pista">Solo si llegó más gente de la esperada: una mesa por cada 6 personas.</p>
            <form className="fila-form" onSubmit={agregar}>
              <label className="campo campo--corto">
                <span>Cantidad</span>
                <input type="number" min={1} max={20} required value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
              </label>
              <button className="hz-boton hz-boton--secundario" type="submit" disabled={agregando} aria-busy={agregando}>
                {agregando ? 'Agregando…' : 'Agregar'}
              </button>
            </form>
            {aviso && (
              <p className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
                {aviso.texto}
              </p>
            )}
          </section>
          {proyectada && <Proyectar mesa={proyectada} sala={d.sala.nombre} alCerrar={() => setProyectada(null)} />}
        </>
      )}
    </ConSala>
  )
}

/**
 * QR a pantalla completa para el proyector. Esc o el botón lo cierran. F-14: el foco queda atrapado en el diálogo (su
 * único control es Cerrar) y al cerrar vuelve al botón que lo abrió.
 */
function Proyectar({ mesa, sala, alCerrar }: { mesa: Mesa; sala: string; alCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const cerrar = useRef(alCerrar)
  cerrar.current = alCerrar

  useEffect(() => {
    const origen = document.activeElement instanceof HTMLElement ? document.activeElement : null
    boton.current?.focus()
    const el = ref.current
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => undefined)
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current()
      if (e.key === 'Tab') {
        e.preventDefault()
        boton.current?.focus()
      }
    }
    const dentro = (e: FocusEvent) => {
      if (el && e.target instanceof Node && !el.contains(e.target)) boton.current?.focus()
    }
    const salioPantallaCompleta = () => !document.fullscreenElement && cerrar.current()
    window.addEventListener('keydown', tecla)
    document.addEventListener('focusin', dentro)
    document.addEventListener('fullscreenchange', salioPantallaCompleta)
    return () => {
      window.removeEventListener('keydown', tecla)
      document.removeEventListener('focusin', dentro)
      document.removeEventListener('fullscreenchange', salioPantallaCompleta)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined)
      if (origen?.isConnected) origen.focus()
    }
  }, [])

  return (
    <div ref={ref} className="proyectar" role="dialog" aria-modal="true" aria-labelledby="t-proyectar">
      <button ref={boton} type="button" className="hz-boton hz-boton--secundario" onClick={alCerrar}>
        Cerrar
      </button>
      <h2 id="t-proyectar">{mesa.nombre}</h2>
      <img src={srcQR(mesa)} alt={`Código QR de ${mesa.nombre}`} />
      <p>
        Escanea para entrar a {sala} · <strong>{urlCorta(mesa.url_participante)}</strong>
      </p>
    </div>
  )
}
