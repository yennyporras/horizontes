// QA del sistema integrado (admin + participante + tablero) en navegador real contra un servidor (contenedor local o staging).
// Por cada ancho (360 px y 1920 px): el admin crea la sala desde el panel, un participante se inscribe y vota por la UI
// las 2 rondas, otros votan por API, el tablero se mira en cada momento y se recorren todas las pantallas del panel.
// En cada pantalla revisa: desborde horizontal, rayas (—) en el texto, errores de consola y de página. Guarda capturas.
// Uso: PWCORE=<ruta a playwright-core> [CHROME=<ejecutable>] node QA-tests/recorrido_integrado.cjs <url> <usuario> <clave> <carpeta-capturas>
const { chromium } = require(process.env.PWCORE)
const BASE = process.argv[2] || 'http://localhost:3999'
const USUARIO = process.argv[3] || 'paola', CLAVE = process.argv[4] || 'ensayo-local-123'
const OUT = process.argv[5] || '.'
const R = { alistamiento_tecnico: 7, conocimiento_cliente: 5, regulacion: 3, capacidades_organizacionales: 9, alineacion_core: 7, inversion_requerida: 5 }
const T = 20000
const hallazgos = []
const nota = (s) => { hallazgos.push(s); console.log('HALLAZGO', s) }

async function api(m, ruta, cuerpo, h = {}) {
  const r = await fetch(BASE + ruta, { method: m, headers: { 'content-type': 'application/json', 'user-agent': 'qa-integrado', ...h }, body: cuerpo && JSON.stringify(cuerpo) })
  const t = await r.text(); if (r.status >= 400) throw new Error(`${m} ${ruta} ${r.status} ${t}`); return t ? JSON.parse(t) : null
}

/** Revisa la pantalla actual y guarda la captura. */
async function revisar(p, ancho, nombre) {
  await p.waitForTimeout(400)
  const r = await p.evaluate(() => ({
    desborde: document.documentElement.scrollWidth - window.innerWidth,
    raya: (document.body.innerText.match(/.{0,30}—.{0,30}/) || [null])[0],
    vacio: document.body.innerText.trim().length < 20,
  }))
  if (r.desborde > 0) nota(`${ancho}px ${nombre}: desborde horizontal de ${r.desborde} px`)
  if (r.raya) nota(`${ancho}px ${nombre}: raya en el texto: "${r.raya}"`)
  if (r.vacio) nota(`${ancho}px ${nombre}: pantalla casi vacía`)
  await p.screenshot({ path: `${OUT}/${ancho}-${nombre}.png`, fullPage: true })
}

function vigilar(p, ancho, quien) {
  p.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    if (/401/.test(t) && quien === 'admin') return // /api/admin/yo antes del login
    if (/404/.test(t) && quien === 'participante' && p.url().includes('ZZZZZ')) return // mesa inexistente, a propósito
    nota(`${ancho}px ${quien}: consola: ${t.slice(0, 200)}`)
  })
  p.on('pageerror', (e) => nota(`${ancho}px ${quien}: error de página: ${e.message.slice(0, 200)}`))
}

async function calificar(p, valor) {
  const grupos = p.locator('fieldset.hz-rubrica')
  const n = await grupos.count()
  for (let i = 0; i < n; i++) await grupos.nth(i).locator('label.hz-opcion', { has: p.locator(`input[value="${valor}"]`) }).click()
}

async function votarUI(p, ancho, ronda, valores) {
  for (const [proy, v] of valores) {
    await p.getByRole('button', { name: new RegExp(`^(Calificar|Editar) ${proy}$`) }).click({ timeout: T })
    await p.getByRole('heading', { level: 1, name: proy }).waitFor({ timeout: T })
    await calificar(p, v)
    await revisar(p, ancho, `part-r${ronda}-calificar-${proy}`)
    await p.getByRole('button', { name: 'Guardar calificación' }).click()
    await p.getByText(`Calificación de ${proy} guardada.`).first().waitFor({ timeout: T }).catch(() => {})
  }
}

