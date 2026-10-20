// Recorrido del panel admin en navegador real contra un servidor (local, contenedor o staging).
// Crea una sala desde el panel a 360 px y a 1920 px, inscribe y vota por API, recorre R1 -> precierre -> R2 -> sala cerrada,
// revisa desborde horizontal, contraste AA del texto visible y errores de consola, y guarda capturas.
// Después entra con un admin de rol admin (lo crea si no existe) y recorre cada sección de la misma sala (C19-2).
// Marca Estratek: también el login, Salud y Administradores, y que el foco con teclado se vea en la barra y en el contenido.
// QA del 20-oct: un solo botón principal (el paso que sigue), confirmaciones con el foco en Cancelar, Montserrat en los
// botones, áreas táctiles de 48 px, «Dar acceso de nuevo» (D1), menú plegable en el celular y, a 360, 768, 1280, 1440 y
// 1920 px, que la barra superior, el contenido y el pie compartan exactamente los mismos bordes, y cada sección sin
// desborde también a 768 y 1280 px.
// Uso: PWCORE=<ruta a playwright-core> [CHROME=<ejecutable>] node QA-tests/recorrido_admin.cjs <url> <usuario> <clave> <carpeta-capturas>
const { chromium } = require(process.env.PWCORE)
const BASE = process.argv[2] || 'http://localhost:3999'
const USUARIO = process.argv[3] || 'paola', CLAVE = process.argv[4] || 'ensayo-local-123'
const OUT = process.argv[5] || '.'
const ADMIN = { usuario: 'recorrido.admin', nombre: 'Admin de recorrido', clave: 'recorrido-admin-123' }
const R = { alistamiento_tecnico: 7, conocimiento_cliente: 5, regulacion: 3, capacidades_organizacionales: 9, alineacion_core: 7, inversion_requerida: 5 }
const SECCIONES = ['vivo', 'mesas', 'participantes', 'respuestas', 'hojas', 'configuracion', 'export']
const ANCHOS_BORDES = [360, 768, 1280, 1440, 1920]
async function api(m, ruta, cuerpo, h = {}) {
  const r = await fetch(BASE + ruta, { method: m, headers: { 'content-type': 'application/json', 'user-agent': 'recorrido', ...h }, body: cuerpo && JSON.stringify(cuerpo) })
  const t = await r.text(); if (r.status >= 400) throw new Error(`${m} ${ruta} ${r.status} ${t}`); return t ? JSON.parse(t) : null
}

/** Texto visible con contraste menor a AA (4,5:1; 3:1 si es grande). Considera fondos opacos y degradados de los ancestros. */
function contrasteBajo() {
  const rgb = (c) => (c.match(/[\d.]+/g) || []).map(Number)
  const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b) }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const fondos = (el) => {
    for (let e = el; e; e = e.parentElement) {
      const s = getComputedStyle(e)
      const img = s.backgroundImage.match(/rgba?\([^)]+\)/g)
      if (img) return img.map(rgb)
      const c = rgb(s.backgroundColor)
      if (c.length === 3 || c[3] === 1) return [c.slice(0, 3)]
    }
    return [[255, 255, 255]]
  }
  const malos = []
  for (const el of document.querySelectorAll('body *')) {
    const texto = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('')
    if (!texto || el.closest('[disabled], :disabled, [aria-hidden="true"]')) continue
    const s = getComputedStyle(el), caja = el.getBoundingClientRect()
    if (s.visibility === 'hidden' || caja.width === 0 || caja.height === 0) continue
    const tam = parseFloat(s.fontSize), grande = tam >= 24 || (tam >= 18.66 && Number(s.fontWeight) >= 700)
    const minimo = Math.min(...fondos(el).map((f) => ratio(rgb(s.color).slice(0, 3), f)))
    if (minimo < (grande ? 3 : 4.5)) malos.push(`${texto.slice(0, 40)} (${minimo.toFixed(2)})`)
  }
  return malos
}

/** QA-A-12 y QA-A-25: botones en Montserrat y controles visibles de al menos 48 px de alto (marca §4 y §5). */
function botonesYAreas() {
  const malos = []
  for (const b of document.querySelectorAll('.hz-admin button, .hz-admin .hz-boton, .hz-admin select, .hz-admin input:not([type=radio]):not([type=checkbox])')) {
    const caja = b.getBoundingClientRect()
    if (caja.width === 0 || caja.height === 0 || getComputedStyle(b).visibility === 'hidden') continue
    const nombre = (b.textContent || b.getAttribute('aria-label') || b.tagName).trim().slice(0, 30)
    if (!/Montserrat/i.test(getComputedStyle(b).fontFamily)) malos.push(`fuente ${getComputedStyle(b).fontFamily.slice(0, 20)} en ${nombre}`)
    if (caja.height < 47.5) malos.push(`${Math.round(caja.height)} px de alto en ${nombre}`)
  }
  return malos
}

