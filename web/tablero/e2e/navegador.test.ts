// Prueba del tablero en un navegador real (Chromium headless) contra la API real con BD en memoria.
// Corre dentro de tools/test.sh. Si no hay Chromium instalado se omite con un aviso (en CI falla)
// (instálalo con `npx playwright-core install chromium-headless-shell` o define PW_EXE).
//
// 1. Sala con la prueba sintética del golden cerrada en R2: los puntos dibujados (leídos del SVG y
//    convertidos con las marcas de los ejes) coinciden con golden y con los 8 fijos, en 1920, 1366 y 360 px.
//    Además: sin desborde horizontal, 1920×1080 sin scroll, vista Comparación automática, letra legible
//    en proyector, contraste AA del texto HTML y tecla F (pantalla completa). Por defecto, la matriz sola
//    (sin tablas) con su explicación a la vista; zoom vectorial con +, rueda y arrastre; clic o M, los datos.
// 2. Sala con R1 abierta: un voto y el cierre de ronda se ven en el tablero en menos de 5 s, con 304
//    mientras no hay cambios y sin reemplazar el nodo del SVG.
import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Browser, Page } from 'playwright-core'
import type { ViteDevServer } from 'vite'
import { CRITERIOS } from '../../../shared/motor/motor'
import { nombreCorto } from '../logica'
import { sinNavegador } from '../../../tests/navegador'
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
  [1280, 720],
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
if (!CHROMIUM) sinNavegador('[tablero e2e]', 'Sin Chromium usable.')

const normal = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '')