;(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'], executablePath: process.env.CHROME })
  for (const [ancho, alto] of [[360, 780], [1920, 1080]]) {
    const ctxA = await b.newContext({ viewport: { width: ancho, height: alto } })
    const ctxP = await b.newContext({ viewport: { width: ancho, height: alto }, isMobile: ancho < 800, hasTouch: ancho < 800 })
    const ctxT = await b.newContext({ viewport: { width: ancho, height: alto } })
    const a = await ctxA.newPage(); vigilar(a, ancho, 'admin')
    const p = await ctxP.newPage(); vigilar(p, ancho, 'participante')
    const t = await ctxT.newPage(); vigilar(t, ancho, 'tablero')
    const paso = async (nombre, fn) => { try { await fn() } catch (e) { nota(`${ancho}px ${nombre}: FALLÓ ${e.message.split('\n')[0].slice(0, 220)}`) } }

    // --- Admin: login y sala nueva ---
    await a.goto(BASE + '/admin/login')
    await revisar(a, ancho, 'admin-login')
    await a.getByLabel('Usuario').fill(USUARIO); await a.getByLabel('Clave', { exact: true }).fill(CLAVE)
    await a.getByRole('button', { name: 'Entrar' }).click()
    await a.getByRole('heading', { level: 1, name: 'Salas' }).waitFor({ timeout: T })
    await revisar(a, ancho, 'admin-salas')
    await a.getByLabel('Nombre del taller').fill(`QA integrado ${ancho}px ${Date.now() % 100000}`); await a.getByLabel('Mesas').fill('2')
    await a.getByRole('button', { name: 'Crear sala' }).click()
    await a.getByRole('heading', { name: 'Sala en vivo' }).waitFor({ timeout: T })
    const salaId = a.url().match(/salas\/([^/]+)\/vivo/)[1]
    const detalle = () => a.evaluate(async (id) => (await (await fetch(`/api/admin/salas/${id}`)).json()), salaId)
    const pulsar = async (n, txt) => { await a.getByRole('button', { name: n }).click(); await a.locator('.estado', { hasText: txt }).first().waitFor({ timeout: T }) }
    await revisar(a, ancho, 'admin-vivo-preparada')
    const d0 = await detalle()
    const [m1, m2] = d0.mesas
    const urlTablero = d0.sala.url_tablero.replace(/^https?:\/\/[^/]+/, BASE)

    // Tablero antes de empezar (estado vacío)
    await paso('tablero vacío', async () => { await t.goto(urlTablero); await t.locator('svg.hz-matriz').first().waitFor({ timeout: T }); await revisar(t, ancho, 'tablero-preparada') })

    // Participante: mesa con inscripción cerrada
    await paso('participante antes de inscripción', async () => { await p.goto(`${BASE}/m/${m1.codigo}`); await p.waitForTimeout(2500); await revisar(p, ancho, 'part-inscripcion-cerrada') })
    await paso('mesa inexistente', async () => { await p.goto(`${BASE}/m/ZZZZZ-9`); await p.waitForTimeout(2500); await revisar(p, ancho, 'part-mesa-inexistente') })

    await pulsar('Abrir inscripción', 'Inscripción abierta')

    // --- Participante: inscripción por la UI ---
    await paso('inscripción UI', async () => {
      await p.goto(`${BASE}/m/${m1.codigo}`)
      await p.getByLabel('Tu nombre').waitFor({ timeout: T })
      await revisar(p, ancho, 'part-inscripcion')
      await p.getByLabel('Tu nombre').fill('Ana QA'); await p.getByLabel('Tu correo').fill(`ana.${ancho}.${Date.now() % 100000}@ejemplo.co`)
      await p.getByRole('checkbox').check()
      await p.getByRole('button', { name: 'Inscribirme' }).click()
      await p.getByRole('heading', { level: 1, name: /^Tu perfil es / }).waitFor({ timeout: T })
      await revisar(p, ancho, 'part-perfil')
      await p.getByRole('button', { name: 'Leer el caso' }).click()
      await p.getByRole('heading', { level: 1, name: 'El caso y tu hoja' }).waitFor({ timeout: T })
      await revisar(p, ancho, 'part-caso')
      await p.getByRole('tab', { name: 'Tu hoja' }).click()
      await revisar(p, ancho, 'part-hoja')
    })

    // Otros dos en la mesa 1 y uno en la mesa 2 (por API)
    const versionAviso = (await api('GET', `/api/mesas/${m1.codigo}`)).consentimiento.version
    const otros = []
    for (const [i, m] of [m1, m1, m2].entries()) {
      const r = await api('POST', '/api/inscripcion', { codigoMesa: m.codigo, nombre: `Otro ${i}`, correo: `otro${i}.${ancho}.${Date.now() % 100000}@ejemplo.co`, consentimiento: { aceptado: true, version: versionAviso } })
      otros.push(r.token)
    }
    const votarOtros = async (ronda, toks, extra = {}) => { for (const tk of toks) for (const pr of ['insumex', 'nutriwhat']) await api('PUT', '/api/votos', { proyecto_id: pr, ronda, respuestas: { ...R, ...extra } }, { 'x-participante-token': tk }) }

    // --- Ronda 1 ---
    await pulsar('Abrir ronda 1', 'Ronda 1 abierta')
    await paso('R1 votar UI', async () => {
      await p.getByRole('button', { name: 'Calificar proyectos' }).click({ timeout: T })
      await p.getByRole('heading', { level: 1, name: 'Ronda 1: califica los 2 proyectos' }).waitFor({ timeout: T })
      await revisar(p, ancho, 'part-r1-elegir')
      await votarUI(p, ancho, 1, [['INSUMEX', 7], ['NUTRIWHAT', 3]])
      await p.getByRole('heading', { level: 1, name: 'Voto registrado' }).waitFor({ timeout: T })
      await revisar(p, ancho, 'part-r1-registrado')
    })
    await votarOtros(1, [otros[0], otros[2]])
    await paso('tablero R1 en curso', async () => { await t.waitForTimeout(3500); await revisar(t, ancho, 'tablero-r1-parcial') })
    await votarOtros(1, [otros[1]])
    await paso('precierre admin', async () => { await a.getByText(/Todos votaron en la sala|Todos votaron en Mesa 1/).first().waitFor({ timeout: T }); await revisar(a, ancho, 'admin-vivo-precierre') })
    await paso('resultado preliminar admin R1', async () => { await a.getByRole('button', { name: 'Ver resultado de Mesa 1' }).click(); await a.getByRole('table', { name: 'INSUMEX' }).waitFor({ timeout: T }); await revisar(a, ancho, 'admin-vivo-resultado-r1') })
    await paso('precierre participante', async () => { await p.getByText('Preliminar', { exact: true }).first().waitFor({ timeout: T }); await p.locator('svg.hz-matriz').first().waitFor({ timeout: T }); await revisar(p, ancho, 'part-r1-preliminar') })
    await paso('tablero precierre', async () => { await t.waitForTimeout(3000); await revisar(t, ancho, 'tablero-r1-precierre') })
    await pulsar('Cerrar ronda 1', 'Ronda 1 cerrada')
    await paso('R1 cerrada participante', async () => { await p.getByRole('heading', { level: 1, name: 'Ronda 1 cerrada' }).waitFor({ timeout: T }); await revisar(p, ancho, 'part-r1-cerrada') })

    // --- Ronda 2 ---
    await pulsar('Abrir ronda 2', 'Ronda 2 abierta')
    await paso('R2 hojas', async () => {
      await p.getByRole('heading', { level: 1, name: 'Ronda 2: califica los 2 proyectos' }).waitFor({ timeout: T })
      await revisar(p, ancho, 'part-r2-elegir')
      await p.getByRole('button', { name: 'Leer el caso y las hojas' }).click()
      await p.getByRole('tab', { name: 'Hojas' }).click()
      await revisar(p, ancho, 'part-r2-hojas')
      await p.getByRole('button', { name: 'Calificar proyectos' }).click()
    })
    await paso('R2 votar UI', async () => {
      await votarUI(p, ancho, 2, [['INSUMEX', 9], ['NUTRIWHAT', 5]])
      await p.getByRole('heading', { level: 1, name: 'Voto registrado' }).waitFor({ timeout: T })
    })
    await votarOtros(2, otros, { regulacion: 9, alineacion_core: 9 })
    await paso('R2 precierre sala', async () => { await a.getByText('4 de 4', { exact: true }).first().waitFor({ timeout: T }); await a.locator('.etiqueta', { hasText: 'Precierre' }).nth(1).waitFor({ timeout: T }); await revisar(a, ancho, 'admin-vivo-precierre-r2') })
    await paso('resultado preliminar admin R2', async () => { await a.getByRole('button', { name: 'Ver resultado preliminar de la sala' }).click(); await a.getByRole('columnheader', { name: 'R2' }).first().waitFor({ timeout: T }); await revisar(a, ancho, 'admin-vivo-resultado-r2') })
    await pulsar('Cerrar ronda 2', 'Ronda 2 cerrada')
    await paso('R2 comparación participante', async () => { await p.getByRole('heading', { level: 1, name: 'Ronda 2 cerrada' }).waitFor({ timeout: T }); await p.locator('svg.hz-matriz .hz-r1').first().waitFor({ timeout: T }); await revisar(p, ancho, 'part-r2-comparacion') })
    await paso('tablero comparación', async () => { await t.waitForTimeout(4000); await revisar(t, ancho, 'tablero-comparacion') })
    await paso('tablero mesas', async () => { await t.goto(urlTablero + (urlTablero.includes('?') ? '&' : '?') + 'vista=mesas'); await t.waitForTimeout(4000); await revisar(t, ancho, 'tablero-mesas') })
    await paso('tablero sin token', async () => { await t.goto(`${BASE}/tablero/${salaId}`); await t.waitForTimeout(3000); await revisar(t, ancho, 'tablero-sin-token') })

    // --- Resto del panel ---
    for (const s of ['mesas', 'participantes', 'configuracion', 'export']) await paso(`admin ${s}`, async () => { await a.goto(`${BASE}/admin/salas/${salaId}/${s}`); await a.waitForLoadState('networkidle'); await revisar(a, ancho, `admin-${s}`) })
    await paso('país de la sala', async () => {
      await a.goto(`${BASE}/admin/salas/${salaId}/configuracion`); await a.getByLabel('País de la sala').selectOption('PE')
      await a.getByText('La sala quedó en Perú', { exact: false }).waitFor({ timeout: T }); await revisar(a, ancho, 'admin-configuracion-peru')
    })
    if (ancho > 800) await paso('hoja QR A4', async () => {
      await a.goto(`${BASE}/admin/salas/${salaId}/mesas`); await a.waitForLoadState('networkidle')
      await a.emulateMedia({ media: 'print' }); await a.screenshot({ path: `${OUT}/qr-impresion.png`, fullPage: true })
      await a.pdf({ path: `${OUT}/qr-a4.pdf`, preferCSSPageSize: true }); await a.emulateMedia({ media: 'screen' })
    })
    for (const s of ['administradores', 'salud']) await paso(`admin ${s}`, async () => { await a.goto(`${BASE}/admin/${s}`); await a.waitForLoadState('networkidle'); await revisar(a, ancho, `admin-${s}`) })

    // --- Cierre de la sala ---
    await a.goto(`${BASE}/admin/salas/${salaId}/vivo`)
    await paso('cerrar sala', async () => {
      await a.getByRole('button', { name: 'Cerrar sala' }).click()
      await a.getByRole('button', { name: 'Sí, cerrar la sala' }).click()
      await a.locator('.estado', { hasText: 'Sala cerrada' }).first().waitFor({ timeout: T })
      await revisar(a, ancho, 'admin-vivo-cerrada')
    })
    await paso('participante fin', async () => { await p.getByRole('heading', { level: 1, name: 'El taller terminó' }).waitFor({ timeout: T }); await revisar(p, ancho, 'part-fin') })
    const tab = await api('GET', `/api/tablero/${salaId}?alcance=sala&t=${d0.sala.token_tablero}`)
    console.log(`${ancho}px: sala ${salaId}:`, JSON.stringify(tab.proyectos_vivos.map((v) => [v.id, v.rondas.map((r) => [r.n_votos, r.eje_x, r.eje_y])])))
    await ctxA.close(); await ctxP.close(); await ctxT.close()
  }
  await b.close()
  console.log(`\n${hallazgos.length} hallazgos`)
  for (const h of hallazgos) console.log(' -', h)
})().catch((e) => { console.error(e); process.exit(1) })
