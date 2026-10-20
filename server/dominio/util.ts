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

/** Caracteres al azar sin ambigüedad (sin 0/O, 1/I/L). */
export function textoCodigo(largo: number): string {
  let s = ''
  for (let i = 0; i < largo; i++) s += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  return s
}

/** Código corto de sala: HZ + 3 caracteres sin ambigüedad. */
export const codigoSala = (): string => `HZ${textoCodigo(3)}`

/** Caracteres al azar del código de mesa: 31^5 (unos 28,6 millones) combinaciones por número de mesa (M-1c). */
export const LARGO_AZAR_MESA = 5

/**
 * Código de mesa: el de la sala, 5 caracteres al azar y el número de la mesa (HZ7K2QX4AB-1). Antes del 20-oct era solo
 * `{sala}-{n}` y se adivinaba con el de la sala (S-5); el mismo 20-oct llevó 3 al azar (HZ7K2QX4-1) y la auditoría de
 * seguridad lo subió a 5 (M-1c). Las mesas que ya existen conservan su código. La forma sigue siendo
 * `[A-Z0-9]+-número`, la que acepta la entrada por código de la landing.
 */
export const codigoMesa = (codigoDeSala: string, numero: number): string => `${codigoDeSala}${textoCodigo(LARGO_AZAR_MESA)}-${numero}`

/** Se guarda en UTC ISO (comparable como texto). */
export const isoUtc = (ms: number) => new Date(ms).toISOString()

export const PAISES = ['CO', 'PE', 'GT'] as const
export type Pais = (typeof PAISES)[number]

/** Desfase fijo en horas: ninguno de los tres países usa horario de verano. */
export const DESFASES = { 'America/Bogota': -5, 'America/Lima': -5, 'America/Guatemala': -6 } as const
export type ZonaHoraria = keyof typeof DESFASES

export const ZONA_POR_PAIS: Record<Pais, ZonaHoraria> = { CO: 'America/Bogota', PE: 'America/Lima', GT: 'America/Guatemala' }

/** Salida en la hora de la zona de la sala (por defecto Bogotá), con su desfase: 2026-10-19T09:00:00-05:00. */
export function isoEnZona(valor: string | number | null | undefined, zona: ZonaHoraria = 'America/Bogota'): string | null {
  if (valor === null || valor === undefined || valor === '') return null
  const ms = typeof valor === 'number' ? valor : Date.parse(valor)
  if (Number.isNaN(ms)) return null
  const h = DESFASES[zona]
  const d = new Date(ms + h * 3600_000)
  return d.toISOString().replace(/\.\d{3}Z$/, `-${String(-h).padStart(2, '0')}:00`)
}
