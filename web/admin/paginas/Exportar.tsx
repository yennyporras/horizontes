import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { consultar, usaMocks } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import { AvisoPrivado } from '../componentes/AvisoPrivado'
import { svgMatriz, vistaPorDefecto } from '../../tablero'
import type { SalaDetalle } from '../tipos'
import { rutaApiTablero, urlTableroSala } from '../textos'

interface Archivo {
  archivo: string
  titulo: string
  texto: string
}

/** QA por roles del 20-oct (empresa cliente): lo que se entrega al cliente, sin datos personales. */
const PARA_EL_CLIENTE: Archivo = {
  archivo: 'resultados.csv',
  titulo: 'Resultados',
  texto: 'Promedios por criterio y posición de cada proyecto, por sala y por mesa, en R1 y R2. Sin nombres ni IP: es el archivo para entregar al cliente.',
}

const REGISTRO_INTERNO: Archivo[] = [
  {
    archivo: 'inscritos.csv',
    titulo: 'Inscritos',
    texto: 'Nombre, correo, mesa, perfil, consentimiento (versión y fecha), y al final país e IP de la inscripción. No se entregan al cliente.',
  },
  {
    archivo: 'votos.csv',
    titulo: 'Votos',
    texto:
      'Un identificador por persona, mesa, perfil, ronda, proyecto, los 6 valores y si la persona sigue activa, y al final país e IP del voto. Sin nombres ni correos. No se entregan al cliente. Seudonimizado, no anónimo: con mesa, perfil e IP se sabe quién es. Trátalo como dato personal.',
  },
]

/**
 * SVG de la matriz de la sala para descargar: `svgMatriz` del tablero (fondo, sin animación, colores del tema escritos)
 * con la vista que corresponde al estado de la sala.
 */
export function svgDescargable(datos: unknown, estado: SalaDetalle['sala']['estado'], ronda: number | undefined, estilo?: CSSStyleDeclaration): string {
  const vista = vistaPorDefecto(estado, ronda)
  return svgMatriz(datos as Parameters<typeof svgMatriz>[0], { vista, tokens: estilo ? (n) => estilo.getPropertyValue(n).trim() : undefined })
}

function descargar(contenido: string, tipo: string, nombre: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }))
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

export function Exportar() {
  const { salaId } = useParams()
  const { datos, error } = useSala(salaId)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)
  const [generando, setGenerando] = useState(false)

  // En modo simulado el CSV sale del servidor en memoria; con la API real el navegador descarga el archivo directo.
  const descargarSimulado = async (archivo: string, codigo: string) => {
    setErrorDescarga(null)
    try {
      const r = await consultar<string>(`/api/admin/salas/${salaId}/export/${archivo}`)
      if (r) descargar(r.datos, 'text/csv;charset=utf-8', `${codigo}-${archivo}`)
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el archivo.')
    }
  }

  const descargarMatriz = async (d: SalaDetalle) => {
    setErrorDescarga(null)
    const url = urlTableroSala(d.sala.url_tablero, d.mesas[0]?.url_tablero)
    if (!url) return setErrorDescarga('Esta sala aún no tiene tablero: agrega una mesa en Mesas y QR.')
    setGenerando(true)
    try {
      const r = await consultar<unknown>(rutaApiTablero(d.sala.id, url))
      if (!r) return
      const raiz = document.querySelector('.hz-admin') ?? document.documentElement
      descargar(svgDescargable(r.datos, d.sala.estado, d.sala.ronda_actual, getComputedStyle(raiz)), 'image/svg+xml;charset=utf-8', `${d.sala.codigo}-matriz.svg`)
    } catch (e) {
      setErrorDescarga(e instanceof Error ? `No pudimos generar la matriz. ${e.message}` : 'No pudimos generar la matriz.')
    } finally {
      setGenerando(false)
    }
  }

  const tarjeta = (f: Archivo, d: SalaDetalle, extra?: ReactNode) => (
    <section key={f.archivo} className="panel tarjeta-accion" aria-labelledby={`t-${f.archivo}`}>
      <h2 id={`t-${f.archivo}`}>{f.titulo}</h2>
      <p>{f.texto}</p>
      <div className="acciones">
        {usaMocks() ? (
          <button type="button" className="hz-boton hz-boton--secundario" onClick={() => descargarSimulado(f.archivo, d.sala.codigo)}>
            Descargar {f.archivo}
          </button>
        ) : (
          <a className="hz-boton hz-boton--secundario" href={`/api/admin/salas/${encodeURIComponent(d.sala.id)}/export/${f.archivo}`} download={`${d.sala.codigo}-${f.archivo}`}>
            Descargar {f.archivo}
          </a>
        )}
        {extra}
      </div>
    </section>
  )

  return (
    <ConSala titulo="Exportar datos" datos={datos} error={error}>
      {(d) => (
        <>
          <p className="pista">Archivos CSV en UTF-8 que abren bien en Excel. Se generan con los datos del momento.</p>
          {errorDescarga && (
            <p className="alerta alerta--error" role="alert">
              {errorDescarga}
            </p>
          )}
          <h2 className="titulo-grupo">Para entregar al cliente</h2>
          <div className="rejilla">
            {tarjeta(
              PARA_EL_CLIENTE,
              d,
              <button type="button" className="hz-boton hz-boton--secundario" disabled={generando} aria-busy={generando} onClick={() => void descargarMatriz(d)}>
                {generando ? 'Generando…' : 'Descargar matriz (SVG)'}
              </button>,
            )}
          </div>
          <p className="pista">
            Los promedios solo salen con 3 votos o más por mesa y ronda. La matriz es la del tablero de la sala, como imagen que se abre en cualquier navegador o en
            PowerPoint.
          </p>
          <h2 className="titulo-grupo">Registro interno</h2>
          {/* QA-A-30: el mismo aviso que Participantes y Respuestas para el mismo tipo de datos. */}
          <AvisoPrivado>
            Registro interno: quién se inscribió y cuándo, y desde qué país e IP se inscribió y votó. El tablero, los celulares y el proyector siguen anónimos. Guarda los archivos
            solo donde lo permita la política de datos de Estratek.
          </AvisoPrivado>
          <div className="rejilla">{REGISTRO_INTERNO.map((f) => tarjeta(f, d))}</div>
          {d.participantes.length === 0 && <p className="vacio">Aún no hay inscritos: los archivos saldrán solo con los encabezados.</p>}
        </>
      )}
    </ConSala>
  )
}
