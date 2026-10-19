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

/** Marca el mismo valor en las 6 rúbricas (o en las indicadas). */
export async function calificar(p: Page, valor: number, criterios = [0, 1, 2, 3, 4, 5]) {
  const grupos = p.locator('fieldset.hz-rubrica')
  for (const i of criterios) await grupos.nth(i).locator('label.hz-opcion', { has: p.locator(`input[value="${valor}"]`) }).click()
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

/** Foco visible: recorre con Tab y cada elemento enfocado (o su opción de rúbrica) muestra el anillo de --hz-foco (cielo). */
export async function focoVisible(p: Page, pasos: number) {
  await p.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let i = 0; i < pasos; i++) {
    await p.keyboard.press('Tab')
    const r = await p.evaluate(() => {
      const a = document.activeElement as HTMLElement | null
      if (!a || a === document.body) return null
      const anillo = a.matches('.hz-opcion__input') ? a.closest('.hz-opcion')! : a
      const st = getComputedStyle(anillo)
      return { el: `${a.tagName} ${a.textContent?.trim().slice(0, 20) ?? ''}`, ok: st.boxShadow.includes('rgb(0, 163, 255)') || (st.outlineStyle !== 'none' && st.outlineColor !== 'rgba(0, 0, 0, 0)') }
    })
    if (r) expect(r.ok, `sin foco visible: ${r.el}`).toBe(true)
  }
}
