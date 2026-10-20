// Las distribuciones viven en shared/simulacion: las usan el simulador y el modo demo del servidor (la imagen de
// producción no lleva tools/). Este archivo las reexporta para no cambiar los imports del simulador.
export * from '../../shared/simulacion/distribuciones.js'
