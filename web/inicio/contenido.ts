// Datos de la landing que vienen de la semilla o de una decisión, con su fuente. No se redactan de nuevo.
import seed from '../../data/seed_foodsume.json'

const { motor } = seed

/** Política vigente (docs/CONSENTIMIENTO.md §2 y docs/DESPLIEGUE.md). La raíz no tiene mesa: no hay `politica_url` del servidor. */
export const URL_POLITICA = 'https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/'

/** Canal de derechos del titular y contacto del aviso de datos (docs/CONSENTIMIENTO.md §3). */
export const CORREO_ESTRATEK = 'info@estratek.com.co'

export const ESCALA = motor.escala_permitida

export interface CriterioInicio {
  id: string
  nombre: string
  pregunta: string
}

const criterio = (id: string): CriterioInicio => {
  const c = motor.criterios.find((x) => x.id === id)
  if (!c) throw new Error(`Criterio ${id} no está en la semilla`)
  return { id: c.id, nombre: c.nombre, pregunta: c.pregunta }
}

/**
 * Los 6 criterios agrupados por el eje al que alimentan, leídos de `motor.pesos` (sin mostrar pesos ni fórmulas).
 * Eje X: los de Time 2 Market más capacidades organizacionales. Eje Y: alineación con el core e inversión.
 */
export const EJES = [
  {
    id: 'x',
    nombre: 'Time 2 Market',
    lectura: 'El eje horizontal: qué tan lejos está el proyecto de llegar al mercado con lo que la empresa tiene hoy.',
    criterios: [...Object.keys(motor.pesos.t2m), ...Object.keys(motor.pesos.eje_x).filter((k) => k !== 't2m')].map(criterio),
  },
  {
    id: 'y',
    nombre: 'Value Generation Capacity',
    lectura: 'El eje vertical: qué tan lejos está el proyecto del core del negocio y cuánto cuesta probarlo.',
    criterios: Object.keys(motor.pesos.eje_y).map(criterio),
  },
]

/** Criterio de ejemplo para probar la escala: textos cortos, se lee bien en 360 px. */
const ejemplo = motor.criterios.find((c) => c.id === 'regulacion')!
export const RUBRICA_EJEMPLO = { ...criterio(ejemplo.id), opciones: ejemplo.rubrica }
