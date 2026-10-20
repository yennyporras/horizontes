// Entrada pública del tablero para otras áreas (vista en vivo y resultados del celular).
export { MatrizHorizontes } from './MatrizHorizontes'
export type { MatrizHorizontesProps } from './MatrizHorizontes'
export type { DatosTablero, Vista } from './tipos'
export { esPreliminar, insigniaResultado, mensajeVacio, vistaPorDefecto } from './logica'
export { ComoVoto } from './ComoVoto'
export type { DatosComoVoto } from './ComoVoto'
// «Descargar matriz» del panel: el SVG de la matriz como texto, con los colores ya resueltos.
export { svgMatriz } from './exportar'
export type { OpcionesDescarga } from './exportar'
