// Ancho de página estándar (familia Estratek §5, 20-oct): en el celular y en la landing, encabezado, contenido y pie
// comparten los mismos bordes izquierdo y derecho, los del panel (1280 px con margen de 16, 24 o 32 px).
// Composición común (21-oct): la barra mide 64 px bajo 1024 px y 72 px desde ahí en todas las vistas, y en el celular
// la columna de lectura (contexto, contenido y barra de acción) va centrada dentro del contenedor, de 640 px como máximo.
// Se mide en navegador real con getBoundingClientRect a 320, 360, 390, 768, 1024, 1280, 1440 y 1920 px.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Page } from 'playwright-core'
import { REINTENTOS_E2E, sinNavegador } from '../../../tests/navegador'
import { capturar } from './ayudas'
import { accion, crearSala, hayChromium, iniciar, type Entorno } from './entorno'

const conNavegador = hayChromium()
if (!conNavegador) sinNavegador('[e2e ancho]', 'No hay Chromium de Playwright para medir el ancho de página.')

const ANCHOS = [320, 360, 390, 768, 1024, 1280, 1440, 1920]
const ANCHO_PAGINA = 1280
const ANCHO_LECTURA = 640
const margen = (w: number) => (w >= 1280 ? 32 : w >= 768 ? 24 : 16)
const altoBarra = (w: number) => (w >= 1024 ? 72 : 64)

/** Bordes del contenido (sin el margen interior) de cada franja. */
function bordes(p: Page, selectores: string[]) {
  return p.evaluate((sels) => {
    return sels.map((s) => {
      const el = document.querySelector(s)
      if (!el) return { s, izq: NaN, der: NaN }
      const r = el.getBoundingClientRect()
      const st = getComputedStyle(el)
      return { s, izq: Math.round(r.left + parseFloat(st.paddingLeft)), der: Math.round(r.right - parseFloat(st.paddingRight)) }
    })
  }, selectores)
}

/** Bordes del contenido de las franjas: centradas en una caja de `maximo` px (más el margen) dentro de la ventana. */
async function revisar(p: Page, selectores: string[], ancho: number, maximo = ANCHO_PAGINA) {
  const medidas = await bordes(p, selectores)
  const caja = Math.min(ancho, maximo + (maximo === ANCHO_PAGINA ? 0 : 2 * margen(ancho)))
  const izq = Math.round((ancho - caja) / 2 + margen(ancho))
  const der = Math.round(ancho - (ancho - caja) / 2 - margen(ancho))
  for (const m of medidas) {
    expect(m.izq, `${m.s} a ${ancho} px: borde izquierdo`).toBe(izq)
    expect(m.der, `${m.s} a ${ancho} px: borde derecho`).toBe(der)
  }
  expect(await p.evaluate(() => document.documentElement.scrollWidth), `sin desborde a ${ancho} px`).toBeLessThanOrEqual(ancho)
  const barra = await p.evaluate(() => Math.round(document.querySelector('.hz-producto')!.getBoundingClientRect().height))
  expect(barra, `alto de la barra a ${ancho} px`).toBe(altoBarra(ancho))
}

describe.skipIf(!conNavegador)('ancho de página estándar en navegador', { retry: REINTENTOS_E2E }, () => {
  let e: Entorno
  beforeAll(async () => {
    e = await iniciar()
  }, 120_000)
  afterAll(async () => {
    await e?.cerrar()
  }, 30_000)

  it('celular: encabezado, contexto, contenido y barra inferior con los mismos bordes', async () => {
    const sala = await crearSala(e, 'Ancho e2e celular', 1)
    await accion(e, sala.id, 'abrir_inscripcion')
    const ctx = await e.browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'es-CO' })
    const p = await ctx.newPage()
    await p.goto(`${e.web}/m/${sala.mesas[0].codigo}`)
    await p.getByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes', level: 1 }).waitFor({ timeout: 60_000 })
    for (const ancho of ANCHOS) {
      await p.setViewportSize({ width: ancho, height: 900 })
      await p.waitForTimeout(100)
      await revisar(p, ['.hz-producto__fila', 'footer.hz-pie > .hz-pagina'], ancho)
      await revisar(p, ['.hzp-contexto', 'main.hz-contenido', '.hz-barra-accion__interior'], ancho, ANCHO_LECTURA)
      await capturar(p, `ancho-celular-${ancho}`)
    }
    await ctx.close()
  }, 120_000)

  it('landing: encabezado, héroe, secciones y pie con los mismos bordes', async () => {
    const ctx = await e.browser.newContext({ viewport: { width: 360, height: 800 }, locale: 'es-CO' })
    const p = await ctx.newPage()
    await p.goto(`${e.web}/`)
    await p.getByRole('heading', { name: 'La mesa mueve el portafolio', level: 1 }).waitFor({ timeout: 60_000 })
    for (const ancho of ANCHOS) {
      await p.setViewportSize({ width: ancho, height: 900 })
      await p.waitForTimeout(100)
      await capturar(p, `ancho-landing-${ancho}`)
      await revisar(p, ['.hz-producto__fila', '#inicio', '#entrar > .hz-pagina', '#como-funciona > .hz-pagina', '#privacidad > .hz-pagina', 'footer.hz-pie > .hz-pagina'], ancho)
    }
    await ctx.close()
  }, 120_000)
})
