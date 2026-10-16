import { createHash, randomBytes, randomInt } from 'node:crypto'

/** Reloj inyectable (milisegundos epoch). Las pruebas lo reemplazan para simular la hora. */
export type Reloj = () => number

export const sha256 = (texto: string) => createHash('sha256').update(texto, 'utf8').digest('hex')
export const tokenAleatorio = () => randomBytes(24).toString('base64url')

const ALFABETO = 'abcdefghijkmnpqrstuvwxyz23456789'
const ALFABETO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function idAleatorio(prefijo: string, largo = 8): string {
  let s = ''
  for (let i = 0; i < largo; i++) s += ALFABETO[randomInt(ALFABETO.length)]
  return `${prefijo}_${s}`
}

/** Código corto de sala: HZ + 3 caracteres sin ambigüedad (sin 0/O, 1/I/L). */
export function codigoSala(): string {
  let s = 'HZ'
  for (let i = 0; i < 3; i++) s += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  return s
}

/** Se guarda en UTC ISO (comparable como texto). */
export const isoUtc = (ms: number) => new Date(ms).toISOString()

/** Salida en hora de Bogotá (UTC-5 todo el año, sin horario de verano). */
export function isoBogota(valor: string | number | null | undefined): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  const ms = typeof valor === 'number' ? valor : Date.parse(valor)
  if (Number.isNaN(ms)) return null
  const d = new Date(ms - 5 * 3600_000)
  return d.toISOString().replace(/\.\d{3}Z$/, '-05:00')
}