describe.skipIf(!CHROMIUM)('tablero en navegador real contra la API real', () => {
  let e: Entorno
  let vite: ViteDevServer
  let browser: Browser
  let base = ''
  let golden1: { id: string; token: string }
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
      server: {
        port: 0,
        strictPort: false,
        host: '127.0.0.1',
        proxy: { '/api': { target: api, changeOrigin: true } },
        // En un worktree node_modules puede ser un enlace: sin su ruta real Vite no sirve la Montserrat.
        fs: { allow: [RAIZ, realpathSync(join(RAIZ, 'node_modules'))] },
      },
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

  async function abrir(w: number, h: number, url: string, esperar = 'svg.hz-matriz circle.hz-r2', movimiento = false): Promise<Page> {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: movimiento ? 'no-preference' : 'reduce' })
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
      await matrizSolaYZoom(page, w)
      // Con los datos (tecla M): panel lateral con progreso y promedios.
      await page.keyboard.press('m')
      await page.waitForSelector('.hz-lateral')
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
      if (w >= 1280) expect(r.lateralOculto, 'panel lateral con contenido oculto').toBeLessThanOrEqual(0)
      if (w >= 1900) expect(r.letraMin, 'letra mínima en proyector').toBeGreaterThanOrEqual(12)
      else if (w >= 1280) expect(r.letraMin, 'letra mínima en proyector pequeño').toBeGreaterThanOrEqual(10)
      // Nombres en la matriz: ninguno se solapa con otro, los de los fijos no tapan burbujas y nada sale del lienzo.
      for (const [tecla, nombre] of [['1', 'Ronda 1'], ['2', 'Ronda 2'], ['c', 'Comparación']]) {
        await page.keyboard.press(tecla)
        await expect.poll(() => page.locator('.hz-segmento [aria-pressed="true"]').textContent()).toBe(nombre)
        const solapes = await page.evaluate(solapesEtiquetas)
        expect(solapes, `${nombre}: ${solapes.join('\n')}`).toEqual([])
      }
      // Ninguna flecha ni burbuja sale del lienzo.
      expect(await page.locator('svg.hz-matriz').evaluate((s) => s.getBoundingClientRect().right <= innerWidth + 0.5)).toBe(true)

      // Contraste AA del texto HTML visible (4,5:1; 3:1 para letra grande).
      const fallasAA = await page.evaluate(contrasteAA)
      expect(fallasAA, fallasAA.join('\n')).toEqual([])
      // R1 verde y R2 rojo: con su etiqueta y forma propia, y contraste suficiente sobre los fondos.
      const fallasRondas = await page.evaluate(rondasLegibles)
      expect(fallasRondas, fallasRondas.join('\n')).toEqual([])
      // Tema carbón y encabezado de marca: firma «Horizontes por Estratek »» y la línea del degradado.
      const fallasMarca = await page.evaluate(marcaCarbon)
      expect(fallasMarca, fallasMarca.join('\n')).toEqual([])

      if (capturas) await page.screenshot({ path: join(capturas, `tablero-${w}.png`), fullPage: w < 1100 })

      // «Cómo votó la sala» (tecla D): conteos de la API por criterio, R1 y R2, sin desborde, legible y AA.
      await page.keyboard.press('d')
      await page.waitForSelector('.hz-cv-barras-r2')
      const api = (await e.app.inject(`/api/tablero/${golden1.id}?alcance=sala&t=${golden1.token}`)).json()
      const cv = await page.evaluate(() => {
        const l = document.querySelector('.hz-lateral')!
        const matriz = document.querySelector('svg.hz-matriz')!.getBoundingClientRect()
        const bloque = document.querySelector('.hz-cv')!.getBoundingClientRect()
        return {
          titulo: document.querySelector('.hz-cv-titulo')?.textContent,
          barras: [...document.querySelectorAll('.hz-cv [role="img"]')].map((b) => ({
            etiqueta: b.getAttribute('aria-label') ?? '',
            cuentas: [...b.querySelectorAll('.hz-cv-cuenta')].map((s) => Number(s.textContent)),
          })),
          desbordeX: document.documentElement.scrollWidth - innerWidth,
          lateralOculto: l.scrollHeight - l.clientHeight,
          // El bloque va al lado de la matriz en el proyector y debajo en el celular, nunca encima.
          tapaMatriz: bloque.left < matriz.right - 0.5 && bloque.top < matriz.bottom - 0.5,
          tieneTotal: /Total/.test(document.querySelector('.hz-tablero')!.textContent ?? ''),
          letraMin: Math.min(
            ...[...document.querySelectorAll('.hz-cv *')]
              .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent!.trim()))
              .map((el) => parseFloat(getComputedStyle(el).fontSize)),
          ),
        }
      })
      expect(cv.titulo).toBe('Cómo votó la sala')
      expect(cv.barras).toHaveLength(api.proyectos_vivos.length * api.criterios.length * 2)
      for (const p of api.proyectos_vivos) {
        for (const r of p.rondas) {
          for (const c of api.criterios) {
            const b = cv.barras.find((x) => x.etiqueta.startsWith(`${p.nombre}, ${nombreCorto(c.id, c.nombre)}, ronda ${r.ronda}:`))
            expect(b, `${p.nombre} ${c.id} R${r.ronda}`).toBeTruthy()
            expect(b!.cuentas).toEqual(['1', '3', '5', '7', '9'].map((k) => r.distribucion[c.id][k]))
          }
        }
      }
      console.info(`[tablero e2e] ${w}px «Cómo votó»: letra mínima ${cv.letraMin} px, panel lateral oculto ${cv.lateralOculto} px`)
      expect(cv.desbordeX, '«Cómo votó»: desborde horizontal').toBeLessThanOrEqual(0)
      expect(cv.tieneTotal, 'sin fila «Total» (preentrega 19-oct)').toBe(false)
      expect(cv.tapaMatriz, '«Cómo votó» tapa la matriz').toBe(false)
      if (w >= 1280) expect(cv.lateralOculto, '«Cómo votó»: panel lateral con contenido oculto').toBeLessThanOrEqual(0)
      if (w >= 1900) expect(cv.letraMin, '«Cómo votó»: letra mínima en proyector').toBeGreaterThanOrEqual(14)
      const fallasCv = await page.evaluate(contrasteAA)
      expect(fallasCv, fallasCv.join('\n')).toEqual([])
      if (capturas) await page.screenshot({ path: join(capturas, `tablero-${w}-como-voto.png`), fullPage: w < 1100 })
      await page.keyboard.press('d')
      await page.waitForSelector('.hz-cv', { state: 'detached' })

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
    // Sala propia de esta prueba (un reintento empieza limpio): R1 abierta, 3 personas en 1 mesa, sin votos.
    const s2 = await crearSala(e, 1, 'Sala en vivo')
    await accion(e, s2.id, 'abrir_inscripcion')
    const tk = await inscribirTodos(s2, ['a', 'b', 'c'])
    await accion(e, s2.id, 'abrir_ronda_1')
    const vivo = { id: s2.id, token: s2.token_tablero, tokens: [...tk.values()] }
    const p = await abrir(1920, 1080, `/tablero/${vivo.id}?t=${vivo.token}`, 'svg.hz-matriz', true)
    const estados: number[] = []
    p.on('response', (res) => res.url().includes('/api/tablero/') && estados.push(res.status()))
    expect(await p.locator('.hz-vacio').textContent()).toContain('Aún no hay votos en la ronda 1')
    expect(await p.locator('.hz-insignia-vivo').textContent()).toBe('En vivo')
    expect(await p.locator('.hz-franja').textContent()).toBe('Ronda 1 · individual y en silencio')
    // Sin cambios: el servidor responde 304 y el <svg> sigue siendo el mismo nodo (sin parpadeo).
    await p.evaluate(() => ((window as unknown as { __svg: Element }).__svg = document.querySelector('svg.hz-matriz')!))
    await p.waitForTimeout(3000)
    expect(estados).toContain(304)
    expect(await p.evaluate(() => (window as unknown as { __svg: Element }).__svg === document.querySelector('svg.hz-matriz'))).toBe(true)

    // Un solo voto por proyecto: bajo el mínimo (anonimato) no hay punto y el aviso dice cuántos faltan.
    const resp = Object.fromEntries(CRITERIOS.map((c) => [c, 7]))
    const [primero, ...resto] = vivo.tokens
    for (const pr of ['insumex', 'nutriwhat']) expect((await votar(e, primero, pr, 1, resp)).statusCode).toBe(200)
    await expect
      .poll(() => p.locator('.hz-vacio').textContent(), { timeout: 10_000, interval: 100 })
      .toBe('Hace falta al menos 3 votos para mostrar estos resultados')
    expect(await p.locator('svg.hz-matriz circle.hz-r1').count()).toBe(0)
    await p.keyboard.press('m')
    expect(await p.locator('.hz-comparada').textContent()).toContain('Faltan votos')
    const mesa = await abrir(1920, 1080, `/tablero/${vivo.id}?t=${vivo.token}&mesa=${s2.mesas[0].id}`, '.hz-vacio')
    expect(await mesa.locator('.hz-vacio').textContent()).toBe('Hace falta al menos 3 votos para mostrar esta mesa')
    await mesa.context().close()
    // En el celular (360 px), con «Faltan votos» en las celdas, nada se desborda (triage #5).
    const cel = await abrir(360, 740, `/tablero/${vivo.id}?t=${vivo.token}`, '.hz-boton-datos')
    await cel.click('.hz-boton-datos')
    await cel.waitForSelector('.hz-panel')
    expect(await cel.evaluate(() => document.documentElement.scrollWidth - innerWidth), 'desborde a 360 px').toBeLessThanOrEqual(0)
    await cel.context().close()

    // Voto de las otras 2 personas: aparece el punto y la sala entra en precierre.
    const t0 = Date.now()
    for (const tk of resto) for (const pr of ['insumex', 'nutriwhat']) expect((await votar(e, tk, pr, 1, resp)).statusCode).toBe(200)
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
    expect(await p.locator('.hz-franja').textContent()).toBe('Ronda 2 · discusión en la mesa')
    const resp2 = Object.fromEntries(CRITERIOS.map((c) => [c, 3]))
    for (const tk of vivo.tokens) for (const pr of ['insumex', 'nutriwhat']) expect((await votar(e, tk, pr, 2, resp2)).statusCode).toBe(200)
    await p.waitForSelector('svg.hz-matriz circle.hz-r2')
    // Registro cuadro a cuadro de las burbujas R2 para medir la animación R1 → R2 al cerrar la ronda.
    await p.evaluate(registrarCuadros)
    const t2 = Date.now()
    await accion(e, vivo.id, 'cerrar_ronda_2')
    await expect.poll(vistaActiva, { timeout: 10_000, interval: 100 }).toBe('Comparación')
    const tComparacion = Date.now() - t2
    // A mitad de la animación el lienzo cambia de tamaño (como cuando el encabezado cambia de alto al
    // cerrar la ronda): el SVG se redibuja y la animación debe seguir donde iba, sin volver a R1.
    await p.waitForTimeout(300)
    const altoAntes = await p.locator('svg.hz-matriz').getAttribute('height')
    await p.setViewportSize({ width: 1920, height: 1040 })
    await expect.poll(() => p.locator('svg.hz-matriz').getAttribute('height'), { timeout: 1000, interval: 20 }).not.toBe(altoAntes)
    expect(await p.locator('svg.hz-matriz .hz-anim-mov').count(), 'el redibujo llega con la animación en curso').toBe(2)
    expect(await p.locator('svg.hz-matriz .hz-flecha').count()).toBe(2)
    expect(tComparacion).toBeLessThan(5000)
    await expect.poll(() => p.locator('svg.hz-matriz .hz-anim-mov').count(), { timeout: 5000, interval: 100 }).toBe(0)
    await p.waitForTimeout(600)
    const anim = await p.evaluate(() => (window as unknown as { __anim: () => ResultadoAnimacion }).__anim())
    console.info(`[tablero e2e] animación R1 → R2: ${anim.duracion} ms, ${anim.cuadros} cuadros, intervalo mediano ${anim.mediana} ms, máximo ${anim.maximo} ms, arranques ${anim.arranques}`)
    // Una sola animación, que mueve las burbujas desde R1 hasta su punto final, sin saltos hacia atrás.
    expect(anim.arranques).toBe(1)
    expect(anim.duracion).toBeGreaterThan(900)
    expect(anim.duracion).toBeLessThan(2500)
    expect(anim.recorrido, 'las burbujas se mueven').toBeGreaterThan(30)
    expect(anim.retroceso, 'el movimiento no retrocede').toBeLessThan(1.5)
    expect(anim.errorFinal, 'terminan en su punto R2').toBeLessThan(0.5)
    // Fluida sin afectar el rendimiento: mediana ≤ 1 cuadro a 30 fps.
    expect(anim.mediana).toBeLessThanOrEqual(34)
    console.info(`[tablero e2e] voto visible en ${tVoto} ms · cierre R1 en ${tCierre} ms · Comparación tras cerrar R2 en ${tComparacion} ms`)
    if (capturas) await p.screenshot({ path: join(capturas, 'tablero-vivo-comparacion.png') })
    await p.context().close()
  }, 60_000)

  // Capturas de referencia para la guía del facilitador (solo con HZ_CAPTURAS_GUIA=docs/capturas).
  const guia = process.env.HZ_CAPTURAS_GUIA ?? ''
  it.runIf(!!guia)('capturas de referencia de cada vista para la guía del facilitador', async () => {
    mkdirSync(guia, { recursive: true })
    const ids = [...new Set(ps.votos.map((v) => v.respondiente_id))]
    // Sala cerrada con los votos de la prueba sintética, con nombre de taller.
    const sc = await crearSala(e, 2, 'Taller Foodsume')
    await accion(e, sc.id, 'abrir_inscripcion')
    const tc = await inscribirTodos(sc, ids)
    await accion(e, sc.id, 'abrir_ronda_1')
    await votarGolden(tc, 1)
    await accion(e, sc.id, 'cerrar_ronda_1')
    await accion(e, sc.id, 'abrir_ronda_2')
    await votarGolden(tc, 2)
    await accion(e, sc.id, 'cerrar_ronda_2')
    // Sala con la ronda 1 abierta y todos ya votaron: precierre (resultado preliminar).
    const sp = await crearSala(e, 2, 'Taller Foodsume')
    await accion(e, sp.id, 'abrir_inscripcion')
    const tp = await inscribirTodos(sp, ids)
    await accion(e, sp.id, 'abrir_ronda_1')
    await votarGolden(tp, 1)
    // Sala con la ronda 2 abierta y todos ya votaron (franja roja).
    const s2 = await crearSala(e, 2, 'Taller Foodsume')
    await accion(e, s2.id, 'abrir_inscripcion')
    const t2 = await inscribirTodos(s2, ids)
    await accion(e, s2.id, 'abrir_ronda_1')
    await votarGolden(t2, 1)
    await accion(e, s2.id, 'cerrar_ronda_1')
    await accion(e, s2.id, 'abrir_ronda_2')
    await votarGolden(t2, 2)
    // Sala con la ronda 1 abierta y un solo voto por proyecto: bajo el mínimo de votos.
    const sm = await crearSala(e, 1, 'Taller Foodsume')
    await accion(e, sm.id, 'abrir_inscripcion')
    const tm = await inscribirTodos(sm, ['a', 'b', 'c'])
    await accion(e, sm.id, 'abrir_ronda_1')
    const resp = Object.fromEntries(CRITERIOS.map((c) => [c, 7]))
    for (const pr of ['insumex', 'nutriwhat']) await votar(e, tm.get('a')!, pr, 1, resp)

    const url =(id: string, token: string, extra = '') => `/tablero/${id}?t=${token}${extra}`
    const cerrada = url(sc.id, sc.token_tablero)
    const tomar = async (nombre: string, w: number, h: number, ruta: string, preparar?: (p: Page) => Promise<void>) => {
      const p = await abrir(w, h, ruta, 'svg.hz-matriz circle')
      await p.evaluate(() => document.fonts.ready)
      if (preparar) await preparar(p)
      await p.waitForTimeout(300)
      await p.screenshot({ path: join(guia, nombre), fullPage: w < 1100 })
      await p.context().close()
    }
    const vista = (tecla: string, texto: string) => async (p: Page) => {
      await p.keyboard.press(tecla)
      await expect.poll(() => p.locator('.hz-segmento [aria-pressed="true"]').textContent()).toBe(texto)
    }
    await tomar('01-ronda-1.png', 1920, 1080, cerrada, vista('1', 'Ronda 1'))
    await tomar('02-ronda-2.png', 1920, 1080, cerrada, vista('2', 'Ronda 2'))
    await tomar('03-comparacion.png', 1920, 1080, cerrada)
    await tomar('04-preliminar.png', 1920, 1080, url(sp.id, sp.token_tablero), async (p) => {
      await p.waitForSelector('.hz-insignia-alerta')
    })
    await tomar('05-todas-las-mesas.png', 1920, 1080, url(sc.id, sc.token_tablero, '&vista=mesas'), async (p) => {
      await expect.poll(() => p.locator('svg.hz-matriz').count(), { timeout: 15_000 }).toBe(2)
      await p.waitForSelector('svg.hz-matriz circle.hz-r2')
    })
    await tomar('06-proyector-pantalla-completa.png', 1920, 1080, cerrada, async (p) => {
      await p.keyboard.press('f')
      await p.waitForSelector('.hz-pantalla-completa')
    })
    await tomar('07-proyector-1280x720.png', 1280, 720, cerrada)
    await tomar('08-mesa-1.png', 1920, 1080, url(sc.id, sc.token_tablero, `&mesa=${sc.mesas[0].id}`))
    await tomar('09-celular-360.png', 360, 740, cerrada)
    await tomar('10-ronda-2-abierta.png', 1920, 1080, url(s2.id, s2.token_tablero), async (p) => {
      await p.waitForSelector('.hz-franja-r2')
    })
    await tomar('11-minimo-de-votos.png', 1920, 1080, url(sm.id, sm.token_tablero, `&mesa=${sm.mesas[0].id}`), async (p) => {
      await expect.poll(() => p.locator('.hz-vacio').textContent()).toContain('Hace falta al menos')
    })
    await tomar('12-celular-360-ronda-2.png', 360, 740, url(s2.id, s2.token_tablero))
  }, 240_000)
})

