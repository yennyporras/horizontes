import { config } from '../config.js'
import { type Pais, sha256 } from './util.js'

// Aviso de autorización de Estratek según el país de la sala (docs/CONSENTIMIENTO.md §5.1). Si cambia un texto, sube la versión.
export const VERSION_CONSENTIMIENTO = 'hz-1.1'

const AUTORIZO = 'Declaro que soy mayor de edad y autorizo a Estratek S.A.S. a tratar mi nombre y mi correo con fines informativos de este taller, conforme a'
const POLITICA = 'la Política de Tratamiento de Datos Personales de Estratek'
const CONTACTO = 'escribiendo a info@estratek.com.co.'

export const TEXTOS_AUTORIZACION: Record<Pais, string> = {
  CO: `${AUTORIZO} la Ley 1581 de 2012 de Colombia y a ${POLITICA}. Puedo conocer, actualizar, rectificar o suprimir mis datos y revocar esta autorización ${CONTACTO}`,
  PE: `${AUTORIZO} la Ley 29733, Ley de Protección de Datos Personales del Perú, y a ${POLITICA}. Puedo ejercer mis derechos de acceso, rectificación, cancelación y oposición, y revocar esta autorización, ${CONTACTO}`,
  GT: `${AUTORIZO} ${POLITICA}, que se aplica a los participantes en Guatemala. Puedo conocer, actualizar, rectificar o suprimir mis datos y revocar esta autorización ${CONTACTO}`,
}

export function consentimientoVigente(pais: Pais) {
  return { version: VERSION_CONSENTIMIENTO, texto_autorizacion: TEXTOS_AUTORIZACION[pais], politica_url: config.politicaUrl }
}

export const hashTextoConsentimiento = (pais: Pais) => sha256(TEXTOS_AUTORIZACION[pais])
