// Ayudas compartidas de los recorridos e2e del participante (360 px y perfiles móviles).
import { expect } from 'vitest'
import type { Page } from 'playwright-core'

export const ESPERA = 15_000

/** Espera un texto visible (string exacto o expresión). */
export async function ver(p: Page, texto: string | RegExp, timeout = ESPERA) {
  await p.getByText(texto).first().waitFor({ state: 'visible', timeout })
}

export async function titulo(p: Page, nombre: string | RegExp, timeout = ESPERA) {
  await p.getByRole('heading', { name: nombre, level: 1 }).waitFor({ state: 'visible', timeout })
}

/**
 * Responde con el mismo valor las 6 preguntas (o las indicadas, de 0 a 5). Una pregunta por pantalla (C19-5):
 * desde el resumen entra por el botón de esa pregunta; al elegir, la pantalla pasa sola a la siguiente.
 */
export async function calificar(p: Page, valor: number, criterios = [0, 1, 2, 3, 4, 5]) {
  for (const i of criterios) {
    const pregunta = p.locator(`section.hzp-pregunta[data-paso="${i}"]`)
    await p.locator('section.hzp-pregunta, .hzp-resumen').first().waitFor()
    if ((await pregunta.count()) === 0) await p.locator('.hzp-resumen__fila').nth(i).getByRole('button').click()
    await pregunta.locator('label.hz-opcion', { has: p.locator(`input[value="${valor}"]`) }).click()
    await pregunta.waitFor({ state: 'detached' })
  }
}

/** Color calculado de un token de web/shared/ui/tokens.css (p. ej. --hz-r1), como lo pinta el navegador. */
export async function colorToken(p: Page, token: string): Promise<string> {
  return p.evaluate((t) => {
    const el = document.createElement('span')
    el.style.color = `var(${t})`
    document.body.append(el)
    const c = getComputedStyle(el).color
    el.remove()
    return c
  }, token)
}

