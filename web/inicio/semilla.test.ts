// La semilla completa (hojas de perfil, caso, insumos de los fijos) no viaja en los archivos públicos de la landing ni
// del celular: el celular recibe su hoja y el caso de la API, después de inscribirse. La landing lee un JSON mínimo.
// QA por roles del 20-oct: el chunk público de la landing traía la semilla entera (22 KB).
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { build, transformWithEsbuild } from 'vite'
import seed from '../../data/seed_foodsume.json'
import minima from './semilla_inicio.json'
import { proyectarSemilla } from './semilla'

const RAIZ = resolve(__dirname, '../..')

/**
 * Fragmentos de texto que solo existen en la semilla: tramos ASCII largos de cada hoja de perfil y del caso.
 * Solo ASCII porque el minificador escapa las tildes (`í`) y un fragmento con tildes nunca se encontraría.
 */
function fragmentos(): string[] {
  const textos = [...seed.plantilla.hojas.map((h) => h.texto), seed.plantilla.caso.descripcion_md]
  return textos.map((t) => {
    const tramos = t.match(/[A-Za-z0-9 ,.]{24,}/g) ?? []
    const largo = tramos.sort((a, b) => b.length - a.length)[0]
    if (!largo) throw new Error(`Sin tramo ASCII largo en: ${t.slice(0, 40)}`)
    return largo.trim().slice(0, 40)
  })
}

interface EntradaManifiesto {
  file: string
  imports?: string[]
  css?: string[]
}

/** Archivos que descarga quien abre la landing o el celular: la entrada y lo que importan de forma estática. */
function archivosDe(manifiesto: Record<string, EntradaManifiesto>, raices: string[]): string[] {
  const vistos = new Set<string>()
  const pendientes = [...raices]
  while (pendientes.length) {
    const clave = pendientes.pop()!
    if (vistos.has(clave)) continue
    const e = manifiesto[clave]
    if (!e) throw new Error(`No está en el manifiesto: ${clave}`)
    vistos.add(clave)
    pendientes.push(...(e.imports ?? []))
  }
  return [...vistos].map((k) => manifiesto[k].file)
}

describe('la semilla no se publica en la landing ni en el celular', () => {
  const salida = mkdtempSync(join(tmpdir(), 'hz-build-semilla-'))
  let manifiesto: Record<string, EntradaManifiesto>

  beforeAll(async () => {
    // El build de producción, como el del Dockerfile: vitest corre con NODE_ENV=test y Vite dejaría el código de
    // desarrollo (mocks, muestrario) en el resultado.
    const entorno = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      await build({
        configFile: join(RAIZ, 'vite.config.ts'),
        mode: 'production',
        logLevel: 'silent',
        build: { outDir: salida, emptyOutDir: true, manifest: 'manifiesto.json' },
      })
    } finally {
      process.env.NODE_ENV = entorno
    }
    manifiesto = JSON.parse(readFileSync(join(salida, 'manifiesto.json'), 'utf8'))
  }, 180_000)

  afterAll(() => rmSync(salida, { recursive: true, force: true }))

  it('los fragmentos se encuentran en la semilla minificada (la prueba sí ve una fuga)', async () => {
    const { code } = await transformWithEsbuild(`export default ${JSON.stringify(seed)}`, 'semilla.js', { minify: true })
    const fs = fragmentos()
    expect(fs).toHaveLength(seed.plantilla.hojas.length + 1)
    for (const f of fs) expect(code, f).toContain(f)
  })

  it('ningún archivo de la landing ni del celular trae textos de las hojas o del caso', () => {
    // Se miran la entrada (index.html), la landing y el celular. El panel (web/admin) todavía importa la semilla
    // completa y lo corrige su área; cuando lo haga, esta prueba puede mirar todos los archivos de assets.
    const archivos = archivosDe(manifiesto, ['index.html', 'inicio/PaginaInicio.tsx', 'participante/PaginaMesa.tsx'])
    expect(archivos.some((f) => f.includes('PaginaInicio'))).toBe(true)
    expect(archivos.some((f) => f.includes('PaginaMesa'))).toBe(true)
    const fs = fragmentos()
    for (const archivo of archivos) {
      const contenido = readFileSync(join(salida, archivo), 'utf8')
      for (const f of fs) expect(contenido.includes(f), `${archivo} trae «${f}» de la semilla`).toBe(false)
    }
  })

  it('el JSON mínimo de la landing es la proyección exacta de la semilla (si cambia la semilla, se regenera)', () => {
    expect(minima).toEqual(proyectarSemilla(seed))
  })
})