/**
 * Por defecto el público ve solo la matriz (preentrega 19-oct): sin panel lateral ni tablas, sin desborde,
 * con la explicación a la vista y AA. Zoom vectorial (C19-6): +, rueda y arrastre cambian el viewBox del
 * mismo SVG (el texto no se pixela: crece con su caja y su tamaño de letra no cambia), 0 vuelve a todo.
 * Un clic sin arrastre sobre la matriz muestra los datos y otro la deja sola.
 */
async function matrizSolaYZoom(page: Page, w: number) {
  const sola = await page.evaluate(() => {
    const exp = document.querySelector('.hz-explica')!.getBoundingClientRect()
    return {
      lateral: !!document.querySelector('.hz-lateral, .hz-comparada, .hz-panel'),
      explica: document.querySelector('.hz-explica')!.textContent,
      explicaAlto: exp.height,
      explicaFuera: exp.bottom - innerHeight,
      desbordeX: document.documentElement.scrollWidth - innerWidth,
      desbordeY: document.documentElement.scrollHeight - innerHeight,
      matriz: document.querySelector('svg.hz-matriz')!.getBoundingClientRect().width,
    }
  })
  expect(sola.lateral, 'matriz sola: sin panel lateral ni tablas').toBe(false)
  expect(sola.explica).toContain('Eje X, Time to Market')
  expect(sola.explica).not.toMatch(/%|—/)
  expect(sola.explicaAlto, 'explicación bajo la matriz').toBeGreaterThan(0)
  if (w >= 1280) expect(sola.explicaFuera, 'explicación a la vista sin desplazar en el proyector').toBeLessThanOrEqual(0.5)
  expect(sola.desbordeX, 'matriz sola: desborde horizontal').toBeLessThanOrEqual(0)
  if (w >= 1280) expect(sola.desbordeY, 'matriz sola: scroll vertical en proyector').toBeLessThanOrEqual(0)
  // Protagonista: en el proyector la matriz ocupa casi todo el alto útil.
  if (w >= 1280) expect(sola.matriz, 'matriz sola en proyector').toBeGreaterThan(w >= 1900 ? 820 : 520)
  const fallas = await page.evaluate(contrasteAA)
  expect(fallas, fallas.join('\n')).toEqual([])

  const svg = page.locator('svg.hz-matriz')
  const estado = () =>
    svg.evaluate((s) => {
      const t = s.querySelector('text.hz-etq-vivo')!
      return { vb: s.getAttribute('viewBox'), w: s.getAttribute('width'), fs: t.getAttribute('font-size'), alto: t.getBoundingClientRect().height }
    })
  await page.evaluate(() => ((window as unknown as { __svgZoom: Element }).__svgZoom = document.querySelector('svg.hz-matriz')!))
  const antes = await estado()
  await page.keyboard.press('+')
  await expect.poll(() => page.locator('.hz-zoom output').textContent()).toBe('150 %')
  const cerca = await estado()
  expect(cerca.vb).not.toBe(antes.vb)
  expect(cerca.w).toBe(antes.w)
  expect(cerca.fs).toBe(antes.fs)
  expect(cerca.alto / antes.alto, 'el texto crece con el zoom (vectorial)').toBeGreaterThan(1.4)
  // Arrastre: mueve la vista y no cuenta como clic.
  const caja = (await svg.boundingBox())!
  const [cx, cy] = [caja.x + caja.width / 2, caja.y + caja.height / 2]
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.move(cx + 80, cy + 40, { steps: 5 })
  await page.mouse.up()
  expect((await estado()).vb).not.toBe(cerca.vb)
  expect(await page.locator('.hz-lateral').count(), 'un arrastre no abre los datos').toBe(0)
  // Rueda hacia arriba sobre la matriz: acerca más.
  await page.mouse.wheel(0, -300)
  await expect.poll(async () => Number((await page.locator('.hz-zoom output').textContent())!.replace(/\D/g, ''))).toBeGreaterThan(150)
  await page.keyboard.press('0')
  await expect.poll(estado).toEqual(antes)
  expect(await page.evaluate(() => (window as unknown as { __svgZoom: Element }).__svgZoom === document.querySelector('svg.hz-matriz'))).toBe(true)
  // Clic sin arrastre: los datos; otro clic: la matriz sola.
  await page.mouse.click(cx, cy)
  await page.waitForSelector('.hz-lateral')
  await page.mouse.click(cx, cy)
  await page.waitForSelector('.hz-lateral', { state: 'detached' })
}

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

