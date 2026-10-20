// Lo que se ve al compartir el enlace de la landing (Open Graph y X): imagen de 1200x630 que existe en web/public,
// URL y textos coherentes entre sí y con la landing (QA por roles del 20-oct, Paula y Sebastián).
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const html = readFileSync('web/index.html', 'utf8')

function meta(atributo: 'property' | 'name', clave: string): string {
  const m = new RegExp(`<meta ${atributo}="${clave.replace(/[.:]/g, '\\$&')}" content="([^"]*)" />`).exec(html)
  if (!m) throw new Error(`Falta <meta ${atributo}="${clave}">`)
  return m[1]
}

/** Ancho y alto de un PNG, leídos del bloque IHDR. */
function medidasPng(ruta: string) {
  const b = readFileSync(ruta)
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR')
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), peso: b.length }
}

describe('compartir el enlace de la landing', () => {
  it('og:image y twitter:image apuntan a la imagen de 1200x630 que está en web/public', () => {
    const imagen = meta('property', 'og:image')
    expect(meta('name', 'twitter:image')).toBe(imagen)
    const url = new URL(imagen)
    expect(url.protocol).toBe('https:')
    const { ancho, alto, peso } = medidasPng(`web/public${url.pathname}`)
    expect({ ancho, alto }).toEqual({ ancho: 1200, alto: 630 })
    expect(meta('property', 'og:image:width')).toBe('1200')
    expect(meta('property', 'og:image:height')).toBe('630')
    expect(meta('property', 'og:image:type')).toBe('image/png')
    // Las redes rechazan imágenes pesadas (X: 5 MB); esta debe ser liviana.
    expect(peso).toBeLessThan(300 * 1024)
  })

  it('tarjeta grande en X y la misma URL de la landing que la imagen', () => {
    expect(meta('name', 'twitter:card')).toBe('summary_large_image')
    const url = meta('property', 'og:url')
    expect(new URL(url).pathname).toBe('/')
    expect(new URL(meta('property', 'og:image')).origin).toBe(new URL(url).origin)
  })

  it('títulos y descripciones coherentes: Horizontes es la herramienta, sin rayas', () => {
    expect(meta('name', 'description')).toMatch(/^Horizontes es la herramienta de Estratek para priorizar el portafolio por horizontes\./)
    expect(meta('name', 'twitter:title')).toBe(meta('property', 'og:title'))
    expect(meta('name', 'twitter:description')).toBe(meta('property', 'og:description'))
    expect(meta('name', 'description')).toContain(meta('property', 'og:description').replace(/^Cada mesa/, 'cada mesa'))
    expect(meta('property', 'og:title')).toContain('Horizontes por Estratek')
    expect(meta('property', 'og:image:alt')).toBe(meta('name', 'twitter:image:alt'))
    expect(html).not.toMatch(/[—–]/)
    expect(html).not.toMatch(/es el taller de priorización/)
  })

  it('la página no se marca como no indexable: eso lo decide el servidor por ruta', () => {
    expect(html).not.toMatch(/name="robots"/)
  })
})
