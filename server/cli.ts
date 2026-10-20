// Utilidades de los scripts de línea de comandos del servidor (seed, reinicio limpio).

/** Valor de `--nombre valor` en los argumentos del proceso, o undefined. */
export function argumento(nombre: string, argv: string[] = process.argv): string | undefined {
  const i = argv.indexOf(`--${nombre}`)
  return i >= 0 ? argv[i + 1] : undefined
}
