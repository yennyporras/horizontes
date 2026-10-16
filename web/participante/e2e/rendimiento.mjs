// Medición manual de la carga inicial del participante en un celular de 360 px con 4G simulada y CPU 4x más lenta.
// Perfiles: "4g" (Fast 4G de DevTools: 9 Mbps, 165 ms) y "lento" (móvil de Lighthouse: 1,6 Mbps, 150 ms).
// Uso: node web/participante/e2e/rendimiento.mjs http://127.0.0.1:8802/m/CODIGO-1 [repeticiones] [4g|lento]
// Requiere el build de producción servido por el servidor (npm run build && npm start).
import { chromium } from 'playwright-core'

const [url, veces = '3', perfil = '4g'] = process.argv.slice(2)
const RED = {
  '4g': { latency: 165, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 },
  lento: { latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 },
}[perfil]
if (!url) {
  console.error('Uso: node rendimiento.mjs URL_DE_MESA [repeticiones]')
  process.exit(1)
}

const browser = await chromium.launch({ executablePath: process.env.PW_EXE || undefined, args: ['--disable-gpu'] })
const resultados = []
for (let i = 0; i < Number(veces); i++) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  await cdp.send('Network.emulateNetworkConditions', { offline: false, ...RED })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  let bytes = 0
  cdp.on('Network.loadingFinished', (e) => (bytes += e.encodedDataLength))
  await page.addInitScript(() => {
    window.__cls = 0
    window.__lcp = 0
    new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: 'layout-shift', buffered: true })
    new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: 'largest-contentful-paint', buffered: true })
  })
  const t0 = Date.now()
  await page.goto(url, { waitUntil: 'commit' })
  await page.locator('h1').first().waitFor({ state: 'visible', timeout: 30000 })
  const util = Date.now() - t0
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1500)
  const m = await page.evaluate(() => ({
    fcp: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
    lcp: window.__lcp,
    cls: window.__cls,
    h1: document.querySelector('h1')?.textContent,
  }))
  resultados.push({ util_ms: util, fcp_ms: Math.round(m.fcp), lcp_ms: Math.round(m.lcp), cls: Number(m.cls.toFixed(4)), kb: Math.round(bytes / 1024), h1: m.h1 })
  await ctx.close()
}
await browser.close()
console.log(`Perfil ${perfil}`)
console.table(resultados)
const util = resultados.map((r) => r.util_ms).sort((a, b) => a - b)
console.log(`Mediana hasta el título visible: ${util[Math.floor(util.length / 2)]} ms`)
