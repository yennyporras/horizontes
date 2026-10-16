import { config } from '../config.js'
import { sha256 } from './util.js'

// Aviso de autorización de Estratek (Ley 1581). Si cambia el texto, sube la versión.
export const VERSION_CONSENTIMIENTO = 'estratek-v1'
export const TEXTO_AUTORIZACION =
  'Autorizo a Estratek S.A.S. a recolectar y tratar mi nombre y mi correo electrónico con fines informativos ' +
  'relacionados con este taller, de acuerdo con su Política de Tratamiento de Datos Personales. ' +
  'Puedo conocer, actualizar, rectificar o suprimir mis datos en cualquier momento escribiendo a Estratek.'

export function consentimientoVigente() {
  return { version: VERSION_CONSENTIMIENTO, texto_autorizacion: TEXTO_AUTORIZACION, politica_url: config.politicaUrl }
}

export const hashTextoConsentimiento = () => sha256(TEXTO_AUTORIZACION)
