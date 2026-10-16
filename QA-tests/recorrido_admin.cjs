// Recorrido del panel admin en navegador real contra un servidor (local, contenedor o staging).
// Crea una sala desde el panel a 360 px y a 1920 px, inscribe y vota por API, recorre R1 -> precierre -> R2 -> sala cerrada,
// revisa desborde horizontal y errores de consola, y guarda capturas.
// Uso: PWCORE=<ruta a playwright-core> [CHROME=<ejecutable>] node QA-tests/recorrido_admin.cjs <url> <usuario> <clave> <carpeta-capturas>
const { chromium } = require(process.env.PWCORE)
const BASE = process.argv[2] || 'http://localhost:3999'
const USUARIO = process.argv[3] || 'paola', CLAVE = process.argv[4] || 'ensayo-local-123'
const OUT = process.argv[5] || '.'
const R = { alistamiento_tecnico: 7, conocimiento_cliente: 5, regulacion: 3, capacidades_organizacionales: 9, alineacion_core: 7, inversion_requerida: 5 }
async function api(m, ruta, cuerpo, h = {}) {
  const r = await fetch(BASE + ruta, { method: m, headers: { 'content-type': 'application/json', 'user-agent': 'recorrido', ...h }, body: cuerpo && JSON.stringify(cuerpo) })
  const t = await r.text(); if (r.status >= 400) throw new Error(`${m} ${ruta} ${r.status} ${t}`); return t ? JSON.parse(t) : null
}
;(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'], executablePath: process.env.CHROME })
  const errores = []
  for (const [ancho, alto] of [[360, 780], [1920, 1080]]) {
    const p = await b.newPage({ viewport: { width: ancho, height: alto } })
    p.on('console', (m) => m.type() === 'error' && errores.push(`${ancho}: ${m.text()}`))
    await p.goto(BASE + '/admin/login')
    await p.getByLabel('Usuario').fill(USUARIO); await p.getByLabel('Clave', { exact: true }).fill(CLAVE)
    await p.getByRole('button', { name: 'Entrar' }).click()
    await p.getByRole('heading', { level: 1, name: 'Salas' }).waitFor()
    const nombre = `Recorrido ${ancho}px ${Date.now() % 100000}`
    await p.getByLabel('Nombre del taller').fill(nombre); await p.getByLabel('Mesas').fill('2')
    await p.getByRole('button', { name: 'Crear sala' }).click()
    await p.getByRole('heading', { name: 'Sala en vivo' }).waitFor()
    const salaId = p.url().match(/salas\/([^/]+)\/vivo/)[1]
    const estado = (t) => p.locator('.estado', { hasText: t }).first().waitFor({ timeout: 10000 })
    const pulsar = async (n, t) => { await p.getByRole('button', { name: n }).click(); await estado(t) }
    await pulsar('Abrir inscripción', 'Inscripción abierta')
    const mesas = (await p.evaluate(async (id) => (await (await fetch(`/api/admin/salas/${id}`)).json()).mesas, salaId))
    const toks = []
    for (const [i, m] of [mesas[0], mesas[0], mesas[1]].entries()) {
      const r = await api('POST', '/api/inscripcion', { codigoMesa: m.codigo, nombre: `Persona ${i}`, correo: `p${i}.${ancho}@ejemplo.co`, consentimiento: { aceptado: true, version: 'estratek-v1' } })
      toks.push(r.token)
    }
    await pulsar('Abrir ronda 1', 'Ronda 1 abierta')
    for (const t of toks.slice(0, 2)) for (const pr of ['insumex', 'nutriwhat']) await api('PUT', '/api/votos', { proyecto_id: pr, ronda: 1, respuestas: R }, { 'x-participante-token': t })
    await p.getByText(/Todos votaron en Mesa 1/).waitFor({ timeout: 10000 })
    await p.screenshot({ path: `${OUT}/vivo-precierre-${ancho}.png`, fullPage: true })
    await pulsar('Cerrar ronda 1', 'Ronda 1 cerrada')
    await pulsar('Abrir ronda 2', 'Ronda 2 abierta')
    for (const t of toks) for (const pr of ['insumex', 'nutriwhat']) await api('PUT', '/api/votos', { proyecto_id: pr, ronda: 2, respuestas: { ...R, regulacion: 9 } }, { 'x-participante-token': t })
    await p.getByText(/Todos votaron en la sala/).waitFor({ timeout: 10000 })
    await pulsar('Cerrar ronda 2', 'Ronda 2 cerrada')
    await p.getByRole('button', { name: 'Cerrar sala' }).click()
    await p.getByRole('button', { name: 'Sí, cerrar la sala' }).click()
    await estado('Sala cerrada')
    for (const s of ['mesas', 'participantes', 'configuracion', 'export']) {
      await p.goto(`${BASE}/admin/salas/${salaId}/${s}`); await p.waitForLoadState('networkidle')
      const desborde = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      if (desborde) errores.push(`${ancho}: desborde horizontal en ${s}`)
      await p.screenshot({ path: `${OUT}/${s}-${ancho}.png`, fullPage: true })
    }
    const tablero = await api('GET', `/api/tablero/${salaId}?alcance=sala&t=${(await p.evaluate(async (id) => (await (await fetch(`/api/admin/salas/${id}`)).json()).sala.token_tablero, salaId))}`).catch((e) => ({ error: e.message }))
    console.log(`${ancho}px: sala ${salaId} recorrida hasta cerrada; tablero:`, JSON.stringify(tablero.proyectos_vivos?.map((v) => [v.id, v.rondas.map((r) => [r.n_votos, r.eje_x, r.eje_y])]) ?? tablero))
    await p.close()
  }
  console.log('errores de consola o desborde:', errores.length ? errores : 'ninguno')
  await b.close()
})().catch((e) => { console.error(e); process.exit(1) })
