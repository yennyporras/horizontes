import { config } from '../config.js'
import { type Pais, sha256 } from './util.js'

// Aviso de autorización de Estratek según el país de la sala (docs/CONSENTIMIENTO.md §5.1). Si cambia un texto, sube la versión.
// hz-1.2 (decisión 2 de Paola, 20-oct): fiel a lo que pasa. Nombra todos los datos que se guardan (también IP, país y
// navegador, por seguridad), para qué se usan, quién ve qué y, en Perú, que los datos se guardan fuera del país.
// hz-1.3 (decisión 2 de Paola, 21-oct): los resultados se ven desde 1 voto y con cada calificación, así que el aviso ya
// no promete promedios de 3 o más personas: dice que nadie ve el nombre en el tablero ni en los celulares.
export const VERSION_CONSENTIMIENTO = 'hz-1.3'

const DATOS =
  'Declaro que soy mayor de edad y autorizo a Estratek S.A.S. a tratar mi nombre, mi correo y mis calificaciones, y por seguridad la IP, el país y el navegador de mi conexión, para identificarme en mi mesa, evitar inscripciones dobles y devolverme el acceso si cambio de celular durante este taller.'
const USO =
  'No se usan para publicidad ni se entregan a terceros. En el tablero y en los celulares nadie ve mi nombre: se ven los promedios de mi mesa o de la sala, que se actualizan con cada calificación. El equipo de Estratek que facilita el taller sí ve mis calificaciones con mi nombre, para conducirlo.'
const POLITICA = 'la Política de Tratamiento de Datos Personales de Estratek'
const DERECHOS = 'Puedo conocer, actualizar, rectificar o suprimir mis datos y revocar esta autorización escribiendo a info@estratek.com.co.'

export const TEXTOS_AUTORIZACION: Record<Pais, string> = {
  CO: `${DATOS} ${USO} Esta autorización se rige por la Ley 1581 de 2012 de Colombia y por ${POLITICA}. ${DERECHOS}`,
  PE: `${DATOS} ${USO} Esta autorización se rige por la Ley 29733, Ley de Protección de Datos Personales del Perú, y por ${POLITICA}. Mis datos se guardan en servidores fuera del Perú. Puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición, y revocar esta autorización, escribiendo a info@estratek.com.co.`,
  GT: `${DATOS} ${USO} Esta autorización se rige por ${POLITICA}, que se aplica a los participantes en Guatemala. ${DERECHOS}`,
}

export function consentimientoVigente(pais: Pais) {
  return { version: VERSION_CONSENTIMIENTO, texto_autorizacion: TEXTOS_AUTORIZACION[pais], politica_url: config.politicaUrl }
}

export const hashTextoConsentimiento = (pais: Pais) => sha256(TEXTOS_AUTORIZACION[pais])