/**
 * Corre en el navegador sobre la matriz en Comparación: cada burbuja viva lleva su etiqueta «R1»/«R2»;
 * R1 es un aro hueco y R2 sólida (se distinguen sin color); el color de cada ronda contrasta 3:1 con
 * todos los fondos de horizonte (elemento gráfico) y el texto «R1»/«R2» 4,5:1 con su halo. Tema carbón:
 * H1, H2 y H3 en superficies distintas y los fijos en un gris neutro (ni R1, ni R2, ni el azul de acción)
 * con 3:1 sobre cada horizonte. Colores calculados (los de los tokens del tema), no los atributos.
 */
function rondasLegibles(): string[] {
  const rgb = (s: string) => (s.startsWith('#') ? [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16)) : (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number))
  const lum = ([r, g, b]: number[]) => {
    const f = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const contraste = (a: number[], b: number[]) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }
  const svg = document.querySelector('svg.hz-matriz')!
  const fallas: string[] = []
  const fondos = [...svg.querySelectorAll('g[clip-path] > rect, g[clip-path] > path')].map((f) => rgb(getComputedStyle(f).fill))
  if (fondos.length < 3) fallas.push(`${fondos.length} fondos de horizonte`)
  if (new Set(fondos.map((f) => f.join())).size < 3) fallas.push(`horizontes sin superficies escalonadas: ${fondos.map((f) => `rgb(${f})`).join(' ')}`)
  const colorRonda: Record<number, string> = {}
  for (const n of [1, 2]) {
    const circulos = [...svg.querySelectorAll<SVGCircleElement>(`circle.hz-r${n}`)]
    const etiquetas = [...svg.querySelectorAll<SVGTSpanElement>('tspan.hz-etq-ronda')].filter((t) => t.textContent === `R${n}`)
    if (!circulos.length) fallas.push(`sin burbujas R${n}`)
    if (etiquetas.length !== circulos.length) fallas.push(`${circulos.length} burbujas R${n} y ${etiquetas.length} etiquetas «R${n}»`)
    for (const c of circulos) {
      const cs = getComputedStyle(c)
      const color = rgb(n === 1 ? cs.stroke : cs.fill)
      colorRonda[n] = color.join()
      const opacidad = Number(cs.fillOpacity)
      if (n === 1 ? opacidad > 0.3 : opacidad < 1) fallas.push(`R${n} de ${c.dataset.proyecto}: relleno ${opacidad} (R1 hueco, R2 sólido)`)
      for (const f of fondos) if (contraste(color, f) < 3) fallas.push(`R${n} ${contraste(color, f).toFixed(2)}:1 sobre rgb(${f})`)
    }
    for (const t of etiquetas) {
      const halo = rgb(getComputedStyle(t.parentElement!).stroke)
      const r = contraste(rgb(getComputedStyle(t).fill), halo)
      if (r < 4.5) fallas.push(`texto «R${n}» ${r.toFixed(2)}:1 sobre su halo rgb(${halo})`)
    }
  }
  if (colorRonda[1] === colorRonda[2]) fallas.push('R1 y R2 del mismo color')
  const accion = rgb(getComputedStyle(document.querySelector('.hz-tablero')!).getPropertyValue('--hz-accion').trim())
  for (const c of svg.querySelectorAll<SVGCircleElement>('circle.hz-fijo')) {
    const color = rgb(getComputedStyle(c).fill)
    if ([colorRonda[1], colorRonda[2], accion.join()].includes(color.join())) fallas.push(`fijo ${c.dataset.proyecto} con color de ronda o de acción rgb(${color})`)
    if (Number(getComputedStyle(c).fillOpacity) < 1) fallas.push(`fijo ${c.dataset.proyecto} translúcido`)
    for (const f of fondos) if (contraste(color, f) < 3) fallas.push(`fijo ${c.dataset.proyecto} ${contraste(color, f).toFixed(2)}:1 sobre rgb(${f})`)
  }
  return fallas
}

