import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Voz y tono de Estratek: cero rayas y nada de las palabras que la guía prohíbe, en todo texto de T2.
const PROHIBIDAS = [
  'profundizar',
  'robusto',
  'holístico',
  'sinergia',
  'apasionante',
  'revolucionario',
  'espectacular',
  'ecosistema',
  'transformación digital',
  'best practices',
  'desde nuestra perspectiva',
  'en el marco de',
  'es fundamental',
  'en el mundo de hoy',
  'te invito a',
]

function fuentes(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n)
    if (statSync(r).isDirectory()) return n === '__tests__' || n === 'e2e' ? [] : fuentes(r)
    return /\.(tsx?|css)$/.test(n) ? [r] : []
  })
}

const archivos = [...fuentes('web/participante'), ...fuentes('web/shared/ui')]

describe('voz y tono en los textos de T2', () => {
  it.each(archivos)('%s', (archivo) => {
    const texto = readFileSync(archivo, 'utf8')
    expect(texto).not.toMatch(/[—–]/)
    const bajo = texto.toLowerCase()
    for (const p of PROHIBIDAS) expect(bajo, p).not.toContain(p)
  })
})
