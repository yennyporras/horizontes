import { useRef, useState, type FormEvent } from 'react'
import { Aviso, Boton, Campo, Casilla } from '../../shared/ui'
import { ErrorApi, inscribirse, type Mesa, type Pais } from '../api'
import { Marco } from '../Comun'
import { guardarDatos, leerDatos } from '../sesion'

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export interface InscripcionProps {
  codigo: string
  mesa: Mesa
  onInscrito: (token: string, yaInscrito: boolean) => void
  /** Inscripción cerrada: solo recupera la sesión de quien ya se inscribió con ese correo. */
  recuperar?: boolean
  /** Por qué se recupera (sesión vencida): aviso arriba del formulario. */
  motivo?: string
}

/** 8.1 Inscripción con el componente de consentimiento (patrón del IRMI, texto de Estratek). */
export function Inscripcion({ codigo, mesa, onInscrito, recuperar, motivo }: InscripcionProps) {
  // Solo al recuperar la sesión el formulario llega lleno; una inscripción nueva nunca muestra datos de otra persona.
  const [nombre, setNombre] = useState(() => (recuperar ? (leerDatos(codigo)?.nombre ?? '') : ''))
  const [correo, setCorreo] = useState(() => (recuperar ? (leerDatos(codigo)?.correo ?? '') : ''))
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
      const datos = { nombre: nombre.trim(), correo: correo.trim().toLowerCase() }
      const r = await inscribirse({ codigoMesa: codigo, ...datos, version: mesa.consentimiento.version })
      guardarDatos(codigo, datos)
      onInscrito(r.token, r.yaInscrito)
    } catch (err) {
      const ea = err instanceof ErrorApi ? err : null
      if (ea?.codigo === 'CONSENTIMIENTO_REQUERIDO') setErrorEnvio('Marca la autorización de tratamiento de datos para continuar.')
      else if (ea?.esRed) setErrorEnvio('Sin conexión. Revisa la señal e intenta de nuevo. Lo que escribiste sigue aquí.')
      else if (ea?.codigo === 'INSCRIPCION_CERRADA' || ea?.codigo === 'SALA_CERRADA')
        setErrorEnvio(
          recuperar
            ? 'No encontramos ese correo en esta sala. Escríbelo igual que cuando te inscribiste.'
            : 'La inscripción de esta sala está cerrada. Pregúntale al facilitador.',
        )
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
          {recuperar ? 'Recuperar mi sesión' : 'Inscribirme'}
        </Boton>
      }
    >
      <h1 className="hz-titulo">{recuperar ? 'Recupera tu sesión' : 'Te damos la bienvenida al taller Horizontes'}</h1>
      <p className="hz-texto-2">
        {recuperar
          ? `Escribe el correo con el que te inscribiste en ${mesa.sala.nombre} y retomas donde ibas.`
          : `Estás en ${mesa.mesa.nombre} de ${mesa.sala.nombre}. Inscríbete para recibir el caso y tu hoja de información.`}
      </p>
      {motivo && <Aviso tono="info">{motivo}</Aviso>}
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
          <AvisoDatos pais={mesa.sala.pais ?? 'CO'} />
          <Casilla marcada={acepta} onCambio={setAcepta} nombre="consentimiento">
            {mesa.consentimiento.texto_autorizacion}{' '}
            <a href={mesa.consentimiento.politica_url || POLITICA_ESTRATEK} target="_blank" rel="noopener noreferrer">
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

/** Política publicada por Estratek (vigente desde el 25 de abril de 2016). Respaldo si el servidor no envía la URL. */
export const POLITICA_ESTRATEK = 'https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/'
export const CORREO_DATOS = 'info@estratek.com.co'

/**
 * Norma y autoridad por país de la sala (acta P4, R4_CONTRATO C6). Guatemala no tiene ley general de datos:
 * aplica la política de Estratek. El texto de la casilla lo sirve el servidor; ver docs/CONSENTIMIENTO.md §5.
 */
export const LEY_DATOS: Record<Pais, { norma: string; autoridad?: string }> = {
  CO: { norma: 'La Ley 1581 de 2012 de Colombia y la política de Estratek.', autoridad: 'la Superintendencia de Industria y Comercio' },
  PE: { norma: 'La Ley 29733 de Perú y la política de Estratek.', autoridad: 'la Autoridad Nacional de Protección de Datos Personales' },
  GT: { norma: 'La Política de Tratamiento de Datos Personales de Estratek.' },
}

/** Aviso de privacidad corto, resumido de la política de Estratek, con la norma del país de la sala. */
function AvisoDatos({ pais }: { pais: Pais }) {
  const { norma, autoridad } = LEY_DATOS[pais] ?? LEY_DATOS.CO
  return (
    <dl className="hzp-aviso-datos">
      <div>
        <dt>Quién trata tus datos</dt>
        <dd>Estratek S.A.S., Medellín, Colombia.</dd>
      </div>
      <div>
        <dt>Qué datos</dt>
        <dd>Tu nombre y tu correo. Tus calificaciones solo se ven en promedios, sin nombres.</dd>
      </div>
      <div>
        <dt>Para qué</dt>
        <dd>Fines informativos de este taller.</dd>
      </div>
      <div>
        <dt>Qué norma aplica</dt>
        <dd>{norma}</dd>
      </div>
      <div>
        <dt>Tus derechos</dt>
        <dd>
          Conocer, actualizar, rectificar o suprimir tus datos y revocar esta autorización. Escribe a <a href={`mailto:${CORREO_DATOS}`}>{CORREO_DATOS}</a>: respondemos en
          máximo 10 días hábiles.{autoridad && ` También puedes acudir a ${autoridad}.`}
        </dd>
      </div>
    </dl>
  )
}
