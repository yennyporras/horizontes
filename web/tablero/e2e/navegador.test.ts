// Prueba del tablero en un navegador real (Chromium headless) contra la API real con BD en memoria.
// Corre dentro de tools/test.sh. Si no hay Chromium instalado se omite con un aviso
// (instálalo con `npx playwright-core install chromium-headless-shell` o define PW_EXE).
//
// 1. Sala con la prueba sintética del golden cerrada en R2: los puntos dibujados (leídos del SVG y
//    convertidos con las marcas de los ejes) coinciden con golden y con los 8 fijos, en 1920, 1366 y 360 px.
//    Además: sin desborde horizontal, 1920×1080 sin scroll, vista Comparación automática, letra legible
//    en proyector, contraste AA del texto HTML y tecla F (pantalla completa).
// 2. Sala con R1 abierta: un voto y el cierre de ronda se ven en el tablero en menos de 5 s, con 304
//    mientras no hay cambios y sin reemplazar el nodo del SVG.
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import type { ViteDevServer } from 'vite'
import { CRITERIOS } from '../../../shared/motor/motor'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, votar } from '../../../tests/server/ayuda'

const RAIZ = resolve(__dirname, '../../..')
const golden = JSON.parse(readFileSync(join(RAIZ, 'tests/golden/motor_golden.json'), 'utf8'))
const ps = golden.prueba_sintetica as {
  votos: Record<string, number | string>[]
  esperado: Record<string, Record<string, { eje_x: number; eje_y: number }>>
}
const fijosGolden = golden.casos_proyecto as { nombre: string; esperado: { eje_x: number; eje_y: number } }[]
const ANCHOS: [number, number][] = [
  [1920, 1080],
  [1366, 768],
  [360, 740],
]