/**
 * Corre en el navegador: el tablero usa el tema carbón (data-tema="carbon", fondo #141414 y tinta hielo),
 * el encabezado lleva la firma «Horizontes por Estratek »» con la » en el azul de acción y la línea del
 * degradado de marca de borde a borde.
 */
function marcaCarbon(): string[] {
  const fallas: string[] = []
  const raiz = document.querySelector<HTMLElement>('.hz-tablero')!
  const cs = getComputedStyle(raiz)
  if (raiz.dataset.tema !== 'carbon') fallas.push(`data-tema="${raiz.dataset.tema}"`)
  if (cs.backgroundColor !== 'rgb(20, 20, 20)') fallas.push(`fondo ${cs.backgroundColor}, se esperaba carbón #141414`)
  if (cs.color !== 'rgb(220, 236, 255)') fallas.push(`tinta ${cs.color}, se esperaba hielo #DCECFF`)
  const firma = document.querySelector('.hz-cab .hz-firma')
  if (firma?.textContent?.replace(/\s+/g, ' ').trim() !== 'Horizontes por Estratek »') fallas.push(`firma «${firma?.textContent}»`)
  const flecha = document.querySelector('.hz-firma-flecha')
  if (!flecha || getComputedStyle(flecha).color !== 'rgb(52, 135, 255)') fallas.push(`» sin el azul de acción #3487FF`)
  const linea = getComputedStyle(document.querySelector('.hz-cab')!, '::after')
  if (!linea.backgroundImage.startsWith('linear-gradient')) fallas.push(`línea del encabezado sin degradado: ${linea.backgroundImage}`)
  if (Math.abs(parseFloat(linea.width) - document.documentElement.clientWidth) > 1) fallas.push(`línea del degradado de ${linea.width} en ${document.documentElement.clientWidth} px`)
  return fallas
}

