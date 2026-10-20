// README en formato vitrina (QA por roles del 20-oct, jurado): capturas arriba, diagrama de arquitectura, prueba en
// 2 comandos y resumen en inglés de 10 líneas al final.
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readme = readFileSync('README.md', 'utf8')

describe('README en formato vitrina', () => {
  it('abre con 3 capturas que existen, antes de cualquier sección', () => {
    const antes = readme.slice(0, readme.indexOf('\n## '))
    const imagenes = [...antes.matchAll(/<img src="([^"]+)" alt="([^"]+)"/g)]
    expect(imagenes).toHaveLength(3)
    for (const [, src, alt] of imagenes) {
      expect(existsSync(src), src).toBe(true)
      expect(readFileSync(src).subarray(1, 4).toString('ascii'), src).toBe('PNG')
      expect(alt.length).toBeGreaterThan(20)
    }
  })

  it('se prueba en 2 comandos: npm ci y npm run dev', () => {
    const seccion = readme.split('## Probarlo en 2 comandos')[1].split('\n## ')[0]
    const bloque = /```bash\n([\s\S]*?)```/.exec(seccion)![1]
    expect(bloque.trim().split('\n').map((l) => l.split('#')[0].trim())).toEqual(['npm ci', 'npm run dev'])
  })

  it('el diagrama de arquitectura une celular, tablero y panel con la API, el motor y SQLite', () => {
    const mermaid = /```mermaid\n([\s\S]*?)```/.exec(readme)![1]
    for (const v of ['celular', 'tablero', 'panel']) expect(mermaid).toMatch(new RegExp(`${v}\\[[^\\]]*\\] --> api`))
    expect(mermaid).toMatch(/api\["API Fastify/)
    expect(mermaid).toMatch(/api\[[^\]]*\] --> motor/)
    expect(mermaid).toMatch(/api --> sqlite/)
  })

  it('cierra con un resumen en inglés de 10 líneas', () => {
    const ingles = readme.split('## In English\n')[1].split('\n---')[0].trim().split('\n')
    expect(ingles).toHaveLength(10)
    expect(readme.indexOf('## In English')).toBeGreaterThan(readme.indexOf('## Documentación'))
  })

  it('sin rayas y sin menciones a herramientas de IA', () => {
    expect(readme).not.toMatch(/[—–]/)
    expect(readme).not.toMatch(/\b(IA|AI|Claude|ChatGPT|GPT|LLM)\b|inteligencia artificial/i)
  })
})
