// Descarga de la matriz (QA por roles, empresa cliente: «Descargar la matriz» desde el panel). El panel llama a
// `svgMatriz` con la respuesta de GET /api/tablero y ofrece el texto como archivo .svg.
import { matrizSVG } from './matriz/matriz.js'
import type { DatosTablero, Vista } from './tipos'

export interface OpcionesDescarga {
  vista?: Vista
  ancho?: number
  alto?: number
  /**
   * Dónde leer el valor de los tokens `--hz-*` (por defecto, el elemento raíz de la página, que lleva el tema claro).
   * Fuera de la página un SVG no tiene esos tokens: se escriben sus valores para que el archivo se vea igual.
   */
  tokens?: (nombre: string) => string
}

/** Lector de tokens de la página: el valor calculado de `--hz-*` en <html>, o '' si no hay documento. */
function tokensDeLaPagina(): (nombre: string) => string {
  if (typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return () => ''
  const estilo = getComputedStyle(document.documentElement)
  return (nombre) => estilo.getPropertyValue(nombre).trim()
}

/**
 * La matriz como texto SVG independiente: con fondo, sin animaciones y con los colores de los tokens ya resueltos
 * (un token sin valor queda como `var()`). Letra de proyector, legible al imprimirla o pegarla en un informe.
 */
export function svgMatriz(datos: DatosTablero, opciones: OpcionesDescarga = {}): string {
  const { vista = 'comparacion', ancho = 1600, alto = 1600 } = opciones
  const leer = opciones.tokens ?? tokensDeLaPagina()
  const svg = matrizSVG(datos, { ancho, alto, vista, escalaTexto: 1.45, letraMin: 24, fondo: true, idPrefijo: 'hz-matriz' })
  return svg.replace(/var\((--hz-[a-z0-9-]+)\)/gi, (todo, nombre: string) => leer(nombre) || todo)
}