/** Revisa en el navegador (cajas reales de texto) que las etiquetas de la matriz no se solapen. */
function solapesEtiquetas(): string[] {
  const svg = document.querySelector('svg.hz-matriz') as SVGSVGElement
  const W = Number(svg.getAttribute('width'))
  const H = Number(svg.getAttribute('height'))
  const m = 1 // 1 px de holgura: el halo blanco del texto ya separa.
  const cajas = [...svg.querySelectorAll<SVGTextElement>('text.hz-etq')].map((t) => {
    const b = t.getBBox()
    return { texto: t.textContent ?? '', fijo: t.classList.contains('hz-etq-fijo'), x: b.x + m, y: b.y + m, w: b.width - 2 * m, h: b.height - 2 * m }
  })
  const circulos = [...svg.querySelectorAll<SVGCircleElement>('circle')].map((c) => ({
    nombre: c.querySelector('title')?.textContent?.split(' · ')[0] ?? '',
    cx: Number(c.getAttribute('cx')),
    cy: Number(c.getAttribute('cy')),
    r: Number(c.getAttribute('r')),
  }))
  const fallas: string[] = []
  const nFijos = svg.querySelectorAll('circle.hz-fijo').length
  if (cajas.filter((c) => c.fijo).length !== nFijos) fallas.push('falta el nombre de algún proyecto fijo')
  cajas.forEach((a, i) => {
    if (a.x < 0 || a.y < 0 || a.x + a.w > W || a.y + a.h > H) fallas.push(`${a.texto} sale del lienzo`)
    for (const b of cajas.slice(i + 1)) {
      if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) fallas.push(`${a.texto} se solapa con ${b.texto}`)
    }
    if (!a.fijo) return
    for (const c of circulos) {
      const px = Math.min(Math.max(c.cx, a.x), a.x + a.w)
      const py = Math.min(Math.max(c.cy, a.y), a.y + a.h)
      if ((c.cx - px) ** 2 + (c.cy - py) ** 2 < c.r * c.r) fallas.push(`${a.texto} tapa la burbuja ${c.nombre}`)
    }
  })
  return fallas
}

