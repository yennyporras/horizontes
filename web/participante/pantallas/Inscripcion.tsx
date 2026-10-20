import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Aviso, Boton, Campo, Casilla } from '../../shared/ui'
import { ErrorApi, inscribirse, type Mesa, type Pais } from '../api'
import { Marco } from '../Comun'

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
/** Igual que el servidor: sin espacios de más, entre 2 y 120 caracteres. */
export const NOMBRE_MIN = 2
export const NOMBRE_MAX = 120
const limpiarNombre = (n: string) => n.trim().replace(/\s+/g, ' ')

/** El servidor ya no entrega la sesión de un correo inscrito (decisión D1 del 20-oct): el acceso nuevo lo da el facilitador. */
export const TEXTO_CORREO_INSCRITO =
  'Este correo ya está inscrito en esta sala. Si es tuyo y perdiste la sesión, pídele al facilitador que te dé acceso de nuevo.'

type Errores = { nombre?: string; correo?: string }

export interface InscripcionProps {
  codigo: string
  mesa: Mesa
  onInscrito: (token: string) => void
  /** Vista previa del facilitador (`?vista=previa` desde el panel): se ve igual, pero no inscribe a nadie. */
  previa?: boolean
}

/** 8.1 Inscripción con el componente de consentimiento (patrón del IRMI, texto de Estratek). */
export function Inscripcion({ codigo, mesa, onInscrito, previa = false }: InscripcionProps) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [acepta, setAcepta] = useState(false)
  const [errores, setErrores] = useState<Errores>({})
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  // Cada envío con errores sube este número: el foco va al primer campo inválido cuando ya está pintado como inválido.
  const [enfocarError, setEnfocarError] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (enfocarError) formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
  }, [enfocarError])

  const validar = () => {
    const e: Errores = {}
    const n = limpiarNombre(nombre)
    if (!n) e.nombre = 'Escribe tu nombre.'
    else if (n.length < NOMBRE_MIN || n.length > NOMBRE_MAX) e.nombre = `Escribe tu nombre (entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres).`
    if (!CORREO.test(correo.trim())) e.correo = 'Escribe un correo válido, por ejemplo ana@empresa.com.'
    setErrores(e)
    return e
  }

  const enviar = async (ev?: FormEvent) => {
    ev?.preventDefault()
    if (enviando || !acepta || previa) return
    // Un intento nuevo reemplaza el error del anterior.
    setErrorEnvio(null)
    const e = validar()
    if (e.nombre || e.correo) {
      setEnfocarError((n) => n + 1)
      return
    }
    setEnviando(true)
    try {
      const r = await inscribirse({ codigoMesa: codigo, nombre: limpiarNombre(nombre), correo: correo.trim().toLowerCase(), version: mesa.consentimiento.version })
      onInscrito(r.token)
    } catch (err) {
      const ea = err instanceof ErrorApi ? err : null
      const delServidor = (ea?.cuerpo as { error?: { mensaje?: string } } | null | undefined)?.error?.mensaje
      if (ea?.codigo === 'CONSENTIMIENTO_REQUERIDO') setErrorEnvio(delServidor || 'Marca la autorización de tratamiento de datos para continuar.')
      else if (ea?.codigo === 'CORREO_YA_INSCRITO') setErrorEnvio(delServidor || TEXTO_CORREO_INSCRITO)
      else if (ea?.esRed) setErrorEnvio('Sin conexión. Revisa la señal e intenta de nuevo. Lo que escribiste sigue aquí.')
      else if (ea?.codigo === 'INSCRIPCION_CERRADA' || ea?.codigo === 'SALA_CERRADA') setErrorEnvio('La inscripción de esta sala está cerrada. Pregúntale al facilitador.')
      else if (ea?.status === 422 && delServidor && /nombre|correo/i.test(delServidor)) {
        // Un dato que el servidor rechaza va en su campo, igual que los errores del celular.
        setErrores(/nombre/i.test(delServidor) ? { nombre: delServidor } : { correo: delServidor })
        setEnfocarError((n) => n + 1)
      } else if (ea && ea.status < 500 && delServidor) setErrorEnvio(delServidor)
      else setErrorEnvio('Algo falló de nuestro lado. Vuelve a intentarlo en unos segundos.')
      setEnviando(false)
    }
  }

  return (
    <Marco
      sala={mesa.sala.nombre}
      meta={mesa.mesa.nombre}
      claveFoco="inscripcion"
      notaBarra={
        previa
          ? 'Vista previa: el botón no inscribe a nadie.'
          : !acepta
            ? 'Para inscribirte necesitamos tu autorización de tratamiento de datos.'
            : undefined
      }
      barra={
        <Boton bloque deshabilitado={!acepta || previa} cargando={enviando} textoCargando="Inscribiendo…" onClick={() => void enviar()}>
          Inscribirme
        </Boton>
      }
    >
      {previa && (
        <Aviso tono="info" titulo="Vista previa del facilitador">
          Así ven los participantes la entrada a {mesa.mesa.nombre}. Desde aquí no se inscribe a nadie ni se vota: para
          probar el taller completo, usa otro celular o una ventana de incógnito con el QR de la mesa.
        </Aviso>
      )}
      <h1 className="hz-titulo">Te damos la bienvenida al taller Horizontes</h1>
      <p className="hz-texto-2">
        Estás en {mesa.mesa.nombre} de {mesa.sala.nombre}. Inscríbete para recibir el caso y tu hoja de información.
      </p>
      <form ref={formRef} className="hzp-form" noValidate onSubmit={enviar}>
        <Campo
          etiqueta="Tu nombre"
          ayuda="Así te verá el facilitador en la lista de tu mesa."
          autoComplete="name"
          value={nombre}
          maxLength={NOMBRE_MAX}
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
 * Norma, derechos y autoridad por país de la sala (acta del 16-oct, P4 y C6). Guatemala no tiene ley general de datos:
 * aplica la política de Estratek. Los derechos se nombran como los nombra la norma del país, igual que la casilla
 * que sirve el servidor (en Perú, los derechos ARCO de la Ley 29733). Ver docs/CONSENTIMIENTO.md §5.
 */
export const LEY_DATOS: Record<Pais, { norma: string; derechos: string; autoridad?: string }> = {
  CO: {
    norma: 'La Ley 1581 de 2012 de Colombia y la política de Estratek.',
    derechos: 'Conocer, actualizar, rectificar o suprimir tus datos y revocar esta autorización.',
    autoridad: 'la Superintendencia de Industria y Comercio',
  },
  PE: {
    norma: 'La Ley 29733 de Perú y la política de Estratek.',
    derechos: 'Acceso, rectificación, cancelación y oposición sobre tus datos, y revocar esta autorización.',
    autoridad: 'la Autoridad Nacional de Protección de Datos Personales',
  },
  GT: {
    norma: 'La Política de Tratamiento de Datos Personales de Estratek.',
    derechos: 'Conocer, actualizar, rectificar o suprimir tus datos y revocar esta autorización.',
  },
}

/** Aviso de privacidad corto, resumido de la política de Estratek, con la norma del país de la sala. */
function AvisoDatos({ pais }: { pais: Pais }) {
  const { norma, derechos, autoridad } = LEY_DATOS[pais] ?? LEY_DATOS.CO
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
          {derechos} Escribe a <a href={`mailto:${CORREO_DATOS}`}>{CORREO_DATOS}</a>: respondemos en máximo 10 días hábiles.
          {autoridad && ` También puedes acudir a ${autoridad}.`}
        </dd>
      </div>
    </dl>
  )
}
