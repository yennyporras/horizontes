// Textos del mínimo de votos y del ensayo que comparten el tablero, el celular y el panel (21-oct, pedido de Paola: con
// 1 persona, «Hacen falta al menos 3 votos» más 24 celdas «Faltan votos» se leían como un error de conteo).
// El mínimo y la frecuencia de la foto los manda el servidor (`minimo_votos`, `votos_por_actualizacion`); aquí no se fijan.
// Desde el 21-oct (decisión de Paola: «cada voto en todas siempre en anonimato») los dos son 1 en todas las salas.

/**
 * Votos que renuevan el resultado en vivo en todas las salas desde el 21-oct: con cada voto. Solo para los textos del
 * panel que no tienen a mano la respuesta del tablero; donde llega `votos_por_actualizacion`, manda ese.
 */
export const VOTOS_POR_FOTO = 1

const votos = (n: number) => `${n} ${n === 1 ? 'voto' : 'votos'}`

/**
 * Un solo mensaje por bloque, con el conteo real: «Hay 1 voto de los 3 que hacen falta para mostrar el resultado. Así
 * nadie puede deducir cómo votó otra persona.» Sin votos: «Todavía no hay votos: hacen falta 3 …».
 */
export function mensajeFaltanVotos(nVotos: number, minimo: number): string {
  const hacenFalta = minimo === 1 ? 'el voto que hace falta' : `los ${minimo} que hacen falta`
  const cuantos = nVotos > 0 ? `Hay ${votos(nVotos)} de ${hacenFalta}` : `Todavía no hay votos: ${minimo === 1 ? 'hace falta 1' : `hacen falta ${minimo}`}`
  return `${cuantos} para mostrar el resultado. Así nadie puede deducir cómo votó otra persona.`
}

/**
 * Aviso visible en una sala de ensayo (`ensayo: true`). Desde el 21-oct todas las salas muestran desde 1 voto, así que
 * el aviso ya no habla del mínimo: dice lo que de verdad distingue un ensayo.
 */
export const AVISO_ENSAYO = 'Sala de ensayo: no cuenta en las cifras de talleres.'

/** «En vivo: se actualiza cada 3 votos» o, con fotos de 1 en 1 (ensayo), «En vivo: se actualiza con cada voto». */
export function textoEnVivo(porFoto: number): string {
  return porFoto === 1 ? 'En vivo: se actualiza con cada voto' : `En vivo: se actualiza cada ${porFoto} votos`
}

/** Frase de renovación para textos de ayuda: «cada 3 votos nuevos» o «con cada voto nuevo». */
export function cadaCuantos(porFoto: number): string {
  return porFoto === 1 ? 'con cada voto nuevo' : `cada ${porFoto} votos nuevos`
}

/** Mayor `n_votos` de las rondas dadas (las que están bajo el mínimo en un bloque). */
export function maxVotos(rondas: ({ n_votos?: number | null } | null | undefined)[]): number {
  return rondas.reduce<number>((m, r) => Math.max(m, r?.n_votos ?? 0), 0)
}
