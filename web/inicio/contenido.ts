// Datos de la landing que vienen de la semilla o de una decisión, con su fuente. No se redactan de nuevo.
// De la semilla solo llega la proyección mínima (semilla_inicio.json): las hojas de perfil y el caso no se publican
// en la landing (QA por roles del 20-oct; semilla.test.ts lo verifica sobre el build).
import { NOMBRE_CORTO } from '../shared/criterios'
import type { CriterioId } from '../shared/api/contrato'
import semilla from './semilla_inicio.json'

/** Política vigente (docs/CONSENTIMIENTO.md §2 y docs/DESPLIEGUE.md). La raíz no tiene mesa: no hay `politica_url` del servidor. */
export const URL_POLITICA = 'https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/'

/** Canal de derechos del titular, contacto del aviso de datos y contacto comercial (docs/CONSENTIMIENTO.md §3). */
export const CORREO_ESTRATEK = 'info@estratek.com.co'

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

/** Los 6 criterios agrupados por el eje al que alimentan (sin mostrar pesos ni fórmulas). */
export const EJES = [
  {
    id: 'x',
    nombre: 'Time 2 Market',
    lectura: 'El eje horizontal: qué tan lejos está el proyecto de llegar al mercado con lo que la empresa tiene hoy.',
    criterios: semilla.ejes.x.map(criterio),
  },
  {
    id: 'y',
    nombre: 'Value Generation Capacity',
    lectura: 'El eje vertical: qué tan lejos está el proyecto del core del negocio y cuánto cuesta probarlo.',
    criterios: semilla.ejes.y.map(criterio),
  },
]

/** Criterio de ejemplo para probar la escala: textos cortos, se lee bien en 360 px. */
export const RUBRICA_EJEMPLO = { ...criterio(semilla.ejemplo), opciones: semilla.ejemplo.rubrica }

/** Horizontes de la ilustración: radios de los cuartos de círculo y posición de las etiquetas H1, H2 y H3. */
export const GRAFICO = { horizontes: semilla.horizontes, etiquetas_horizonte: semilla.etiquetas_horizonte }
