import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { api, usaMocks } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import type { Mesa } from '../tipos'

/** En modo simulado no hay servidor que dibuje el QR: se muestra una tarjeta con el código. */
function srcQR(m: Mesa) {
  if (!usaMocks()) return `/api/admin/mesas/${encodeURIComponent(m.id)}/qr.svg`
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff" stroke="#1C4587" stroke-width="4"/>` +
    `<text x="100" y="95" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#1C4587">QR simulado</text>` +
    `<text x="100" y="125" text-anchor="middle" font-family="sans-serif" font-size="20" font-weight="700" fill="#0F2340">${m.codigo}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Dominio y ruta sin protocolo, para leer en la hoja impresa. */
const urlCorta = (u: string) => u.replace(/^https?:\/\//, '')

export function MesasQR() {
  const { salaId } = useParams()
  const { datos, error, refrescar } = useSala(salaId)
  const [proyectada, setProyectada] = useState<Mesa | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [aviso, setAviso] = useState<{ tono: 'exito' | 'error'; texto: string } | null>(null)
  const [copiada, setCopiada] = useState<string | null>(null)

  const agregar = async (e: FormEvent) => {
    e.preventDefault()
    setAviso(null)
    try {
      await api.post(`/api/admin/salas/${salaId}/mesas`, { cantidad })
      await refrescar()
      setAviso({ tono: 'exito', texto: cantidad === 1 ? 'Agregamos 1 mesa.' : `Agregamos ${cantidad} mesas.` })
    } catch (err) {
      setAviso({ tono: 'error', texto: err instanceof Error ? err.message : 'No se pudieron agregar las mesas.' })
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
          <section className="panel no-imprimir" aria-labelledby="t-agregar">
            <h2 id="t-agregar">Agregar mesas</h2>
            <form className="fila-form" onSubmit={agregar}>
              <label className="campo campo--corto">
                <span>Cantidad</span>
                <input type="number" min={1} max={20} required value={cantidad} onChange={(e) => setCantidad(Number(e.target.value))} />
              </label>
              <button className="btn btn--primario" type="submit">
                Agregar
              </button>
              <button className="btn" type="button" onClick={() => window.print()} disabled={d.mesas.length === 0}>
                Imprimir hoja de QR
              </button>
            </form>
            <p>
              <strong>Imprime el QR de cada mesa y ponlo en su mesa; no lo proyectes, así cada persona entra a su mesa.</strong>
            </p>
            <p className="pista">La hoja imprimible trae cuatro mesas por página A4, con código y enlace.</p>
            {aviso && (
              <p className={`alerta alerta--${aviso.tono}`} role={aviso.tono === 'error' ? 'alert' : 'status'}>
                {aviso.texto}
              </p>
            )}
          </section>

          {d.mesas.length === 0 ? (
            <p className="vacio">Esta sala aún no tiene mesas. Agrega la primera con el formulario de arriba.</p>
          ) : (
            <ul className="qr-lista" style={{ listStyle: 'none', padding: 0 }}>
              {d.mesas.map((m) => (
                <li key={m.id} className="panel qr-tarjeta">
                  <h2>{m.nombre}</h2>
                  <p className="pista">{d.sala.nombre}</p>
                  <img src={srcQR(m)} alt={`Código QR de ${m.nombre}: ${m.url_participante}`} />
                  <p>
                    Código <strong>{m.codigo}</strong>
                  </p>
                  <p>
                    <code>{urlCorta(m.url_participante)}</code>
                  </p>
                  <div className="acciones no-imprimir" style={{ justifyContent: 'center' }}>
                    <button className="btn btn--primario btn--chico" onClick={() => setProyectada(m)}>
                      Proyectar QR
                    </button>
                    <button className="btn btn--chico" onClick={() => copiar(m)}>
                      {copiada === m.id ? 'Enlace copiado' : 'Copiar enlace'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {proyectada && <Proyectar mesa={proyectada} sala={d.sala.nombre} alCerrar={() => setProyectada(null)} />}
        </>
      )}
    </ConSala>
  )
}

/** QR a pantalla completa para el proyector. Esc o el botón lo cierran. */
function Proyectar({ mesa, sala, alCerrar }: { mesa: Mesa; sala: string; alCerrar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const cerrar = useRef(alCerrar)
  cerrar.current = alCerrar

  useEffect(() => {
    boton.current?.focus()
    const el = ref.current
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => undefined)
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && cerrar.current()
    const salioPantallaCompleta = () => !document.fullscreenElement && cerrar.current()
    window.addEventListener('keydown', tecla)
    document.addEventListener('fullscreenchange', salioPantallaCompleta)
    return () => {
      window.removeEventListener('keydown', tecla)
      document.removeEventListener('fullscreenchange', salioPantallaCompleta)
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined)
    }
  }, [])

  return (
    <div ref={ref} className="proyectar" role="dialog" aria-modal="true" aria-labelledby="t-proyectar">
      <button ref={boton} className="btn" onClick={alCerrar}>
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
