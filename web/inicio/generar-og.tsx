// Genera web/public/og-horizontes.png (1200x630), la imagen que se ve al compartir el enlace de la landing:
// el glifo, «Horizontes por Estratek» y la misma matriz ilustrada del héroe, en el tema carbón con los tokens de la app.
// `npx tsx web/inicio/generar-og.tsx` (necesita Chromium de Playwright, igual que las pruebas en navegador; o PW_EXE).
// No lo importa la app.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from 'playwright-core'
import { LogoHorizontes } from '../shared/ui/marca/LogoHorizontes'
import { MatrizIlustrada } from './MatrizIlustrada'

export const ANCHO_OG = 1200
export const ALTO_OG = 630

const RAIZ = fileURLToPath(new URL('../../', import.meta.url))
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8')
const fuente = pathToFileURL(join(RAIZ, 'node_modules/@fontsource-variable/montserrat/files/montserrat-latin-wght-normal.woff2')).href

const matriz = renderToStaticMarkup(<MatrizIlustrada />)
const glifo = renderToStaticMarkup(<LogoHorizontes tamano={120} />)

const html = `<!doctype html>
<html lang="es-CO" data-tema="carbon">
<head>
<meta charset="utf-8" />
<style>
@font-face { font-family: 'Montserrat Variable'; font-weight: 100 900; src: url('${fuente}') format('woff2'); }
${leer('web/shared/ui/tokens.css')}
${leer('web/inicio/inicio.css')}
* { box-sizing: border-box; margin: 0; }
body {
  width: ${ANCHO_OG}px; height: ${ALTO_OG}px; overflow: hidden; position: relative;
  background: var(--hz-fondo); color: var(--hz-tinta); font-family: var(--hz-fuente);
  display: grid; grid-template-columns: minmax(0, 1fr) 440px; align-items: center; gap: 48px; padding: 56px 64px 64px;
}
body::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 10px; background: var(--hz-grad-marca); }
.marca { display: grid; gap: 28px; align-content: center; }
.nombre { font-size: 100px; font-weight: 900; line-height: 0.9; letter-spacing: -0.04em; }
.firma { font-size: 40px; font-weight: 700; color: var(--hz-tinta-2); }
.firma b { color: var(--hz-accion); font-weight: 900; }
.lema { font-size: 30px; font-weight: 500; line-height: 1.3; color: var(--hz-tinta-2); max-width: 22ch; }
.in-matriz { width: 440px; min-width: 0; }
.in-matriz figcaption { display: none; }
.in-matriz__eje { font-size: 3.6px; }
</style>
</head>
<body>
  <div class="marca">
    ${glifo}
    <div>
      <p class="nombre">Horizontes</p>
      <p class="firma">por Estratek <b>»</b></p>
    </div>
    <p class="lema">Prioriza el portafolio por horizontes, mesa por mesa y en dos rondas.</p>
  </div>
  ${matriz}
</body>
</html>`

const carpeta = mkdtempSync(join(tmpdir(), 'hz-og-'))
const pagina = join(carpeta, 'og.html')
writeFileSync(pagina, html)
const navegador = await chromium.launch(process.env.PW_EXE ? { executablePath: process.env.PW_EXE } : {})
try {
  const p = await navegador.newPage({ viewport: { width: ANCHO_OG, height: ALTO_OG }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await p.goto(pathToFileURL(pagina).href)
  await p.evaluate(() => document.fonts.ready)
  const destino = join(RAIZ, 'web/public/og-horizontes.png')
  await p.screenshot({ path: destino, type: 'png' })
  console.log(`Escrito ${destino}`)
} finally {
  await navegador.close()
  rmSync(carpeta, { recursive: true, force: true })
}
