// Proyección de la semilla para la landing: solo lo que la landing muestra (escala, preguntas de los criterios por eje,
// la rúbrica del ejemplo y los horizontes de la ilustración). Las hojas de perfil, el caso y los insumos de los fijos
// se quedan fuera del archivo público (QA por roles del 20-oct). Este archivo no importa la semilla: la recibe.
// semilla_inicio.json se regenera con `npx tsx web/inicio/generar-semilla.ts`; semilla.test.ts verifica que coincide.

export interface SemillaFuente {
  motor: {
    escala_permitida: number[]
    criterios: { id: string; pregunta: string; rubrica: { valor: number; texto: string }[] }[]
    pesos: { t2m: Record<string, number>; eje_x: Record<string, number>; eje_y: Record<string, number> }
    grafico: { horizontes: { id: string; radio: number | null }[]; etiquetas_horizonte: Record<string, number[]> }
  }
}

/** Criterio con el que se prueba la escala en la landing: textos cortos, se lee bien en 360 px. */
export const ID_EJEMPLO = 'regulacion'

export function proyectarSemilla(seed: SemillaFuente) {
  const { motor } = seed
  const pregunta = (id: string) => {
    const c = motor.criterios.find((x) => x.id === id)
    if (!c) throw new Error(`Criterio ${id} no está en la semilla`)
    return { id, pregunta: c.pregunta }
  }
  const ejemplo = motor.criterios.find((c) => c.id === ID_EJEMPLO)
  if (!ejemplo) throw new Error(`Criterio ${ID_EJEMPLO} no está en la semilla`)
  return {
    escala: motor.escala_permitida,
    // Eje X: los criterios de t2m y capacidades organizacionales. Eje Y: alineación con el core e inversión.
    ejes: {
      x: [...Object.keys(motor.pesos.t2m), ...Object.keys(motor.pesos.eje_x).filter((k) => k !== 't2m')].map(pregunta),
      y: Object.keys(motor.pesos.eje_y).map(pregunta),
    },
    ejemplo: { id: ejemplo.id, pregunta: ejemplo.pregunta, rubrica: ejemplo.rubrica },
    horizontes: motor.grafico.horizontes,
    etiquetas_horizonte: motor.grafico.etiquetas_horizonte,
  }
}
