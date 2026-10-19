import { config } from '../config.js'
import { type Pais, sha256 } from './util.js'

// Aviso de autorización de Estratek según el país de la sala. Si cambia un texto, sube la versión.
export const VERSION_CONSENTIMIENTO = 'hz-1.1'

const AUTORIZO =
  'Autorizo a Estratek S.A.S. a recolectar y tratar mi nombre y mi correo electrónico con fines informativos ' +
  'relacionados con este taller, de acuerdo con su Política de Tratamiento de Datos Personales'
const DERECHOS = 'Puedo conocer, actualizar, rectificar o suprimir mis datos en cualquier momento escribiendo a Estratek.'

export const TEXTOS_AUTORIZACION: Record<Pais, string> = {
  CO: `${AUTORIZO} y con la Ley 1581 de 2012 de Colombia. ${DERECHOS}`,
  PE: `${AUTORIZO} y con la Ley 29733, Ley de Protección de Datos Personales del Perú. ${DERECHOS}`,
  GT: `${AUTORIZO}, que se aplica a los participantes en Guatemala. ${DERECHOS}`,
}

export function consentimientoVigente(pais: Pais) {
  return { version: VERSION_CONSENTIMIENTO, texto_autorizacion: TEXTOS_AUTORIZACION[pais], politica_url: config.politicaUrl }
}

export const hashTextoConsentimiento = (pais: Pais) => sha256(TEXTOS_AUTORIZACION[pais])