/** Contraste WCAG entre dos colores rgb() opacos. */
export function contraste(a: string, b: string): number {
  const lum = (c: string) => {
    const [r, g, bl] = (c.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((x) => {
      const v = Number(x) / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

/** Primer fondo opaco del elemento o de sus contenedores (el que se ve detrás). */
async function fondoDe(p: Page, sel: string): Promise<string> {
  return p.locator(sel).first().evaluate((el) => {
    for (let n: Element | null = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor
      if (c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') return c
    }
    return 'rgb(255, 255, 255)'
  })
}

/** Con HZ_CAPTURAS=carpeta guarda capturas de página completa para revisión visual. */
export async function capturar(p: Page, nombre: string) {
  const dir = process.env.HZ_CAPTURAS
  if (dir) await p.screenshot({ path: `${dir}/${nombre}.png`, fullPage: true })
}

/** Sin desborde horizontal: nada más ancho que la pantalla (360 px por omisión). */
export async function sinDesborde(p: Page, ancho = p.viewportSize()?.width ?? 360) {
  const real = await p.evaluate(() => document.documentElement.scrollWidth)
  expect(real).toBeLessThanOrEqual(ancho)
}

/**
 * Objetivos táctiles de 44 px o más: botones, pestañas, opciones de rúbrica y la casilla.
 * Los enlaces dentro de un párrafo quedan exentos (WCAG 2.5.8, excepción en línea).
 */
export async function tactiles(p: Page) {
  const chicos = await p.evaluate(() => {
    const sel = 'button, [role="tab"], .hz-opcion, .hz-casilla__toque, a:not(p a):not(label a):not(li a):not(dd a)'
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .filter((el) => el.offsetParent !== null && !el.closest('.hz-visual-oculto'))
      .map((el) => ({ el: `${el.tagName}.${el.className} "${el.textContent?.trim().slice(0, 30)}"`, r: el.getBoundingClientRect() }))
      .filter(({ r }) => r.height < 44 || r.width < 44)
      .map(({ el, r }) => `${el} ${Math.round(r.width)}×${Math.round(r.height)}`)
  })
  expect(chicos).toEqual([])
}

/**
 * Foco visible: recorre con Tab y cada elemento enfocado (o su opción de rúbrica) muestra el anillo de --hz-foco
 * (color --hz-acento, leído del navegador) o un contorno. El anillo tiene 3:1 o más sobre el fondo de la página.
 */
export async function focoVisible(p: Page, pasos: number) {
  const anilloColor = await colorToken(p, '--hz-acento')
  expect(contraste(anilloColor, await fondoDe(p, 'main')), 'contraste del anillo de foco').toBeGreaterThanOrEqual(3)
  await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let i = 0; i < pasos; i++) {
    await p.keyboard.press('Tab')
    const r = await p.evaluate((color) => {
      const a = document.activeElement as HTMLElement | null
      if (!a || a === document.body) return null
      const anillo = a.matches('.hz-opcion__input') ? a.closest('.hz-opcion')! : a
      const st = getComputedStyle(anillo)
      return { el: `${a.tagName} ${a.textContent?.trim().slice(0, 20) ?? ''}`, ok: st.boxShadow.includes(color) || (st.outlineStyle !== 'none' && st.outlineColor !== 'rgba(0, 0, 0, 0)') }
    }, anilloColor)
    if (r) expect(r.ok, `sin foco visible: ${r.el}`).toBe(true)
  }
}

/**
 * Tabla del resultado (acta A3, A4 y P3): solo los 6 criterios, sin fila Total (preentrega 19-oct), ejes, T2M ni
 * votos; promedios con 2 decimales iguales a los que entrega la API (el celular no calcula) y, si votaste, tu
 * calificación debajo; encabezados R1 hueco y R2 sólido con los colores de los tokens.
 */
export async function revisarTabla(p: Page, codigo: string) {
  const tabla = p.locator('.hzp-tabla').first()
  await tabla.waitFor()
  const filas = await tabla.locator('tbody th').allTextContents()
  expect(filas).toHaveLength(6)
  expect(await p.locator('.hzp-resultado').getByText('Total', { exact: true }).count()).toBe(0)
  expect(await p.locator('.hzp-tabla__total').count()).toBe(0)
  for (const t of await p.locator('.hzp-resultado__proyecto').allTextContents()) expect(t).not.toMatch(/Total|Eje X|Eje Y|Time 2 Market|T2M|calificaciones en/i)
  // Cada promedio con 2 decimales; debajo, si votaste, tu calificación (C19-3, P3), nunca la de otra persona.
  const celdas = tabla.locator('tbody td')
  expect(await celdas.locator('.hzp-tabla__promedio').count()).toBe(await celdas.count())
  for (const mia of await tabla.locator('.hzp-tabla__mia').allTextContents()) expect(mia).toMatch(/^Tu calificación: Tú [13579]$/)
  // Promedios del primer proyecto mostrado = `promedios` de la API por criterio y ronda visible, con 2 decimales.
  const nombre = (await tabla.locator('xpath=ancestor::article[1]').locator('h3').textContent())?.trim() ?? ''
  const esperado = await p.evaluate(
    async ({ c, nombre }) => {
      const r = await fetch('/api/yo', { headers: { 'X-Participante-Token': localStorage.getItem(`hz_token:${c.toUpperCase()}`) ?? '' } })
      type Ronda = { ronda: number; n_votos: number; bajo_minimo?: boolean; promedios: Record<string, number> | null }
      const yo = (await r.json()) as { criterios: { id: string }[]; resultados: { minimo_votos?: number; proyectos_vivos: { nombre: string; rondas: Ronda[] }[] } }
      const min = yo.resultados.minimo_votos ?? 3
      const rondas = (yo.resultados.proyectos_vivos.find((v) => v.nombre === nombre)?.rondas ?? [])
        .filter((x) => x.promedios && !x.bajo_minimo && x.n_votos >= min)
        .sort((a, b) => a.ronda - b.ronda)
      return yo.criterios.flatMap((cr) => rondas.map((x) => (Math.round(x.promedios![cr.id] * 100) / 100).toFixed(2).replace('.', ',')))
    },
    { c: codigo, nombre },
  )
  expect(esperado.length).toBeGreaterThan(0)
  expect(await celdas.locator('.hzp-tabla__promedio').allTextContents()).toEqual(esperado)
  // R1 hueco (texto del color de la ronda) y R2 sólido (relleno de la ronda): los colores salen de los tokens del
  // navegador (--hz-r1, --hz-r2) y cada par pasa AA (4,5:1) sobre lo que tiene detrás.
  const estilo = (sel: string) => p.locator(sel).first().evaluate((el) => [getComputedStyle(el).color, getComputedStyle(el).backgroundColor])
  const r1 = '.hzp-tabla .hz-insignia--r1'
  const [r1Texto] = await estilo(r1)
  expect(r1Texto).toBe(await colorToken(p, '--hz-r1'))
  expect(contraste(r1Texto, await fondoDe(p, r1)), 'R1 sobre su fondo').toBeGreaterThanOrEqual(4.5)
  if (await p.locator('.hzp-tabla .hz-insignia--r2').count()) {
    const [r2Texto, r2Fondo] = await estilo('.hzp-tabla .hz-insignia--r2')
    expect(r2Fondo).toBe(await colorToken(p, '--hz-r2'))
    expect(contraste(r2Texto, r2Fondo), 'texto sobre R2').toBeGreaterThanOrEqual(4.5)
  }
}
