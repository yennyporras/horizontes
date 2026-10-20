import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { consultar, usaMocks } from '../api'
import { useSala } from '../useSala'
import { ConSala } from './EncabezadoSala'
import { AvisoPrivado } from '../componentes/AvisoPrivado'

const ARCHIVOS = [
  {
    archivo: 'inscritos.csv',
    titulo: 'Inscritos',
    texto: 'Nombre, correo, mesa, perfil, consentimiento (versión y fecha), y al final país e IP de la inscripción.',
  },
  {
    archivo: 'votos.csv',
    titulo: 'Votos',
    texto: 'Un identificador por persona, mesa, perfil, ronda, proyecto, los 6 valores y si la persona sigue activa, y al final país e IP del voto. Sin nombres ni correos.',
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
    <ConSala titulo="Exportar datos" datos={datos} error={error}>
      {(d) => (
        <>
          <p className="pista">Archivos CSV en UTF-8 que abren bien en Excel. Se generan con los datos del momento.</p>
          {/* QA-A-30: el mismo aviso que Participantes y Respuestas para el mismo tipo de datos. */}
          <AvisoPrivado>
            Registro interno: quién se inscribió y cuándo, y desde qué país e IP se inscribió y votó. El tablero, los celulares y el proyector siguen anónimos. Guarda los archivos
            solo donde lo permita la política de datos de Estratek.
          </AvisoPrivado>
          {errorDescarga && (
            <p className="alerta alerta--error" role="alert">
              {errorDescarga}
            </p>
          )}
          <div className="rejilla">
            {ARCHIVOS.map((f) => (
              <section key={f.archivo} className="panel tarjeta-accion" aria-labelledby={`t-${f.archivo}`}>
                <h2 id={`t-${f.archivo}`}>{f.titulo}</h2>
                <p>{f.texto}</p>
                {usaMocks() ? (
                  <button type="button" className="hz-boton hz-boton--secundario" onClick={() => descargarSimulado(f.archivo, d.sala.codigo)}>
                    Descargar {f.archivo}
                  </button>
                ) : (
                  <a className="hz-boton hz-boton--secundario" href={`/api/admin/salas/${encodeURIComponent(d.sala.id)}/export/${f.archivo}`} download={`${d.sala.codigo}-${f.archivo}`}>
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
