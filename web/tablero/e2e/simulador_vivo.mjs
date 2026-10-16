// Aceptación R2: con el simulador de T1 corriendo, el tablero se actualiza en < 5 s y lo dibujado
// coincide con lo que calcula el servidor (que el simulador verifica de forma independiente).
// Espera la sala nueva del simulador, abre su tablero a 1920 px y cada 200 ms compara los puntos
// del SVG con los de la API. Mide cuánto tarda el dibujo en alcanzar cada cambio de la API.
// Uso: node simulador_vivo.mjs <webBase> <apiBase> <usuario> <clave> [salida]
import { chromium } from 'playwright-core'
const [web, apiBase, usuario, clave, salida] = process.argv.slice(2)
const exe = process.env.PW_EXE

const login = await fetch(apiBase + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario, clave }) })
const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
const get = async (ruta) => (await fetch(apiBase + ruta, { headers: { cookie } })).json()
// Navegador listo y Vite precalentado antes de que el simulador cree la sala.
const browser = await chromium.launch({ executablePath: exe, args: ['--disable-gpu'] })
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.goto(`${web}/tablero/calentamiento`, { waitUntil: 'networkidle' })
console.log('LISTO')
const inicio = Date.now()
let sala = null
while (!sala) {
  const { salas } = await get('/api/admin/salas')
  sala = salas.find((s) => s.nombre.startsWith('Simulación') && Date.parse(s.creada_at) >= inicio - 60_000 && s.estado !== 'cerrada') ?? null
  if (!sala) await new Promise((r) => setTimeout(r, 200))
}
const det = await get(`/api/admin/salas/${sala.id}`)
const token = det.sala.token_tablero
console.log(`Sala ${sala.codigo} (${sala.id}) detectada en ${Date.now() - inicio} ms`)

await page.goto(`${web}/tablero/${sala.id}?t=${token}`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('svg.hz-matriz')

const dibujados = () =>
  page.evaluate(() => {
    const svg = document.querySelector('svg.hz-matriz')
    if (!svg) return null
    const textos = [...svg.querySelectorAll('text')]
    const tx = textos.filter((t) => /^\d$/.test(t.textContent) && t.getAttribute('text-anchor') === 'middle').map((t) => [Number(t.textContent), Number(t.getAttribute('x'))])
    const ty = textos.filter((t) => /^\d$/.test(t.textContent) && t.getAttribute('text-anchor') === 'end').map((t) => [Number(t.textContent), Number(t.getAttribute('y'))])
    const lin = (p) => { const [a, b] = [p[0], p[p.length - 1]]; const m = (b[1] - a[1]) / (b[0] - a[0]); return (px) => a[0] + (px - a[1]) / m }
    const vx = lin(tx), vy = lin(ty)
    const out = {}
    for (const c of svg.querySelectorAll('circle.hz-r1, circle.hz-r2')) out[`${c.dataset.proyecto}-${c.classList.contains('hz-r1') ? 1 : 2}`] = [vx(Number(c.getAttribute('cx'))), vy(Number(c.getAttribute('cy')))]
    return { out, estado: document.querySelector('.hz-cab-meta span')?.textContent, vista: document.querySelector('.hz-segmento [aria-pressed="true"]')?.textContent }
  })

const delApi = (t) => {
  const out = {}
  for (const v of t.proyectos_vivos) for (const r of v.rondas) if (r.n_votos > 0 && r.eje_x != null) out[`${v.id}-${r.ronda}`] = [r.eje_x, r.eje_y]
  return out
}
// La vista elige qué rondas se dibujan; solo se comparan las que están en el SVG o deberían estar.
const coincide = (api, dom, estado) => {
  const rondas = estado === 'r2_cerrada' || estado === 'cerrada' ? [1, 2] : estado === 'r2_abierta' ? [2] : [1]
  for (const [k, [x, y]] of Object.entries(api)) {
    if (!rondas.includes(Number(k.split('-')[1]))) continue
    const d = dom[k]
    if (!d || Math.abs(d[0] - x) > 0.006 || Math.abs(d[1] - y) > 0.006) return false
  }
  return true
}

const ESTADO_TEXTO = { r1_abierta: 'Ronda 1 abierta', r1_cerrada: 'Ronda 1 cerrada', r2_abierta: 'Ronda 2 abierta', r2_cerrada: 'Ronda 2 cerrada', cerrada: 'Sala cerrada', inscripcion: 'Inscripción abierta', preparada: 'Sala preparada' }
// Cada estado distinto que entrega la API, con la hora en que lo vimos. Se resuelve cuando el SVG
// muestra ese estado o uno posterior: el retraso es lo que tardó el tablero en ponerse al día.
const pendientes = []
const retrasos = []
let ultimo = null
let fallasFinal = 0
for (;;) {
  const t = await get(`/api/tablero/${sala.id}`)
  const api = delApi(t)
  const firma = t.sala.estado + JSON.stringify(api)
  if (firma !== ultimo) {
    pendientes.push({ api, estado: t.sala.estado, desde: Date.now() })
    ultimo = firma
  }
  const dom = await dibujados()
  if (dom) {
    for (let i = pendientes.length - 1; i >= 0; i--) {
      const pd = pendientes[i]
      if (dom.estado === ESTADO_TEXTO[pd.estado] && coincide(pd.api, dom.out, pd.estado)) {
        for (const r of pendientes.splice(0, i + 1)) retrasos.push(Date.now() - r.desde)
        break
      }
    }
  }
  const viejo = pendientes[0] && Date.now() - pendientes[0].desde
  if (viejo > 10_000) { console.log(`Sin alcanzar un estado de la API tras ${viejo} ms`); fallasFinal++; break }
  if (t.sala.estado === 'cerrada' && pendientes.length === 0) {
    for (const [k, [x, y]] of Object.entries(api)) {
      const d = dom.out[k]
      const ok = d && Math.abs(d[0] - x) <= 0.006 && Math.abs(d[1] - y) <= 0.006
      if (!ok) fallasFinal++
      console.log(`  ${ok ? 'OK' : 'FALLA'} ${k}: dibujado x=${d?.[0].toFixed(4)} y=${d?.[1].toFixed(4)} · API x=${x.toFixed(4)} y=${y.toFixed(4)}`)
    }
    console.log(`  vista final: ${dom.vista}`)
    break
  }
  if (Date.now() - inicio > 15 * 60_000) { console.log('Tiempo agotado'); fallasFinal++; break }
  await new Promise((r) => setTimeout(r, 200))
}
if (salida) await page.screenshot({ path: `${salida}/simulador-final.png` })
await browser.close()
retrasos.sort((a, b) => a - b)
const max = retrasos[retrasos.length - 1]
const p95 = retrasos[Math.floor(retrasos.length * 0.95)]
console.log(`Estados de la API dibujados: ${retrasos.length} · retraso p95 ${p95} ms · máx ${max} ms`)
const ok = fallasFinal === 0 && max < 5000
console.log(ok ? 'TABLERO EN VIVO OK' : 'TABLERO EN VIVO CON FALLAS')
process.exit(ok ? 0 : 1)