/** Chromium para Playwright: PW_EXE o el último instalado en la caché de ms-playwright. */
function buscarChromium(): string | null {
  if (process.env.PW_EXE && existsSync(process.env.PW_EXE)) return process.env.PW_EXE
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(homedir(), 'AppData/Local/ms-playwright'),
    join(homedir(), '.cache/ms-playwright'),
    join(homedir(), 'Library/Caches/ms-playwright'),
  ].filter((d): d is string => !!d && existsSync(d))
  const candidatos = [
    ['chromium_headless_shell-', ['chrome-headless-shell-win64/chrome-headless-shell.exe', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell', 'chrome-linux/headless_shell']],
    ['chromium-', ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux64/chrome', 'chrome-linux/chrome']],
  ] as const
  for (const cache of caches) {
    for (const [prefijo, rutas] of candidatos) {
      const dirs = readdirSync(cache).filter((d) => d.startsWith(prefijo) && /\d$/.test(d)).sort().reverse()
      for (const d of dirs) for (const r of rutas) if (existsSync(join(cache, d, r))) return join(cache, d, r)
    }
  }
  return null
}

/** Chromium que de verdad arranca (en Linux puede estar el binario sin sus librerías). HZ_E2E=0 la apaga. */
async function chromiumUsable(): Promise<string | null> {
  if (process.env.HZ_E2E === '0') return null
  const exe = buscarChromium()
  if (!exe) return null
  try {
    const { chromium } = await import('playwright-core')
    await (await chromium.launch({ executablePath: exe, args: ['--disable-gpu'] })).close()
    return exe
  } catch (err) {
    console.warn(`[tablero e2e] Chromium no arranca (${(err as Error).message.split('\n')[0]}).`)
    return null
  }
}

const CHROMIUM = await chromiumUsable()
if (!CHROMIUM) console.warn('[tablero e2e] Sin Chromium usable (o HZ_E2E=0): se omite la prueba en navegador.')

const normal = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

describe.skipIf(!CHROMIUM)('tablero en navegador real contra la API real', () => {
  let e: Entorno
  let vite: ViteDevServer
  let browser: Browser
  let base = ''
  let golden1: { id: string; token: string }
  let vivo: { id: string; token: string; tokens: string[] }
  const capturas = process.env.HZ_CAPTURAS ?? ''

  async function inscribirTodos(sala: Awaited<ReturnType<typeof crearSala>>, ids: (number | string)[]) {
    const tokens = new Map<number | string, string>()
    for (const [i, id] of ids.entries()) {
      const r = await inscribir(e, sala.mesas[i % sala.mesas.length].codigo, `golden${sala.id}${id}@prueba.co`, `Persona ${id}`)
      expect(r.statusCode, r.body).toBe(201)
      tokens.set(id, r.json().token)
    }
    return tokens
  }

  async function votarGolden(tokens: Map<number | string, string>, ronda: number) {
    for (const v of ps.votos.filter((x) => x.ronda === ronda)) {
      const respuestas = Object.fromEntries(CRITERIOS.map((c) => [c, v[c]]))
      const r = await votar(e, tokens.get(v.respondiente_id)!, String(v.proyecto).toLowerCase(), ronda, respuestas)
      expect(r.statusCode, r.body).toBe(200)
    }
  }

  beforeAll(async () => {
    e = await crearEntorno()
    // Sala 1: prueba sintética completa (R1 y R2 cerradas).
    const s1 = await crearSala(e, 2, 'Golden sintético')
    await accion(e, s1.id, 'abrir_inscripcion')
    const t1 = await inscribirTodos(s1, [...new Set(ps.votos.map((v) => v.respondiente_id))])
    await accion(e, s1.id, 'abrir_ronda_1')
    await votarGolden(t1, 1)
    await accion(e, s1.id, 'cerrar_ronda_1')
    await accion(e, s1.id, 'abrir_ronda_2')
    await votarGolden(t1, 2)
    await accion(e, s1.id, 'cerrar_ronda_2')
    golden1 = { id: s1.id, token: s1.token_tablero }
    // Sala 2: R1 abierta con 2 personas en 1 mesa, sin votos.
    const s2 = await crearSala(e, 1, 'Sala en vivo')
    await accion(e, s2.id, 'abrir_inscripcion')
    const t2 = await inscribirTodos(s2, ['a', 'b'])
    await accion(e, s2.id, 'abrir_ronda_1')
    vivo = { id: s2.id, token: s2.token_tablero, tokens: [...t2.values()] }

    // Vite y Chromium cargan la CPU: dentro de tools/test.sh esperan a que avancen los demás archivos
    // (≈ 30 s sin esta prueba) para no vencer los tiempos de las pruebas de jsdom de otras áreas.
    // Corriendo solo este archivo: HZ_E2E_ESPERA_MS=0.
    await new Promise((r) => setTimeout(r, Number(process.env.HZ_E2E_ESPERA_MS ?? 25_000)))
    await e.app.listen({ port: 0, host: '127.0.0.1' })
    const api = `http://127.0.0.1:${(e.app.server.address() as AddressInfo).port}`
    const { createServer } = await import('vite')
    vite = await createServer({
      configFile: join(RAIZ, 'vite.config.ts'),
      root: join(RAIZ, 'web'),
      logLevel: 'error',
      server: { port: 0, strictPort: false, host: '127.0.0.1', proxy: { '/api': { target: api, changeOrigin: true } } },
    })
    await vite.listen()
    base = `http://127.0.0.1:${(vite.httpServer!.address() as AddressInfo).port}`
    const { chromium } = await import('playwright-core')
    browser = await chromium.launch({ executablePath: CHROMIUM!, args: ['--disable-gpu'] })
    if (capturas) mkdirSync(capturas, { recursive: true })
    // Calentamiento: con la caché de Vite vacía, el preempaquetado de dependencias puede recargar la
    // página en la primera visita. Se absorbe aquí y no dentro de una prueba.
    const pg = await browser.newPage()
    await pg.goto(`${base}/tablero/${golden1.id}?t=${golden1.token}`, { waitUntil: 'networkidle', timeout: 120_000 })
    await pg.waitForSelector('svg.hz-matriz', { timeout: 60_000 })
    await pg.waitForLoadState('networkidle')
    await pg.close()
  }, 240_000)

  afterAll(async () => {
    await browser?.close()
    await vite?.close()
    // El proxy de Vite deja conexiones keep-alive: sin cortarlas, close() espera a que expiren.
    e?.app.server.closeAllConnections?.()
    await e?.app.close()
  }, 60_000)

  async function abrir(w: number, h: number, url: string, esperar = 'svg.hz-matriz circle.hz-r2'): Promise<Page> {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(base + url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForSelector(esperar, { timeout: 30_000 })
    return page
  }

  it.each(ANCHOS)(
    'a %i×%i px: puntos = golden, sin desborde, Comparación automática, legible y AA',
    async (w, h) => {
      const page = await abrir(w, h, `/tablero/${golden1.id}?t=${golden1.token}`)
      await page.evaluate(() => document.fonts.ready)
      const r = await page.evaluate(() => {
        const svg = document.querySelector('svg.hz-matriz')!
        const textos = [...svg.querySelectorAll('text')]
        // Marcas de eje: X con text-anchor middle, Y con text-anchor end.
        const marcas = (anchor: string, attr: 'x' | 'y') =>
          textos.filter((t) => /^\d$/.test(t.textContent ?? '') && t.getAttribute('text-anchor') === anchor).map((t) => [Number(t.textContent), Number(t.getAttribute(attr))])
        const circ = [...svg.querySelectorAll('circle.hz-r1, circle.hz-r2, circle.hz-fijo')].map((c) => ({
          id: (c as SVGElement).dataset.proyecto!,
          tipo: c.classList.contains('hz-fijo') ? 'fijo' : c.classList.contains('hz-r1') ? '1' : '2',
          nombre: c.querySelector('title')?.textContent?.split(' · ')[0] ?? '',
          cx: Number(c.getAttribute('cx')),
          cy: Number(c.getAttribute('cy')),
        }))
        const doc = document.documentElement
        return {
          tx: marcas('middle', 'x'),
          ty: marcas('end', 'y'),
          circ,
          vista: document.querySelector('.hz-segmento [aria-pressed="true"]')?.textContent,
          desbordeX: doc.scrollWidth - innerWidth,
          desbordeY: doc.scrollHeight - innerHeight,
          letraCuerpo: parseFloat(getComputedStyle(document.querySelector('.hz-tablero')!).fontSize),
          lateralOculto: (() => {
            const l = document.querySelector('.hz-lateral')!
            return l.scrollHeight - l.clientHeight
          })(),
          letraMin: Math.min(
            ...[...document.querySelectorAll('.hz-tablero *')]
              .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()) && !el.closest('svg') && (el as HTMLElement).offsetParent)
              .map((el) => parseFloat(getComputedStyle(el).fontSize)),
          ),
        }
      })
      const lin = (p: number[][]) => {
        const [a, b] = [p[0], p[p.length - 1]]
        const m = (b[1] - a[1]) / (b[0] - a[0])
        return (px: number) => a[0] + (px - a[1]) / m
      }
      const vx = lin(r.tx)
      const vy = lin(r.ty)
      // El SVG redondea a 0,01 px: la tolerancia es la del golden sintético (0,001) más medio centésimo de píxel.
      const tol = 0.001 + 0.005 * Math.abs(9 / (r.tx[r.tx.length - 1][1] - r.tx[0][1]))
      const vivos = r.circ.filter((c) => c.tipo !== 'fijo')
      const fijos = r.circ.filter((c) => c.tipo === 'fijo')
      expect(vivos).toHaveLength(4)
      expect(fijos).toHaveLength(8)
      for (const c of vivos) {
        const esp = ps.esperado[c.id.toUpperCase()][c.tipo]
        expect(Math.abs(vx(c.cx) - esp.eje_x), `${c.id} R${c.tipo} x`).toBeLessThanOrEqual(tol)
        expect(Math.abs(vy(c.cy) - esp.eje_y), `${c.id} R${c.tipo} y`).toBeLessThanOrEqual(tol)
      }
      for (const c of fijos) {
        const esp = fijosGolden.find((f) => normal(f.nombre) === normal(c.nombre))
        expect(esp, `fijo ${c.nombre} en golden`).toBeTruthy()
        // Misma tolerancia que los vivos: el límite lo pone el redondeo del SVG a 0,01 px, no golden.
        expect(Math.abs(vx(c.cx) - esp!.esperado.eje_x), `${c.nombre} x`).toBeLessThanOrEqual(tol)
        expect(Math.abs(vy(c.cy) - esp!.esperado.eje_y), `${c.nombre} y`).toBeLessThanOrEqual(tol)
      }
      expect(r.vista).toBe('Comparación')
      expect(r.desbordeX, 'desborde horizontal').toBeLessThanOrEqual(0)
      if (w >= 1366) expect(r.desbordeY, 'scroll vertical en proyector').toBeLessThanOrEqual(0)
      // Legible a 6 m: cuerpo ≥ 18 px a 1920 (≈ 20 px), ≥ 14 px en 360.
      expect(r.letraCuerpo).toBeGreaterThanOrEqual(w >= 1900 ? 18 : 14)
      console.info(`[tablero e2e] ${w}px: letra cuerpo ${r.letraCuerpo} px, mínima ${r.letraMin} px, panel lateral oculto ${r.lateralOculto} px`)
      // En proyector (1920×1080 y 1366×768) todo el panel lateral se ve sin desplazarlo: nadie está al teclado.
      if (w >= 1366) expect(r.lateralOculto, 'panel lateral con contenido oculto').toBeLessThanOrEqual(0)
      if (w >= 1900) expect(r.letraMin, 'letra mínima en proyector').toBeGreaterThanOrEqual(12)
      // Ninguna flecha ni burbuja sale del lienzo.
      expect(await page.locator('svg.hz-matriz').evaluate((s) => s.getBoundingClientRect().right <= innerWidth + 0.5)).toBe(true)

      // Contraste AA del texto HTML visible (4,5:1; 3:1 para letra grande).
      const fallasAA = await page.evaluate(contrasteAA)
      expect(fallasAA, fallasAA.join('\n')).toEqual([])

      if (capturas) await page.screenshot({ path: join(capturas, `tablero-${w}.png`), fullPage: w < 1100 })

      if (w === 1920) {
        // Tecla F: pantalla completa (o, si el navegador no deja, igual oculta los controles).
        await page.keyboard.press('f')
        await page.waitForSelector('.hz-pantalla-completa', { timeout: 5000 })
        expect(await page.locator('.hz-cab-controles').isVisible()).toBe(false)
        await page.keyboard.press('1')
        await expect.poll(() => page.locator('.hz-cab-vista').textContent()).toBe('Ronda 1')
        if (capturas) await page.screenshot({ path: join(capturas, 'tablero-1920-pantalla-completa.png') })
      }
      await page.context().close()
    },
    120_000,
  )

  it('alcance Mesa 1 con token: la URL cambia, los puntos son los de la mesa; sin token, aviso útil', async () => {
    const p = await abrir(1920, 1080, `/tablero/${golden1.id}?t=${golden1.token}`)
    const mesa = (await e.app.inject(`/api/tablero/${golden1.id}?t=${golden1.token}`)).json().progreso.por_mesa[0]
    await p.selectOption('.hz-alcance select', mesa.mesa_id)
    await expect.poll(() => p.locator('.hz-cab-meta').textContent(), { timeout: 5000 }).toContain(mesa.nombre)
    expect(new URL(p.url()).searchParams.get('mesa')).toBe(mesa.mesa_id)
    const api = (await e.app.inject(`/api/tablero/${golden1.id}?alcance=mesa&mesa=${mesa.mesa_id}&t=${golden1.token}`)).json()
    const dib = await p.evaluate(() => {
      const svg = document.querySelector('svg.hz-matriz')!
      const t = [...svg.querySelectorAll('text')].filter((x) => /^\d$/.test(x.textContent ?? ''))
      const mx = t.filter((x) => x.getAttribute('text-anchor') === 'middle').map((x) => [Number(x.textContent), Number(x.getAttribute('x'))])
      const my = t.filter((x) => x.getAttribute('text-anchor') === 'end').map((x) => [Number(x.textContent), Number(x.getAttribute('y'))])
      const lin = (q: number[][]) => (px: number) => q[0][0] + ((px - q[0][1]) * (q[q.length - 1][0] - q[0][0])) / (q[q.length - 1][1] - q[0][1])
      return [...svg.querySelectorAll('circle.hz-r1, circle.hz-r2')].map((c) => ({
        k: `${(c as SVGElement).dataset.proyecto}-${c.classList.contains('hz-r1') ? 1 : 2}`,
        x: lin(mx)(Number(c.getAttribute('cx'))),
        y: lin(my)(Number(c.getAttribute('cy'))),
      }))
    })
    expect(dib).toHaveLength(4)
    for (const d of dib) {
      const [id, ronda] = d.k.split('-')
      const r = api.proyectos_vivos.find((v: { id: string }) => v.id === id).rondas.find((x: { ronda: number }) => x.ronda === Number(ronda))
      expect(Math.abs(d.x - r.eje_x), d.k).toBeLessThan(0.002)
      expect(Math.abs(d.y - r.eje_y), d.k).toBeLessThan(0.002)
    }
    await p.context().close()

    const sinToken = await abrir(1366, 768, `/tablero/${golden1.id}`, '.hz-error-grande')
    expect(await sinToken.locator('.hz-error-grande').textContent()).toContain('Pide al facilitador el enlace completo')
    await sinToken.context().close()
  }, 60_000)

  it('con R1 abierta: 304 sin cambios y mismo SVG; un voto y el cierre se ven en menos de 5 s', async () => {
    const p = await abrir(1920, 1080, `/tablero/${vivo.id}?t=${vivo.token}`, 'svg.hz-matriz')
    const estados: number[] = []
    p.on('response', (res) => res.url().includes('/api/tablero/') && estados.push(res.status()))
    expect(await p.locator('.hz-vacio').textContent()).toContain('Aún no hay votos en la ronda 1')
    expect(await p.locator('.hz-insignia-vivo').textContent()).toBe('En vivo')
    // Sin cambios: el servidor responde 304 y el <svg> sigue siendo el mismo nodo (sin parpadeo).
    await p.evaluate(() => ((window as unknown as { __svg: Element }).__svg = document.querySelector('svg.hz-matriz')!))
    await p.waitForTimeout(3000)
    expect(estados).toContain(304)
    expect(await p.evaluate(() => (window as unknown as { __svg: Element }).__svg === document.querySelector('svg.hz-matriz'))).toBe(true)

    // Voto de las 2 personas en los 2 proyectos: aparece el punto y la sala entra en precierre.
    const resp = Object.fromEntries(CRITERIOS.map((c) => [c, 7]))
    const t0 = Date.now()
    for (const tk of vivo.tokens) for (const pr of ['insumex', 'nutriwhat']) expect((await votar(e, tk, pr, 1, resp)).statusCode).toBe(200)
    await p.waitForSelector('svg.hz-matriz circle.hz-r1', { timeout: 10_000 })
    await p.waitForSelector('.hz-insignia-alerta', { timeout: 10_000 })
    const tVoto = Date.now() - t0
    expect(await p.locator('.hz-insignia-alerta').textContent()).toBe('Preliminar')
    expect(await p.locator('.hz-lateral').textContent()).toContain('Toda la sala votó')

    // Cierre de la ronda: desaparece "Preliminar" y el estado cambia.
    const t1 = Date.now()
    await accion(e, vivo.id, 'cerrar_ronda_1')
    await expect.poll(() => p.locator('.hz-cab-meta').textContent(), { timeout: 10_000, interval: 100 }).toContain('Ronda 1 cerrada')
    const tCierre = Date.now() - t1
    expect(await p.locator('.hz-insignia').count()).toBe(0)
    expect(tVoto).toBeLessThan(5000)
    expect(tCierre).toBeLessThan(5000)
    if (capturas) await p.screenshot({ path: join(capturas, 'tablero-vivo-cerrada.png') })

    // Ronda 2: la vista pasa sola a "Ronda 2"; al cerrar R2, sola a "Comparación".
    const vistaActiva = () => p.locator('.hz-segmento [aria-pressed="true"]').textContent()
    await accion(e, vivo.id, 'abrir_ronda_2')
    await expect.poll(vistaActiva, { timeout: 10_000, interval: 100 }).toBe('Ronda 2')
    const resp2 = Object.fromEntries(CRITERIOS.map((c) => [c, 3]))
    for (const tk of vivo.tokens) for (const pr of ['insumex', 'nutriwhat']) expect((await votar(e, tk, pr, 2, resp2)).statusCode).toBe(200)
    const t2 = Date.now()
    await accion(e, vivo.id, 'cerrar_ronda_2')
    await expect.poll(vistaActiva, { timeout: 10_000, interval: 100 }).toBe('Comparación')
    const tComparacion = Date.now() - t2
    expect(await p.locator('svg.hz-matriz .hz-flecha').count()).toBe(2)
    expect(tComparacion).toBeLessThan(5000)
    console.info(`[tablero e2e] voto visible en ${tVoto} ms · cierre R1 en ${tCierre} ms · Comparación tras cerrar R2 en ${tComparacion} ms`)
    if (capturas) await p.screenshot({ path: join(capturas, 'tablero-vivo-comparacion.png') })
    await p.context().close()
  }, 60_000)
})

/** Corre en el navegador: texto HTML visible con contraste menor a AA contra su fondo efectivo. */
function contrasteAA(): string[] {
  const rgba = (s: string) => (s.match(/[\d.]+/g) ?? []).map(Number) as number[]
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const fondo = (el: Element | null): number[] => {
    for (; el; el = el.parentElement) {
      const c = rgba(getComputedStyle(el).backgroundColor)
      if (c.length >= 3 && (c[3] ?? 1) > 0.5) return c
    }
    return [255, 255, 255]
  }
  const fallas: string[] = []
  const recorrido = document.createTreeWalker(document.querySelector('.hz-tablero')!, NodeFilter.SHOW_TEXT)
  const vistos = new Set<Element>()
  for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
    const el = n.parentElement
    if (!el || vistos.has(el) || !n.textContent?.trim() || el.closest('svg')) continue
    vistos.add(el)
    const cs = getComputedStyle(el)
    const caja = el.getBoundingClientRect()
    if (cs.visibility === 'hidden' || caja.width === 0 || caja.height === 0) continue
    const fg = rgba(cs.color)
    const bg = fondo(el)
    const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x)
    const ratio = (a + 0.05) / (b + 0.05)
    const px = parseFloat(cs.fontSize)
    const grande = px >= 24 || (px >= 18.66 && Number(cs.fontWeight) >= 700)
    if (ratio < (grande ? 3 : 4.5)) fallas.push(`${ratio.toFixed(2)}:1 "${n.textContent.trim().slice(0, 40)}" (${cs.color} sobre rgb(${bg.slice(0, 3)}))`)
  }
  return fallas
}
