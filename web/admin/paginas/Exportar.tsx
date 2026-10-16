import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { consultar, usaMocks } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'

const ARCHIVOS = [
  {
    archivo: 'inscritos.csv',
    titulo: 'Inscritos',
    texto: 'Nombre, correo, mesa, perfil y datos del consentimiento (versión y fecha). Contiene datos personales: guárdalo solo donde lo permita la política de datos de Estratek.',
  },
  {
    archivo: 'votos.csv',
    titulo: 'Votos anonimizados',
    texto: 'Un identificador anónimo por persona, mesa, perfil, ronda, proyecto y los 6 valores. Sin nombres ni correos.',
  },
]

export function Exportar() {
  const { salaId } = useParams()
  const { datos, error } = useSala(salaId)
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null)

  // En modo simulado el CSV sale del servidor en memoria; con la API real el navegador descarga el archivo directo.
  const descargarSimulado = async (archivo: string, codigo: string) => {
    setErrorDescarga(null)
    try {
      const r = await consultar<string>(`/api/admin/salas/${salaId}/export/${archivo}`)
      if (!r) return
      const url = URL.createObjectURL(new Blob([r.datos], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `${codigo}-${archivo}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setErrorDescarga(e instanceof Error ? e.message : 'No se pudo generar el archivo.')
    }
  }

  return (
    <ConSala titulo="Export" datos={datos} error={error}>
      {(d) => (
        <>
          <p className="pista">Archivos CSV en UTF-8 que abren bien en Excel. Se generan con los datos del momento.</p>
          {errorDescarga && (
            <p className="alerta alerta--error" role="alert">
              {errorDescarga}
            </p>
          )}
          <div className="rejilla">
            {ARCHIVOS.map((f) => (
              <section key={f.archivo} className="panel" aria-labelledby={`t-${f.archivo}`}>
                <h2 id={`t-${f.archivo}`}>{f.titulo}</h2>
                <p>{f.texto}</p>
                {usaMocks() ? (
                  <button className="btn btn--primario" onClick={() => descargarSimulado(f.archivo, d.sala.codigo)}>
                    Descargar {f.archivo}
                  </button>
                ) : (
                  <a className="btn btn--primario" href={`/api/admin/salas/${encodeURIComponent(d.sala.id)}/export/${f.archivo}`} download={`${d.sala.codigo}-${f.archivo}`}>
                    Descargar {f.archivo}
                  </a>
                )}
              </section>
            ))}
          </div>
          {d.participantes.length === 0 && <p className="vacio">Aún no hay inscritos: los archivos saldrán solo con los encabezados.</p>}
        </>
      )}
    </ConSala>
  )
}
