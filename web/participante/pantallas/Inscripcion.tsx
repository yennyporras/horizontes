import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Aviso, Boton, Campo, Casilla, Icono } from '../../shared/ui'
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

type Errores = { nombre?: string; correo?: string; casilla?: string }

/** Falta la casilla (QA por roles del 20-oct): el botón queda activo y, al tocarlo, lleva a la casilla con este error. */
export const TEXTO_FALTA_CASILLA = 'Marca la casilla de autorización para inscribirte'
/** Qué va a hacer la persona en el taller, antes de pedirle datos. */
export const TEXTO_QUE_HARAS = 'Vas a leer un caso y calificar dos proyectos en dos rondas: primero por tu cuenta y después con tu mesa.'
/** Para qué pedimos el correo (aviso hz-1.2: el correo evita inscripciones dobles). */
export const AYUDA_CORREO = 'Evita que haya dos inscripciones a tu nombre. No te enviaremos publicidad.'

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
    if (!enfocarError) return
    const form = formRef.current
    // El primer campo inválido; si los dos datos están bien y falta la casilla (al final del formulario), se desplaza
    // hasta ella y le da el foco.
    const campo =
      form?.querySelector<HTMLInputElement>('[aria-invalid="true"]') ?? (errores.casilla ? form?.querySelector<HTMLInputElement>('input[type="checkbox"]') : null)
    if (!campo) return
    if (campo.type === 'checkbox') campo.closest('.hzp-consentimiento')?.scrollIntoView?.({ block: 'center' })
    campo.focus({ preventScroll: campo.type === 'checkbox' })
    // Solo con cada intento nuevo.
  }, [enfocarError])

  /** `conCasilla`: al intentar inscribirse también se revisa la casilla; al salir de un campo, no. */
  const validar = (conCasilla = false) => {
    const e: Errores = {}
    const n = limpiarNombre(nombre)
    if (!n) e.nombre = 'Escribe tu nombre.'
    else if (n.length < NOMBRE_MIN || n.length > NOMBRE_MAX) e.nombre = `Escribe tu nombre (entre ${NOMBRE_MIN} y ${NOMBRE_MAX} caracteres).`
    if (!CORREO.test(correo.trim())) e.correo = 'Escribe un correo válido, por ejemplo ana@empresa.com.'
    if (!acepta && (conCasilla || errores.casilla)) e.casilla = TEXTO_FALTA_CASILLA
    setErrores(e)
    return e
  }

  const enviar = async (ev?: FormEvent) => {
    ev?.preventDefault()
    if (enviando || previa) return
    // Un intento nuevo reemplaza el error del anterior.
    setErrorEnvio(null)
    const e = validar(true)
    if (e.nombre || e.correo || e.casilla) {
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
        previa ? 'Vista previa: el botón no inscribe a nadie.' : !acepta ? 'Marca la casilla de autorización, al final del formulario.' : undefined
      }
      barra={
        // Siempre activo (QA por roles del 20-oct): sin la casilla, el toque lleva a ella y dice qué falta.
        <Boton bloque deshabilitado={previa} cargando={enviando} textoCargando="Inscribiendo…" onClick={() => void enviar()}>
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
      {/* La sala y la mesa ya van en la franja de arriba: el texto no las repite. */}
      <p className="hz-texto-2">{TEXTO_QUE_HARAS}</p>
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
          ayuda={AYUDA_CORREO}
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
          {/* El texto de la casilla lo sirve el servidor (versión vigente del aviso, con su hash): aquí no se repite. */}
          <Casilla
            marcada={acepta}
            onCambio={(v) => {
              setAcepta(v)
              if (v) setErrores(({ casilla: _casilla, ...resto }) => resto)
            }}
            nombre="consentimiento"
          >
            {mesa.consentimiento.texto_autorizacion}{' '}
            <a href={mesa.consentimiento.politica_url || POLITICA_ESTRATEK} target="_blank" rel="noopener noreferrer">
              Lee la Política de Tratamiento de Datos Personales de Estratek
            </a>
          </Casilla>
          {errores.casilla && (
            <p className="hzp-error-casilla" role="alert">
              <Icono tono="error" />
              {errores.casilla}
            </p>
          )}
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
 * Versión del aviso de datos que arma el celular (decisión 2 de Paola del 20-oct): dice qué se guarda de verdad (también
 * IP, país y navegador), para qué, quién ve qué y, en Perú, dónde se guardan. La casilla y su versión las sirve el
 * servidor (`consentimiento.version`); docs/CONSENTIMIENTO.md trae los dos textos.
 */
export const VERSION_AVISO_DATOS = 'hz-1.3'

/**
 * Norma, derechos y autoridad por país de la sala (acta del 16-oct, P4 y C6). Guatemala no tiene ley general de datos:
 * aplica la política de Estratek. Los derechos se nombran como los nombra la norma del país, igual que la casilla
 * que sirve el servidor (en Perú, los derechos ARCO de la Ley 29733). En Perú se informa además que los datos se
 * guardan fuera del país (decisión 2 de Paola del 20-oct). Ver docs/CONSENTIMIENTO.md §5.
 */
export const LEY_DATOS: Record<Pais, { norma: string; derechos: string; autoridad?: string; ubicacion?: string }> = {
  CO: {
    norma: 'La Ley 1581 de 2012 de Colombia y la política de Estratek.',
    derechos: 'Conocer, actualizar, rectificar o suprimir tus datos y revocar esta autorización.',
    autoridad: 'la Superintendencia de Industria y Comercio',
  },
  PE: {
    norma: 'La Ley 29733 de Perú y la política de Estratek.',
    derechos: 'Acceso, rectificación, cancelación y oposición sobre tus datos, y revocar esta autorización.',
    autoridad: 'la Autoridad Nacional de Protección de Datos Personales',
    ubicacion: 'En servidores ubicados fuera del Perú.',
  },
  GT: {
    norma: 'La Política de Tratamiento de Datos Personales de Estratek.',
    derechos: 'Conocer, actualizar, rectificar o suprimir tus datos y revocar esta autorización.',
  },
}

/** Filas del aviso que no cambian por país (versión `hz-1.3`). */
export const AVISO_DATOS = {
  quien: 'Estratek S.A.S., Medellín, Colombia.',
  datos:
    'Tu nombre, tu correo y tus calificaciones. Por seguridad también guardamos la dirección IP, el país y el navegador desde los que te conectas.',
  para: 'Identificarte en tu mesa, evitar inscripciones dobles y devolverte el acceso si cambias de celular. No los usamos para publicidad ni los compartimos con terceros.',
  quienVe:
    'En el tablero y en los celulares nadie ve tu nombre: se ven los promedios de tu mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve tus calificaciones con tu nombre, para conducirlo.',
} as const

/** Aviso de privacidad corto, resumido de la política de Estratek, con la norma del país de la sala. */
function AvisoDatos({ pais }: { pais: Pais }) {
  const { norma, derechos, autoridad, ubicacion } = LEY_DATOS[pais] ?? LEY_DATOS.CO
  return (
    <dl className="hzp-aviso-datos" data-version={VERSION_AVISO_DATOS}>
      <div>
        <dt>Quién trata tus datos</dt>
        <dd>{AVISO_DATOS.quien}</dd>
      </div>
      <div>
        <dt>Qué datos</dt>
        <dd>{AVISO_DATOS.datos}</dd>
      </div>
      <div>
        <dt>Para qué</dt>
        <dd>{AVISO_DATOS.para}</dd>
      </div>
      <div>
        <dt>Quién ve qué</dt>
        <dd>{AVISO_DATOS.quienVe}</dd>
      </div>
      {ubicacion && (
        <div>
          <dt>Dónde se guardan</dt>
          <dd>{ubicacion}</dd>
        </div>
      )}
      <div>
        <dt>Qué norma aplica</dt>
        <dd>{norma}</dd>
      </div>
      <div>
        <dt>Tus derechos</dt>
        <dd>
          {derechos} Escribe a <a href={`mailto:${CORREO_DATOS}`}>{CORREO_DATOS}</a>: respondemos en un plazo máximo de 10 días hábiles.
          {autoridad && ` También puedes acudir a ${autoridad}.`}
        </dd>
      </div>
    </dl>
  )
}
