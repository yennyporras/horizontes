// Hoja de QR A4 en PDF de una sala: la misma vista imprimible del panel (Mesas y QR → Imprimir), guardada sin abrir el navegador.
// Los QR apuntan a BASE_URL del servidor: genera la hoja contra producción (o staging) cuando ese dominio ya responda.
// Uso: HZ_ADMIN_CLAVE=<clave> [PWCORE=<ruta a playwright-core>] [CHROME=<ejecutable>] \
//        node QA-tests/hoja_qr_pdf.cjs <url> <usuario> <código o id de la sala> [salida.pdf]
// Ejemplo: HZ_ADMIN_CLAVE=... node QA-tests/hoja_qr_pdf.cjs https://horizontes.estratek.com.co paola HZ7K2 hoja-qr.pdf
const path = require('node:path')
const { chromium } = require(process.env.PWCORE || path.resolve('node_modules/playwright-core'))

const [BASE, USUARIO, SALA, SALIDA = `hoja-qr-${process.argv[4]}.pdf`] = process.argv.slice(2)
const CLAVE = process.env.HZ_ADMIN_CLAVE
if (!BASE || !USUARIO || !SALA || !CLAVE) {
  console.error('Uso: HZ_ADMIN_CLAVE=<clave> node QA-tests/hoja_qr_pdf.cjs <url> <usuario> <código o id de la sala> [salida.pdf]')
  process.exit(2)
}
const base = BASE.replace(/\/$/, '')

;(async () => {
  const b = await chromium.launch({ args: ['--disable-gpu'], executablePath: process.env.CHROME })
  try {
    const ctx = await b.newContext()
    const login = await ctx.request.post(`${base}/api/admin/login`, { data: { usuario: USUARIO, clave: CLAVE } })
    if (!login.ok()) throw new Error(`No se pudo iniciar sesión (${login.status()}): revisa usuario y clave.`)
    const lista = await (await ctx.request.get(`${base}/api/admin/salas`)).json()
    const salas = Array.isArray(lista) ? lista : lista.salas
    const sala = salas.find((s) => s.codigo === SALA.toUpperCase() || s.id === SALA)
    if (!sala) throw new Error(`No existe la sala ${SALA}. Salas: ${salas.map((s) => s.codigo).join(', ') || 'ninguna'}.`)
    const detalle = await (await ctx.request.get(`${base}/api/admin/salas/${sala.id}`)).json()
    if (detalle.mesas.length === 0) throw new Error(`La sala ${sala.codigo} no tiene mesas.`)
    const ajenas = detalle.mesas.filter((m) => !m.url_participante.startsWith(base))
    if (ajenas.length) console.warn(`AVISO: los QR apuntan a ${new URL(ajenas[0].url_participante).origin}, no a ${base}. Revisa BASE_URL en Coolify antes de imprimir.`)

    const p = await ctx.newPage()
    await p.goto(`${base}/admin/salas/${sala.id}/mesas`)
    await p.getByRole('heading', { name: 'Mesas y QR' }).waitFor()
    await p.waitForFunction((n) => {
      const imgs = [...document.querySelectorAll('.qr-tarjeta img')]
      return imgs.length === n && imgs.every((i) => i.complete && i.naturalWidth > 0)
    }, detalle.mesas.length)
    await p.emulateMedia({ media: 'print' })
    await p.pdf({ path: SALIDA, preferCSSPageSize: true, printBackground: true })
    console.log(`Listo: ${SALIDA} · ${sala.nombre} · ${detalle.mesas.length} mesas en ${Math.ceil(detalle.mesas.length / 4)} hoja(s) A4.`)
  } finally {
    await b.close()
  }
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
