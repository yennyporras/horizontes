import { useEffect, useMemo, useState } from 'react'
import { api, lista } from './api'
import { NOMBRE_CORTO, nombreCortoCriterio } from '../shared/criterios'
import type { CriterioId, PreguntaGuiada } from '../shared/api/contrato'
import type { HojasSala, RubricasSala, SalaDetalle } from './tipos'

/**
 * Contenido de la sala que el panel nombra: criterios, proyectos vivos y perfiles. QA por roles del 20-oct: el panel ya
 * no importa la semilla (`data/seed_foodsume.json`, que con sus hojas y rúbricas viajaba en el código del panel); todo
 * sale de la API de la sala. Los nombres cortos de los criterios son los de `web/shared/criterios.ts`.
 */
export interface CriterioSala {
  id: CriterioId
  /** Nombre completo de la sala (el de la rúbrica); mientras no llega, el corto. */
  nombre: string
  corto: string
  pregunta?: string
}
export interface ItemSala {
  id: string
  nombre: string
}
export interface ContenidoSala {
  criterios: CriterioSala[]
  proyectosVivos: ItemSala[]
  perfiles: ItemSala[]
}

/** Los 6 criterios del motor, en su orden, con el nombre corto: lo que se sabe sin preguntarle nada a la API. */
export const CRITERIOS_BASE: CriterioSala[] = (Object.keys(NOMBRE_CORTO) as CriterioId[]).map((id) => ({ id, nombre: NOMBRE_CORTO[id], corto: NOMBRE_CORTO[id] }))

export const CONTENIDO_VACIO: ContenidoSala = { criterios: CRITERIOS_BASE, proyectosVivos: [], perfiles: [] }

const criterioDe = (c: { id: string; nombre: string; pregunta?: string }): CriterioSala => ({
  id: c.id as CriterioId,
  nombre: c.nombre,
  corto: nombreCortoCriterio(c.id, c.nombre),
  pregunta: c.pregunta,
})

/** Lo que trae el detalle de la sala: `perfiles` siempre; `criterios` y `proyectos_vivos` si el servidor los manda. */
export function contenidoDe(d: Pick<SalaDetalle, 'criterios' | 'proyectos_vivos' | 'perfiles'> | null | undefined, extra: Partial<ContenidoSala> = {}): ContenidoSala {
  return {
    criterios: d?.criterios?.length ? d.criterios.map(criterioDe) : (extra.criterios ?? CRITERIOS_BASE),
    proyectosVivos: d?.proyectos_vivos?.length ? d.proyectos_vivos.map((p) => ({ id: p.id, nombre: p.nombre })) : (extra.proyectosVivos ?? []),
    perfiles: d?.perfiles?.length ? d.perfiles : (extra.perfiles ?? []),
  }
}

/** Lecturas de respaldo por sala (rúbricas y hojas), una sola vez por sala mientras la pestaña siga abierta. */
const respaldo = new Map<string, Promise<Partial<ContenidoSala>>>()

function leerRespaldo(salaId: string): Promise<Partial<ContenidoSala>> {
  const enCurso = respaldo.get(salaId)
  if (enCurso) return enCurso
  const p = Promise.all([api.get<RubricasSala>(`/api/admin/salas/${salaId}/rubricas`), api.get<HojasSala>(`/api/admin/salas/${salaId}/hojas`)]).then(([r, h]) => {
    // Las hojas vienen en el orden del catálogo de perfiles y, dentro de cada perfil, en el del proyecto.
    const vivos = new Map<string, string>()
    for (const x of lista<HojasSala['hojas'][number]>(h, 'hojas')) if (!vivos.has(x.proyecto_id)) vivos.set(x.proyecto_id, x.proyecto)
    return { criterios: (r?.criterios ?? []).map(criterioDe), proyectosVivos: [...vivos].map(([id, nombre]) => ({ id, nombre })) }
  })
  respaldo.set(salaId, p)
  // Si falla, se vuelve a intentar en la próxima lectura (no se guarda el error).
  p.catch(() => respaldo.delete(salaId))
  return p
}

/**
 * Contenido de la sala para las pantallas. Si el detalle no trae criterios o proyectos vivos, los toma de las rúbricas
 * y las hojas de la sala (mismas rutas de la API que usa Configuración y Hojas).
 */
export function useContenidoSala(d: SalaDetalle | null | undefined): ContenidoSala {
  const salaId = d?.sala.id
  const completo = Boolean(d?.criterios?.length && d?.proyectos_vivos?.length)
  const [extra, setExtra] = useState<{ salaId: string; datos: Partial<ContenidoSala> } | null>(null)
  useEffect(() => {
    if (!salaId || completo) return
    let vigente = true
    leerRespaldo(salaId)
      .then((datos) => vigente && setExtra({ salaId, datos }))
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [salaId, completo])
  const datosExtra = extra && extra.salaId === salaId ? extra.datos : undefined
  return useMemo(() => contenidoDe(d, datosExtra), [d?.criterios, d?.proyectos_vivos, d?.perfiles, datosExtra])
}

export const nombreProyecto = (c: Pick<ContenidoSala, 'proyectosVivos'>, id: string) => c.proyectosVivos.find((p) => p.id === id)?.nombre ?? id
export const nombrePerfil = (c: Pick<ContenidoSala, 'perfiles'>, id: string) => c.perfiles.find((p) => p.id === id)?.nombre ?? id
export const nombreCriterio = (c: Pick<ContenidoSala, 'criterios'>, id: string) => c.criterios.find((x) => x.id === id)?.nombre ?? nombreCortoCriterio(id)

/** Orden de las preguntas en modo guiado (C19-5): los proyectos vivos y, en cada uno, los 6 criterios. */
export const ordenPreguntas = (c: Pick<ContenidoSala, 'criterios' | 'proyectosVivos'>): PreguntaGuiada[] =>
  c.proyectosVivos.flatMap((p) => c.criterios.map((x) => ({ proyecto_id: p.id, criterio_id: x.id })))

/** QA-A-08: número de la pregunta dentro de su proyecto, como el tablero: «Pregunta 3 de 6». */
export function numeroPregunta(p: { proyecto_id?: string; criterio_id: string }, criterios: CriterioSala[] = CRITERIOS_BASE): { n: number; de: number; texto: string } {
  const n = criterios.findIndex((c) => c.id === p.criterio_id) + 1
  return { n, de: criterios.length, texto: `Pregunta ${n} de ${criterios.length}` }
}
