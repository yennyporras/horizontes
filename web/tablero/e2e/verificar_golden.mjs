// Abre el tablero real, lee los círculos del SVG y los convierte a valores con las marcas del eje.
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(process.env.PW_BASE + '/package.json')
const { chromium } = require('playwright-core')
const [url, rutaGolden, salida] = process.argv.slice(2)
const esperado = JSON.parse(readFileSync(rutaGolden, 'utf8')).prueba_sintetica.esperado
const browser = await chromium.launch({ executablePath: process.env.PW_EXE })
let fallas = 0
for (const [w, h] of [[1920, 1080], [1366, 768], [360, 740]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('svg.hz-matriz circle.hz-r2', { timeout: 30000 })
  await page.waitForTimeout(2000) // fin de cualquier animación
  const r = await page.evaluate(() => {
    const svg = document.querySelector('svg.hz-matriz')
    const textos = [...svg.querySelectorAll('text')]
    // marcas: texto numérico; eje X con text-anchor middle bajo el plano, eje Y con text-anchor end
    const tx = textos.filter((t) => /^\d$/.test(t.textContent) && t.getAttribute('text-anchor') === 'middle').map((t) => [Number(t.textContent), Number(t.getAttribute('x'))])
    const ty = textos.filter((t) => /^\d$/.test(t.textContent) && t.getAttribute('text-anchor') === 'end').map((t) => [Number(t.textContent), Number(t.getAttribute('y'))])
    const circ = [...svg.querySelectorAll('circle.hz-r1, circle.hz-r2')].map((c) => ({ p: c.dataset.proyecto, r: c.classList.contains('hz-r1') ? 1 : 2, cx: Number(c.getAttribute('cx')), cy: Number(c.getAttribute('cy')) }))
    return { tx, ty, circ, vista: document.querySelector('.hz-segmento [aria-pressed="true"]')?.textContent, estado: document.querySelector('.hz-cab-meta span')?.textContent }
  })
  const lin = (pares) => { const [a, b] = [pares[0], pares[pares.length - 1]]; const m = (b[1] - a[1]) / (b[0] - a[0]); return (px) => a[0] + (px - a[1]) / m }
  const vx = lin(r.tx), vy = lin(r.ty)
  const lineas = []
  for (const c of r.circ) {
    const e = esperado[c.p.toUpperCase()][String(c.r)]
    const dx = Math.abs(vx(c.cx) - e.eje_x), dy = Math.abs(vy(c.cy) - e.eje_y)
    // r2() del SVG redondea a 0,01 px: la tolerancia en valor es 0,001 más ese medio centésimo de píxel
    const tol = 0.001 + 0.005 * Math.abs(9 / (r.tx[r.tx.length - 1][1] - r.tx[0][1]))
    const ok = dx <= tol && dy <= tol
    if (!ok) fallas++
    lineas.push(`${ok ? 'OK' : 'FALLA'} ${c.p} R${c.r} x=${vx(c.cx).toFixed(4)} (golden ${e.eje_x}) y=${vy(c.cy).toFixed(4)} (golden ${e.eje_y})`)
  }
  await page.screenshot({ path: `${salida}/real-${w}.png`, fullPage: w < 1100 })
  console.log(`${w}px · ${r.estado} · vista ${r.vista}\n  ` + lineas.join('\n  '))
  await page.close()
}
await browser.close()
console.log(fallas ? `FALLAS: ${fallas}` : 'GOLDEN OK')
process.exit(fallas ? 1 : 0)
