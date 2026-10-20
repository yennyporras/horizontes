import { createRequire } from 'node:module'
const require = createRequire(process.env.PW_BASE + '/package.json')
const { chromium } = require('playwright-core')
const base = process.argv[2]
const salida = process.argv[3]
const tamaños = [[1920, 1080], [1366, 768], [360, 740]]
const browser = await chromium.launch({ executablePath: process.env.PW_EXE })
for (const [w, h] of tamaños) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errores.push(m.text()))
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('svg.hz-matriz', { timeout: 15000 })
  await page.waitForTimeout(1200)
  const info = await page.evaluate(() => ({
    svg: [...document.querySelectorAll('svg.hz-matriz')].map((s) => s.getAttribute('width') + 'x' + s.getAttribute('height')),
    scroll: [document.documentElement.scrollWidth, document.documentElement.scrollHeight],
    lateral: (() => { const a = document.querySelector('.hz-lateral'); return a ? [a.clientHeight, a.scrollHeight, a.clientWidth] : null })(),
  }))
  await page.screenshot({ path: `${salida}/${process.env.PREFIJO ?? 'tablero'}-${w}.png`, fullPage: w < 1100 })
  console.log(w, JSON.stringify(info), errores.join(' | '))
  await page.close()
}
await browser.close()