/** Pedido del 20-oct: barra superior, contenido y pie con los mismos bordes (caja de contenido, sin el relleno). */
function bordes() {
  const caja = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect(), s = getComputedStyle(el)
    return { izq: Math.round(r.left + parseFloat(s.paddingLeft)), der: Math.round(r.right - parseFloat(s.paddingRight)) }
  }
  return { barra: caja('.hz-producto__fila'), contenido: caja('#contenido') || caja('.login__cuerpo'), pie: caja('.pie') }
}

async function revisar(p, nombre, ancho, errores) {
  await p.waitForLoadState('networkidle')
  if (await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) errores.push(`${ancho}: desborde horizontal en ${nombre}`)
  for (const m of await p.evaluate(contrasteBajo)) errores.push(`${ancho}: contraste bajo en ${nombre}: ${m}`)
  for (const m of await p.evaluate(botonesYAreas)) errores.push(`${ancho}: ${nombre}: ${m}`)
  if (await p.getByRole('heading', { name: 'Sin permiso' }).count()) errores.push(`${ancho}: "Sin permiso" en ${nombre}`)
  await p.screenshot({ path: `${OUT}/${nombre}-${ancho}.png`, fullPage: true })
}

/** Recorre con Tab los primeros controles y anota los que reciben el foco sin contorno visible (el foco que sale de la página queda en body). */
async function focoVisible(p, nombre, ancho, errores) {
  for (let i = 0; i < 6; i++) {
    await p.keyboard.press('Tab')
    const f = await p.evaluate(() => { const e = document.activeElement, s = getComputedStyle(e); return { t: (e.textContent || e.tagName).trim().slice(0, 30), ok: e === document.body || (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2) } })
    if (!f.ok) errores.push(`${ancho}: foco sin contorno en ${nombre}: ${f.t}`)
  }
}

async function entrar(p, usuario, clave) {
  await p.goto(BASE + '/admin/login')
  await p.getByLabel('Usuario').fill(usuario); await p.getByLabel('Clave', { exact: true }).fill(clave)
  await p.getByRole('button', { name: 'Entrar' }).click()
  await p.getByRole('heading', { level: 1, name: 'Salas' }).waitFor()
}

/** En el celular el menú está plegado (QA-A-23): se abre antes de elegir una sección. */
async function irA(p, seccion) {
  const menu = p.getByRole('button', { name: /^Menú/ })
  if (await menu.isVisible()) await menu.click()
  await p.getByRole('navigation', { name: 'Secciones del panel' }).getByRole('link', { name: seccion, exact: true }).click()
}