interface ResultadoAnimacion {
  arranques: number
  duracion: number
  cuadros: number
  mediana: number
  maximo: number
  recorrido: number
  retroceso: number
  errorFinal: number
}

/**
 * Corre en el navegador: en cada cuadro anota si hay animación y, por burbuja R2, cuánto le falta para
 * llegar a su punto (`falta`) y el largo del tramo R1 → R2 (`tramo`), ambos con la geometría del SVG de
 * ese cuadro: así un redibujo con otro tamaño no se confunde con un retroceso.
 * `window.__anim()` resume: arranques, duración, intervalos entre cuadros, recorrido, retroceso (en px,
 * cuánto pierde el avance de un cuadro al siguiente) y error final.
 */
function registrarCuadros() {
  type Cuadro = { t: number; anim: boolean; avance: Record<string, { falta: number; tramo: number }> }
  const cuadros: Cuadro[] = []
  const centro = (c: Element) => {
    const b = c.getBoundingClientRect()
    return [b.x + b.width / 2, b.y + b.height / 2]
  }
  const paso = (t: number) => {
    const svg = document.querySelector('svg.hz-matriz')
    const avance: Cuadro['avance'] = {}
    let anim = false
    if (svg) {
      const sr = svg.getBoundingClientRect()
      const punto = (c: Element | null) => (c ? [sr.x + Number(c.getAttribute('cx')), sr.y + Number(c.getAttribute('cy'))] : null)
      svg.querySelectorAll<SVGCircleElement>('circle.hz-r2').forEach((c) => {
        const id = c.dataset.proyecto!
        const [ax, ay] = centro(c)
        const [fx, fy] = punto(c)!
        const r1 = punto(svg.querySelector(`circle.hz-r1[data-proyecto="${id}"]`))
        avance[id] = { falta: Math.hypot(ax - fx, ay - fy), tramo: r1 ? Math.hypot(r1[0] - fx, r1[1] - fy) : 0 }
        anim ||= c.classList.contains('hz-anim-mov')
      })
    }
    cuadros.push({ t, anim, avance })
    requestAnimationFrame(paso)
  }
  requestAnimationFrame(paso)
  ;(window as unknown as { __anim: () => ResultadoAnimacion }).__anim = () => {
    const arranques = cuadros.filter((c, i) => c.anim && !cuadros[i - 1]?.anim).length
    const con = cuadros.filter((c) => c.anim)
    const intervalos = con.slice(1).map((c, i) => c.t - con[i].t).sort((a, b) => a - b)
    const ultimo = cuadros[cuadros.length - 1]
    let recorrido = 0
    let retroceso = 0
    for (const id of Object.keys(ultimo.avance)) {
      const a = con.map((c) => c.avance[id]).filter((x) => x && x.tramo > 0)
      const hecho = a.map((x) => 1 - x.falta / x.tramo)
      recorrido = Math.max(recorrido, ...a.map((x) => x.tramo * (Math.max(...hecho) - Math.min(...hecho))))
      for (let i = 1; i < a.length; i++) retroceso = Math.max(retroceso, (hecho[i - 1] - hecho[i]) * a[i].tramo)
    }
    return {
      arranques,
      duracion: con.length ? Math.round(con[con.length - 1].t - con[0].t) : 0,
      cuadros: con.length,
      mediana: Math.round(intervalos[Math.floor(intervalos.length / 2)] ?? 0),
      maximo: Math.round(intervalos[intervalos.length - 1] ?? 0),
      recorrido: Math.round(recorrido),
      retroceso,
      errorFinal: Math.max(0, ...Object.values(ultimo.avance).map((x) => x.falta)),
    }
  }
}
