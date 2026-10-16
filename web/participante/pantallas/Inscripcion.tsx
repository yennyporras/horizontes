import { useRef, useState, type FormEvent } from 'react'
import { Aviso, Boton, Campo, Casilla } from '../../shared/ui'
import { ErrorApi, inscribirse, type Mesa } from '../api'
import { Marco } from '../Comun'

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface InscripcionProps {
  codigo: string
  mesa: Mesa
  onInscrito: (token: string, yaInscrito: boolean) => void
}

/** 8.1 Inscripción con el componente de consentimiento (patrón del IRMI, texto de Estratek). */
export function Inscripcion({ codigo, mesa, onInscrito }: InscripcionProps) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [errores, setErrores] = useState<{ nombre?: string; correo?: string }>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const validar = () => {
    const e: { nombre?: string; correo?: string } = {}
    if (!nombre.trim()) e.nombre = 'Escribe tu nombre.'
    if (!CORREO.test(correo.trim())) e.correo = 'Escribe un correo válido, por ejemplo ana@empresa.com.'
    setErrores(e)
    return e
  }

  const enviar = async (ev?: FormEvent) => {
    ev?.preventDefault()
    if (enviando || !acepta) return
    const e = validar()
    if (e.nombre || e.correo) {
      formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setEnviando(true)
    setErrorEnvio(null)
    try {
      const r = await inscribirse({ codigoMesa: codigo, nombre: nombre.trim(), correo: correo.trim().toLowerCase(), version: mesa.consentimiento.version })
      onInscrito(r.token, r.yaInscrito)
    } catch (err) {
      const ea = err instanceof ErrorApi ? err : null
      if (ea?.codigo === 'CONSENTIMIENTO_REQUERIDO') setErrorEnvio('Marca la autorización de tratamiento de datos para continuar.')
      else if (ea?.esRed) setErrorEnvio('Sin conexión. Revisa la señal e intenta de nuevo; lo que escribiste sigue aquí.')
      else if (ea?.codigo === 'INSCRIPCION_CERRADA' || ea?.codigo === 'SALA_CERRADA') setErrorEnvio('La inscripción de esta sala está cerrada. Pregúntale al facilitador.')
      else if (ea && ea.status < 500 && ea.message) setErrorEnvio(ea.message)
      else setErrorEnvio('Algo falló de nuestro lado. Vuelve a intentarlo en unos segundos.')
      setEnviando(false)
    }
  }

  return (
    <Marco
      sala={mesa.sala.nombre}
      meta={mesa.mesa.nombre}
      claveFoco="inscripcion"
      notaBarra={!acepta ? 'Para inscribirte necesitamos tu autorización de tratamiento de datos.' : undefined}
      barra={
        <Boton bloque deshabilitado={!acepta} cargando={enviando} textoCargando="Inscribiendo…" onClick={() => void enviar()}>
          Inscribirme
        </Boton>
      }
    >
      <h1 className="hz-titulo">Bienvenido al taller Horizontes</h1>
      <p className="hz-texto-2">
        Estás en {mesa.mesa.nombre} de {mesa.sala.nombre}. Inscríbete para recibir el caso y tu hoja de información.
      </p>
      <form ref={formRef} className="hzp-form" noValidate onSubmit={enviar}>
        <Campo
          etiqueta="Tu nombre"
          ayuda="Así te verá el facilitador en la lista de tu mesa."
          autoComplete="name"
          value={nombre}
          maxLength={80}
          error={errores.nombre}
          onChange={(e) => setNombre(e.target.value)}
          onBlur={() => errores.nombre && validar()}
        />
        <Campo
          etiqueta="Tu correo"
          ayuda="Solo lo usamos con fines informativos."
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={correo}
          maxLength={120}
          error={errores.correo}
          onChange={(e) => setCorreo(e.target.value)}
          onBlur={() => errores.correo && validar()}
        />
        <section className="hzp-consentimiento" aria-labelledby="hzp-consentimiento-titulo">
          <h2 id="hzp-consentimiento-titulo" className="hzp-consentimiento__titulo">
            Autorización de tratamiento de datos
          </h2>
          <Casilla marcada={acepta} onCambio={setAcepta} nombre="consentimiento">
            {mesa.consentimiento.texto_autorizacion}{' '}
            <a href={mesa.consentimiento.politica_url} target="_blank" rel="noopener noreferrer">
              Lee la Política de Tratamiento de Datos Personales de Estratek
            </a>
          </Casilla>
        </section>
        {errorEnvio && <Aviso tono="error">{errorEnvio}</Aviso>}
        {/* Enter en un campo envía el formulario; el botón visible vive en la barra inferior. */}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Marco>
  )
}
