// Contraste WCAG 2.2 de los pares de docs/marca/FAMILIA_ESTRATEK.md §3 y §7, medido en los dos temas de tokens.css.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const css = readFileSync(join(__dirname, '..', 'tokens.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

/** Declaraciones del bloque cuyo selector es exactamente `selector`. */
function bloque(selector: string): Record<string, string> {
  const inicio = css.indexOf(`${selector} {`)
  if (inicio < 0) throw new Error(`Falta el bloque ${selector} en tokens.css`)
  const cuerpo = css.slice(css.indexOf('{', inicio) + 1, css.indexOf('}', inicio))
  return Object.fromEntries([...cuerpo.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const base = bloque(':root')
const derivados = bloque(':root, [data-tema]')
const TEMAS = { claro: bloque(':root, [data-tema="claro"]'), carbon: bloque('[data-tema="carbon"]') }
type Tema = keyof typeof TEMAS

/** Valor hex de un token en un tema, siguiendo los alias var(--…). */
function hex(tema: Tema, nombre: string): string {
  const n = nombre.startsWith('--') ? nombre : `--hz-${nombre}`
  const v = TEMAS[tema][n] ?? derivados[n] ?? base[n]
  if (!v) throw new Error(`${n} no existe en el tema ${tema}`)
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(v)
  if (alias) return hex(tema, alias[1])
  if (!/^#[0-9A-Fa-f]{6}$/.test(v)) throw new Error(`${n} no es un color hex: ${v}`)
  return v.toUpperCase()
}

const canal = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16)
function luminancia(h: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = canal(h, i) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contraste(a: string, b: string) {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}
/** Mezcla sRGB de `color` al `p` (0..1) sobre `fondo`, como color-mix(in srgb, color p, transparent) pintado encima. */
function mezcla(color: string, p: number, fondo: string) {
  const c = [1, 3, 5].map((i) => Math.round(canal(color, i) * p + canal(fondo, i) * (1 - p)))
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

const AA = 4.5
const GRAFICO = 3

describe.each(['claro', 'carbon'] as Tema[])('tema %s', (tema) => {
  const c = (a: string, b: string) => contraste(hex(tema, a), hex(tema, b))

  it('tinta, tinta 2 y tinta 3 cumplen AA sobre el fondo y las tres superficies', () => {
    for (const t of ['tinta', 'tinta-2', 'tinta-3'])
      for (const f of ['fondo', 'superficie-1', 'superficie-2', 'superficie-3']) expect(c(t, f), `${t} sobre ${f}`).toBeGreaterThanOrEqual(AA)
  })

  it('la acción cumple AA como texto sobre el fondo y la superficie 1, y con su texto encima', () => {
    for (const f of ['fondo', 'superficie-1']) expect(c('accion', f), `acción sobre ${f}`).toBeGreaterThanOrEqual(AA)
    expect(c('sobre-accion', 'accion')).toBeGreaterThanOrEqual(AA)
    expect(c('accion', 'info-fondo')).toBeGreaterThanOrEqual(AA)
    // Opción elegida de la rúbrica: cifra en acción sobre el tinte al 10 % pintado en el fondo.
    expect(contraste(hex(tema, 'accion'), mezcla(hex(tema, 'accion'), 0.1, hex(tema, 'fondo')))).toBeGreaterThanOrEqual(AA)
  })

  it('foco y borde de control llegan a 3:1 (WCAG 1.4.11)', () => {
    for (const f of ['fondo', 'superficie-1', 'superficie-2']) {
      expect(c('foco-color', f), `foco sobre ${f}`).toBeGreaterThanOrEqual(GRAFICO)
      expect(c('borde-control', f), `borde de control sobre ${f}`).toBeGreaterThanOrEqual(GRAFICO)
    }
  })

  it('cada estado cumple AA sobre su fondo y la tinta también', () => {
    for (const e of ['ok', 'alerta', 'error']) {
      expect(c(e, `${e}-fondo`), e).toBeGreaterThanOrEqual(AA)
      expect(c('tinta', `${e}-fondo`), `tinta sobre ${e}-fondo`).toBeGreaterThanOrEqual(AA)
    }
    expect(c('deshabilitado-texto', 'deshabilitado-fondo')).toBeGreaterThanOrEqual(AA)
  })

  it('el acento de Horizontes como texto cumple AA sobre el fondo y la superficie 1', () => {
    for (const f of ['fondo', 'superficie-1']) expect(c('acento-producto-texto', f)).toBeGreaterThanOrEqual(AA)
  })

  it('R1 y R2 cumplen AA como texto sobre el fondo, 3:1 como forma en las superficies y con su texto encima', () => {
    for (const r of ['r1', 'r2']) {
      for (const f of ['fondo', 'superficie-1']) expect(c(r, f), `${r} sobre ${f}`).toBeGreaterThanOrEqual(AA)
      for (const f of ['superficie-2', 'superficie-3']) expect(c(r, f), `${r} sobre ${f}`).toBeGreaterThanOrEqual(GRAFICO)
      expect(c(`sobre-${r}`, r)).toBeGreaterThanOrEqual(AA)
    }
  })
})

describe('valores de la línea gráfica', () => {
  it('los semánticos son los de FAMILIA_ESTRATEK §3 y §7', () => {
    const esperado: Record<Tema, Record<string, string>> = {
      claro: {
        fondo: '#FFFFFF', 'superficie-1': '#F3F8FF', 'superficie-2': '#E8F1FF', 'superficie-3': '#DCECFF', borde: '#C9D9F2',
        'borde-control': '#5A6680', tinta: '#141414', 'tinta-2': '#44506A', 'tinta-3': '#5A6680', accion: '#1A66D6',
        'sobre-accion': '#FFFFFF', 'foco-color': '#1A66D6', ok: '#007A60', 'ok-fondo': '#DDF6EF', alerta: '#8A5A00',
        'alerta-fondo': '#FFF3D6', error: '#BF0029', 'error-fondo': '#FDE7EB', r1: '#1B7F3A', r2: '#C62828', 'sobre-r2': '#FFFFFF',
        'acento-producto': '#00CDA1', 'acento-producto-texto': '#007A60',
      },
      carbon: {
        fondo: '#141414', 'superficie-1': '#1B1D22', 'superficie-2': '#23262D', 'superficie-3': '#2C3038', borde: '#343944',
        'borde-control': '#8A9BB8', tinta: '#DCECFF', 'tinta-2': '#A8B6CF', 'tinta-3': '#8A9BB8', accion: '#3487FF',
        'sobre-accion': '#141414', 'foco-color': '#3487FF', ok: '#00CDA1', 'ok-fondo': '#10332B', alerta: '#FFBB44',
        'alerta-fondo': '#2B2418', error: '#FF6B7F', 'error-fondo': '#3A1620', r1: '#3FB25A', r2: '#F36363', 'sobre-r2': '#141414',
        'acento-producto': '#00CDA1', 'acento-producto-texto': '#00CDA1',
      },
    }
    for (const tema of ['claro', 'carbon'] as Tema[])
      for (const [n, v] of Object.entries(esperado[tema])) expect(hex(tema, n), `${n} en ${tema}`).toBe(v)
  })

  it('los nombres anteriores apuntan a la acción de Estratek', () => {
    for (const tema of ['claro', 'carbon'] as Tema[]) {
      for (const n of ['azul', 'acento', 'cielo']) expect(hex(tema, n)).toBe(hex(tema, 'accion'))
      expect(hex(tema, 'sobre-acento')).toBe(hex(tema, 'sobre-accion'))
    }
    expect(base['--hz-grad-marca']).toBe('var(--et-grad)')
    expect(base['--et-grad']).toBe('linear-gradient(90deg, #442AAF 0%, #3487FF 30%, #00CDA1 100%)')
  })

  it('no quedan el teal ni los azules propios anteriores', () => {
    for (const viejo of ['#47EBC2', '#1C4587', '#00A3FF', '#004782', '#1699DB', '#0E0E0E']) expect(css.toUpperCase()).not.toContain(viejo)
  })
})
