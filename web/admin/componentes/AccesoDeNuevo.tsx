import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import type { ZonaHoraria } from '../tipos'
import { faltan } from '../textos'

/** Respuesta de POST /api/admin/participantes/{id}/acceso (D1): enlace personal de un solo uso. */
export interface Acceso {
  url: string
  vence_at: string
}

/** QR en SVG dibujado en el navegador (la librería se carga solo cuando se usa). null mientras se dibuja o si falla. */
function useQR(texto: string): string | null {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    setSrc(null)
    import('qrcode')
      .then((q) => q.toString(texto, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#141414', light: '#FFFFFF' } }))
      .then((svg) => vigente && setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`))
      .catch(() => vigente && setSrc(null))
    return () => {
      vigente = false
    }
  }, [texto])
  return src
}

const horaCorta = (iso: string, zona: ZonaHoraria) => new Date(iso).toLocaleTimeString('es-CO', { timeZone: zona, hour: 'numeric', minute: '2-digit' })

/**
 * D1: «Dar acceso de nuevo». Para quien cambió de celular o borró la sesión: el facilitador genera un enlace personal
 * de un solo uso que vence en 15 minutos y se lo muestra como QR grande y como enlace para copiar. Al usarlo, la persona
 * vuelve a su mesa con su perfil y sus votos, y se cierra la sesión que tuviera en otro celular.
 */
export function DialogoAcceso({
  nombre,
  participanteId,
  zona,
  inicial,
  alCerrar,
}: {
  nombre: string
  participanteId: string
  zona: ZonaHoraria
  inicial: Acceso
  alCerrar: () => void
}) {
  const [acceso, setAcceso] = useState(inicial)
  const [ahora, setAhora] = useState(() => Date.now())
  const [copiado, setCopiado] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const listo = useRef<HTMLButtonElement>(null)
  const origen = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  const qr = useQR(acceso.url)
  const restante = Date.parse(acceso.vence_at) - ahora
  const vencido = restante <= 0

  useEffect(() => {
    const d = ref.current
    if (d && !d.open) {
      if (typeof d.showModal === 'function') d.showModal()
      else d.setAttribute('open', '')
    }
    listo.current?.focus()
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const cerrar = () => {
    const d = ref.current
    if (d?.open) {
      if (typeof d.close === 'function') d.close()
      else d.removeAttribute('open')
    }
    alCerrar()
    if (origen.current?.isConnected) origen.current.focus()
  }

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(acceso.url)
      setCopiado(true)
    } catch {
      setCopiado(false)
      setError('No pudimos copiar el enlace. Selecciónalo y cópialo a mano.')
    }
  }

  const otro = async () => {
    setGenerando(true)
    setError(null)
    try {
      setAcceso(await api.post<Acceso>(`/api/admin/participantes/${encodeURIComponent(participanteId)}/acceso`))
      setCopiado(false)
      setAhora(Date.now())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos generar otro enlace.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialogo-acceso"
      aria-labelledby="acceso-titulo"
      aria-describedby="acceso-para-que"
      onCancel={(e) => {
        e.preventDefault()
        cerrar()
      }}
    >
      <h2 id="acceso-titulo">Acceso de nuevo para {nombre}</h2>
      <p id="acceso-para-que">
        Sirve cuando alguien cambió de celular o borró la sesión. Pídele que escanee este QR con la cámara de su celular o que abra el enlace: vuelve a su mesa con su perfil y sus
        votos.
      </p>
      {vencido ? (
        <p className="alerta alerta--aviso" role="status">
          Este enlace venció. Genera otro si la persona todavía no entra.
        </p>
      ) : (
        <>
          <div className="acceso-qr">{qr ? <img src={qr} alt={`Código QR del acceso de ${nombre}`} /> : <p role="status">Dibujando el QR…</p>}</div>
          <p className="acceso-enlace">
            <span className="url">{acceso.url}</span>
          </p>
        </>
      )}
      <p className="acceso-vence">
        <strong>
          Sirve una sola vez y vence a las {horaCorta(acceso.vence_at, zona)}
          {vencido ? '.' : ` (en ${faltan(restante)}).`}
        </strong>{' '}
        Al usarlo se cierra la sesión que tenga abierta en otro celular.
      </p>
      {error && (
        <p className="alerta alerta--error" role="alert">
          {error}
        </p>
      )}
      <div className="acciones">
        <button ref={listo} type="button" className="hz-boton hz-boton--primario" onClick={cerrar}>
          Listo
        </button>
        {!vencido && (
          <button type="button" className="hz-boton hz-boton--secundario" onClick={() => void copiar()}>
            {copiado ? 'Enlace copiado' : 'Copiar enlace'}
          </button>
        )}
        <button type="button" className="hz-boton hz-boton--secundario" disabled={generando} onClick={() => void otro()}>
          {generando ? 'Generando…' : 'Generar otro enlace'}
        </button>
      </div>
    </dialog>
  )
}
