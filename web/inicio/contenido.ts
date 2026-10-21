// Datos de la landing que vienen de la semilla o de una decisión, con su fuente. No se redactan de nuevo.
// De la semilla solo llega la proyección mínima (semilla_inicio.json): las hojas de perfil y el caso no se publican
// en la landing (QA por roles del 20-oct; semilla.test.ts lo verifica sobre el build).
import { NOMBRE_CORTO } from '../shared/criterios'
import type { CriterioId } from '../shared/api/contrato'
import semilla from './semilla_inicio.json'

/** Política y correo de Estratek: los mismos del pie común (web/shared/estratek.ts). La raíz no tiene mesa: no hay `politica_url` del servidor. */
export { URL_POLITICA, CORREO_ESTRATEK } from '../shared/estratek'

export const ESCALA = semilla.escala

export interface CriterioInicio {
  id: string
  nombre: string
  pregunta: string
}

/** Nombre corto, el mismo de las tablas del tablero y del celular (web/shared/criterios.ts). */
const criterio = ({ id, pregunta }: { id: string; pregunta: string }): CriterioInicio => ({
  id,
  nombre: NOMBRE_CORTO[id as CriterioId] ?? id,
  pregunta,
})

/** Los 6 criterios agrupados por el eje al que alimentan (sin mostrar pesos ni fórmulas). La lectura de los ejes es `LECTURA_EJES`. */
export const EJES = [
  { id: 'x', nombre: 'Time 2 Market', criterios: semilla.ejes.x.map(criterio) },
  { id: 'y', nombre: 'Value Generation Capacity', criterios: semilla.ejes.y.map(criterio) },
]

/** Criterio de ejemplo para probar la escala: textos cortos, se lee bien en 360 px. */
export const RUBRICA_EJEMPLO = { ...criterio(semilla.ejemplo), opciones: semilla.ejemplo.rubrica }

/** Horizontes de la ilustración: radios de los cuartos de círculo y posición de las etiquetas H1, H2 y H3. */
export const GRAFICO = { horizontes: semilla.horizontes, etiquetas_horizonte: semilla.etiquetas_horizonte }