;(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'], executablePath: process.env.CHROME })
  const errores = []
  let ultimaSala = null
  for (const [ancho, alto] of [[360, 780], [1920, 1080]]) {
    const ctx = await b.newContext({ viewport: { width: ancho, height: alto } })
    const p = await ctx.newPage()
    await p.goto(BASE + '/admin/login')
    await revisar(p, 'login', ancho, errores)
    await focoVisible(p, 'login', ancho, errores)
    // Después de entrar: antes, el 401 de /api/admin/yo es lo esperado (aún no hay sesión).
    await entrar(p, USUARIO, CLAVE)
    p.on('console', (m) => m.type() === 'error' && errores.push(`${ancho}: ${m.text()}`))
    await revisar(p, 'salas', ancho, errores)
    await focoVisible(p, 'salas', ancho, errores)
    const nombre = `Recorrido ${ancho}px ${Date.now() % 100000}`
    await p.getByLabel('Nombre del taller').fill(nombre); await p.getByLabel('Mesas').fill('2')
    await p.getByRole('button', { name: 'Crear sala' }).click()
    await p.getByRole('heading', { name: 'Sala en vivo' }).waitFor()
    const salaId = p.url().match(/salas\/([^/]+)\/vivo/)[1]
    ultimaSala = salaId
    const estado = (t) => p.locator('.estado', { hasText: t }).first().waitFor({ timeout: 10000 })
    /** QA-A-01: lo que se pulsa es siempre el único botón principal. Si pide confirmación, el foco debe estar en Cancelar (QA-A-02). */
    const pulsar = async (n, t, confirmar) => {
      await p.getByRole('button', { name: n, exact: true }).waitFor()
      const principal = p.locator('.hz-boton--primario')
      if ((await principal.count()) !== 1 || (await principal.textContent()) !== n) errores.push(`${ancho}: el botón principal no es «${n}» sino ${JSON.stringify(await principal.allTextContents())}`)
      await p.getByRole('button', { name: n, exact: true }).click()
      if (confirmar) {
        const dialogo = p.getByRole('dialog')
        await dialogo.waitFor()
        const foco = await p.evaluate(() => document.activeElement?.textContent)
        if (foco !== 'Cancelar') errores.push(`${ancho}: el diálogo de «${n}» abre con el foco en «${foco}»`)
        await dialogo.getByRole('button', { name: confirmar }).click()
      }
      await estado(t)
    }
    await pulsar('Abrir inscripción', 'Inscripción abierta')
    const mesas = (await p.evaluate(async (id) => (await (await fetch(`/api/admin/salas/${id}`)).json()).mesas, salaId))
    const version = (await api('GET', `/api/mesas/${mesas[0].codigo}`)).consentimiento.version
    const toks = []
    for (const [i, m] of [mesas[0], mesas[0], mesas[0], mesas[1]].entries()) {
      const r = await api('POST', '/api/inscripcion', { codigoMesa: m.codigo, nombre: `Persona ${i}`, correo: `p${i}.${ancho}.${Date.now() % 100000}@ejemplo.co`, consentimiento: { aceptado: true, version } })
      toks.push(r.token)
    }
    await pulsar('Abrir ronda 1', 'Ronda 1 abierta')
    for (const t of toks.slice(0, 3)) for (const pr of ['insumex', 'nutriwhat']) await api('PUT', '/api/votos', { proyecto_id: pr, ronda: 1, respuestas: R }, { 'x-participante-token': t })
    await p.locator('#t-precierre', { hasText: 'Todos votaron en Mesa 1' }).waitFor({ timeout: 10000 })
    await p.getByRole('button', { name: 'Ver resultado de Mesa 1' }).click()
    await p.getByRole('heading', { name: /Resultado preliminar · Mesa 1/ }).waitFor()
    await revisar(p, 'vivo-precierre', ancho, errores)
    // QA-A-06: la persona de la Mesa 2 no votó; cerrar la ronda lo advierte.
    await pulsar('Cerrar ronda 1', 'Ronda 1 cerrada', 'Sí, cerrar la ronda 1')
    await pulsar('Abrir ronda 2', 'Ronda 2 abierta')
    for (const t of toks) for (const pr of ['insumex', 'nutriwhat']) await api('PUT', '/api/votos', { proyecto_id: pr, ronda: 2, respuestas: { ...R, regulacion: 9 } }, { 'x-participante-token': t })
    await p.locator('#t-precierre', { hasText: 'Todos votaron en la sala' }).waitFor({ timeout: 10000 })
    await revisar(p, 'vivo-r2', ancho, errores)

    // D1: «Dar acceso de nuevo» con el QR grande dentro de la pantalla.
    await p.goto(`${BASE}/admin/salas/${salaId}/participantes`)
    await p.getByRole('button', { name: 'Dar acceso de nuevo a Persona 0' }).click()
    const acceso = p.getByRole('dialog', { name: 'Acceso de nuevo para Persona 0' })
    await acceso.getByRole('img', { name: /Código QR del acceso/ }).waitFor()
    const qr = await acceso.getByRole('img', { name: /Código QR del acceso/ }).boundingBox()
    if (!qr || qr.width < Math.min(240, ancho * 0.6) || qr.x + qr.width > ancho) errores.push(`${ancho}: el QR del acceso de nuevo mide ${qr && Math.round(qr.width)} px o se sale`)
    await p.screenshot({ path: `${OUT}/acceso-de-nuevo-${ancho}.png` })
    await acceso.getByRole('button', { name: 'Listo' }).click()

    for (const s of SECCIONES) {
      await p.goto(`${BASE}/admin/salas/${salaId}/${s}`)
      await revisar(p, s, ancho, errores)
    }
    await p.goto(`${BASE}/admin/salas/${salaId}/vivo`)
    await pulsar('Cerrar ronda 2', 'Ronda 2 cerrada')
    // QA-A-01: con la ronda 2 cerrada, el paso que sigue es cerrar la sala.
    await pulsar('Cerrar sala', 'Sala cerrada', 'Sí, cerrar la sala')
    for (const s of ['salud', 'administradores']) {
      await p.goto(`${BASE}/admin/${s}`)
      await p.getByRole('heading', { level: 1 }).waitFor()
      await revisar(p, s, ancho, errores)
    }

    // Rol admin (C19-2): crea la cuenta si falta y recorre la misma sala desde un navegador sin sala recordada.
    const cuentas = await p.evaluate(async () => (await (await fetch('/api/admin/admins')).json()).admins)
    if (!cuentas.some((a) => a.usuario === ADMIN.usuario)) {
      await p.evaluate(async (a) => {
        const r = await fetch('/api/admin/admins', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: a.usuario, nombre: a.nombre, clave_temporal: a.clave }) })
        if (r.status !== 201) throw new Error(await r.text())
      }, ADMIN)
      const ca = await fetch(BASE + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ usuario: ADMIN.usuario, clave: ADMIN.clave }) })
      const cookie = ca.headers.get('set-cookie').split(';')[0]
      await api('POST', '/api/admin/cambiar-clave', { actual: ADMIN.clave, nueva: ADMIN.clave + '-ok' }, { cookie })
    }
    await ctx.close()
    const ctxAdmin = await b.newContext({ viewport: { width: ancho, height: alto } })
    const pa = await ctxAdmin.newPage()
    await entrar(pa, ADMIN.usuario, ADMIN.clave + '-ok')
    pa.on('console', (m) => m.type() === 'error' && errores.push(`${ancho} admin: ${m.text()}`))
    if (await pa.getByRole('link', { name: 'Administradores' }).count()) errores.push(`${ancho}: el admin ve Administradores`)
    await irA(pa, 'Respuestas')
    await pa.getByRole('heading', { name: 'Elige una sala' }).waitFor()
    await pa.getByRole('link', { name: nombre }).click()
    await pa.getByRole('heading', { name: 'Respuestas por persona' }).waitFor()
    for (const s of SECCIONES) {
      await pa.goto(`${BASE}/admin/salas/${salaId}/${s}`)
      await revisar(pa, `admin-${s}`, ancho, errores)
    }
    console.log(`${ancho}px: sala ${salaId} recorrida hasta cerrada, y por el rol admin`)
    await ctxAdmin.close()
  }

  // Bordes compartidos (pedido del 20-oct) en el login y en una sección, a cada ancho.
  for (const ancho of ANCHOS_BORDES) {
    const ctx = await b.newContext({ viewport: { width: ancho, height: 900 } })
    const p = await ctx.newPage()
    for (const [nombre, ir] of [
      ['login', () => p.goto(BASE + '/admin/login')],
      ['salas', () => entrar(p, USUARIO, CLAVE)],
    ]) {
      await ir()
      await p.waitForLoadState('networkidle')
      const m = await p.evaluate(bordes)
      const partes = Object.entries(m).filter(([, v]) => v)
      const [, ref] = partes[0]
      for (const [parte, v] of partes) if (Math.abs(v.izq - ref.izq) > 1 || Math.abs(v.der - ref.der) > 1) errores.push(`${ancho}: ${nombre}: bordes de ${parte} ${v.izq} a ${v.der} distintos de ${ref.izq} a ${ref.der}`)
      if (nombre === 'salas' && !m.pie) errores.push(`${ancho}: salas sin pie`)
      if (ancho >= 1440 && ref.der - ref.izq > 1280) errores.push(`${ancho}: ${nombre}: el contenido mide ${ref.der - ref.izq} px, más que el ancho de página`)
      console.log(`${ancho}px ${nombre}: ${partes.map(([k, v]) => `${k} ${v.izq}-${v.der}`).join(' · ')}`)
      await p.screenshot({ path: `${OUT}/bordes-${nombre}-${ancho}.png` })
    }
    // 768 y 1280 px (regla del 20-oct): cada sección sin desborde, con contraste, fuente y 48 px.
    if ((ancho === 768 || ancho === 1280) && ultimaSala) {
      for (const s of SECCIONES) {
        await p.goto(`${BASE}/admin/salas/${ultimaSala}/${s}`)
        await p.getByRole('heading', { level: 1 }).waitFor()
        await revisar(p, s, ancho, errores)
      }
      for (const s of ['salud', 'administradores']) {
        await p.goto(`${BASE}/admin/${s}`)
        await p.getByRole('heading', { level: 1 }).waitFor()
        await revisar(p, s, ancho, errores)
      }
    }
    await ctx.close()
  }
  console.log('errores de consola, desborde, contraste, fuente, áreas, bordes o permisos:', errores.length ? errores : 'ninguno')
  await b.close()
  process.exit(errores.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
