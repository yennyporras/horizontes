import { createRequire } from 'node:module'
const require = createRequire(process.env.PW_BASE + '/package.json')
const { chromium } = require('playwright-core')
const [base, salida] = process.argv.slice(2)
const browser = await chromium.launch({ executablePath: process.env.PW_EXE })
for (const [w, h] of [[1920, 1080], [360, 740]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForSelector('svg.hz-matriz', { timeout: 30000 })
  await page.getByRole('button', { name: 'Comparación' }).click()
  await page.waitForTimeout(350); await page.screenshot({ path: `${salida}/tablero-anim-${w}.png` })
  await page.waitForTimeout(2000)
  await page.evaluate(() => { window.__svg = document.querySelector('svg.hz-matriz') })
  await page.waitForTimeout(6000) // > 2 ciclos de polling
  const r = await page.evaluate(() => ({
    mismoSvg: window.__svg === document.querySelector('svg.hz-matriz'),
    flechas: document.querySelectorAll('.hz-flecha').length,
    r1: document.querySelectorAll('.hz-r1').length,
    pressed: document.querySelector('[aria-pressed="true"]')?.textContent,
  }))
  await page.screenshot({ path: `${salida}/tablero-comp-${w}.png`, fullPage: false })
  console.log(w, JSON.stringify(r), errores.join(' | '))
  await page.close()
}
await browser.close()
