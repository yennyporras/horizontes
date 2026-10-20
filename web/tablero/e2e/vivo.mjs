import { createRequire } from 'node:module'
const require = createRequire(process.env.PW_BASE + '/package.json')
const { chromium } = require('playwright-core')
const [web, api, usuario, clave, salaId, token] = process.argv.slice(2)
const login = await fetch(api + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario, clave }) })
const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
const browser = await chromium.launch({ executablePath: process.env.PW_EXE })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.goto(`${web}/tablero/${salaId}?t=${token}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForSelector('svg.hz-matriz circle.hz-r1', { timeout: 30000 })
const antes = await page.evaluate(() => ({
  meta: document.querySelector('.hz-cab-meta')?.textContent,
  avisos: [...document.querySelectorAll('.hz-avisos li')].map((l) => l.textContent),
  vista: document.querySelector('[aria-label="Vista de la matriz"] [aria-pressed="true"]')?.textContent,
}))
console.log('antes', JSON.stringify(antes))
const t0 = Date.now()
const r = await fetch(`${api}/api/admin/salas/${salaId}/acciones`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ accion: 'cerrar_ronda_1' }) })
console.log('cerrar_ronda_1 →', r.status)
await page.waitForFunction(() => document.querySelector('.hz-cab-meta')?.textContent?.includes('Ronda 1 cerrada'), null, { timeout: 15000 })
const ms = Date.now() - t0
const despues = await page.evaluate(() => ({ meta: document.querySelector('.hz-cab-meta')?.textContent, avisos: document.querySelectorAll('.hz-avisos li').length }))
console.log('después', JSON.stringify(despues), `actualizó en ${ms} ms`)
await browser.close()
process.exit(ms < 5000 ? 0 : 1)
