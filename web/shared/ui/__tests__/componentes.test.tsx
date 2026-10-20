// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { Boton } from '../Boton'
import { Campo } from '../Campo'
import { Casilla } from '../Casilla'
import { Rubrica } from '../Rubrica'
import { Pestanas } from '../Pestanas'
import { BarraProgreso } from '../BarraProgreso'
import { Aviso } from '../Aviso'
import { MuestraUI } from '../MuestraUI'
import { EncabezadoProducto } from '../EncabezadoProducto'
import { useTemaDocumento } from '../tema'
import { BarraAccion } from '../BarraAccion'
import { LogoEstratek } from '../marca/LogoEstratek'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

afterEach(cleanup)

const opciones = [1, 3, 5, 7, 9].map((v) => ({ valor: v, texto: `Nivel ${v}` }))

describe('Boton', () => {
  it('no ejecuta onClick deshabilitado ni cargando', () => {
    const fn = vi.fn()
    const { rerender } = render(<Boton deshabilitado onClick={fn}>Inscribirme</Boton>)
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }))
    rerender(<Boton cargando textoCargando="Guardando…" onClick={fn}>Guardar</Boton>)
    expect(screen.getByRole('button').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button').textContent).toBe('Guardando…')
    fireEvent.click(screen.getByRole('button'))
    expect(fn).not.toHaveBeenCalled()
  })
})

describe('Campo', () => {
  it('asocia etiqueta, ayuda y error', () => {
    render(<Campo etiqueta="Tu correo" ayuda="Solo con fines informativos." error="Escribe un correo válido." />)
    const input = screen.getByLabelText('Tu correo')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const ids = input.getAttribute('aria-describedby')!.split(' ')
    expect(ids.map((id) => document.getElementById(id)!.textContent)).toEqual(['!Escribe un correo válido.', 'Solo con fines informativos.'])
  })
})

describe('Casilla', () => {
  it('cambia al tocar el texto', () => {
    const fn = vi.fn()
    render(<Casilla marcada={false} onCambio={fn}>Autorizo</Casilla>)
    fireEvent.click(screen.getByText('Autorizo'))
    expect(fn).toHaveBeenCalledWith(true)
  })
})

describe('Rubrica', () => {
  function Prueba() {
    const [v, setV] = useState<number | null>(null)
    return <Rubrica criterioId="regulacion" nombre="Regulación" pregunta="¿Qué tantas barreras?" opciones={opciones} valor={v} onCambio={setV} posicion={{ actual: 3, total: 6 }} />
  }

  it('muestra las opciones de 9 a 1 y marca la elegida', () => {
    render(<Prueba />)
    const radios = screen.getAllByRole('radio') as HTMLInputElement[]
    expect(radios.map((r) => r.value)).toEqual(['9', '7', '5', '3', '1'])
    fireEvent.click(screen.getByLabelText(/Nivel 5/))
    expect(radios.find((r) => r.checked)?.value).toBe('5')
    expect(screen.getByRole('radiogroup').textContent).toContain('Criterio 3 de 6')
  })

  it('anuncia el error', () => {
    render(<Rubrica criterioId="c" nombre="C" pregunta="P" opciones={opciones} valor={null} onCambio={() => undefined} error="Elige una opción para este criterio." />)
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Elige una opción para este criterio.')).toBeTruthy()
  })
})

describe('Pestanas', () => {
  function Prueba() {
    const [a, setA] = useState('caso')
    return (
      <Pestanas
        etiqueta="Lectura"
        activa={a}
        onCambio={setA}
        pestanas={[
          { id: 'caso', titulo: 'Caso', contenido: 'Texto del caso' },
          { id: 'hoja', titulo: 'Tu hoja', contenido: 'Texto de la hoja' },
        ]}
      />
    )
  }

  it('navega con flechas y muestra el panel', () => {
    render(<Prueba />)
    expect(screen.getByRole('tabpanel').textContent).toBe('Texto del caso')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Caso' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Tu hoja' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('Texto de la hoja')
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Tu hoja' }), { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Caso' }).getAttribute('aria-selected')).toBe('true')
  })
})

describe('BarraProgreso y Aviso', () => {
  it('expone el progreso accesible', () => {
    render(<BarraProgreso actual={5} total={7} texto="5 de 7 completaron" />)
    const barra = screen.getByRole('progressbar')
    expect(barra.getAttribute('aria-valuenow')).toBe('5')
    expect(barra.getAttribute('aria-valuetext')).toBe('5 de 7 completaron')
  })

  it('usa alert para error y status para ok', () => {
    render(
      <>
        <Aviso tono="error">Falló</Aviso>
        <Aviso tono="ok">Guardado</Aviso>
      </>,
    )
    expect(screen.getByRole('alert').textContent).toContain('Falló')
    expect(screen.getByRole('status').textContent).toContain('Guardado')
  })
})

describe('MuestraUI', () => {
  it('renderiza todos los componentes base sin rayas en los textos', () => {
    const { container } = render(<MuestraUI />)
    expect(container.textContent).not.toContain('–')
    expect(screen.getAllByRole('radiogroup').length).toBeGreaterThan(0)
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(container.textContent).not.toContain('—')
  })
})

describe('Colores de ronda', () => {
  // El contraste de R1, R2 y de todos los pares de los dos temas se mide en contraste.test.ts.
  it('la insignia de ronda siempre lleva su texto y una forma distinta por ronda', () => {
    render(<MuestraUI />)
    for (const r of ['r1', 'r2']) {
      const insignias = screen.getAllByText(r.toUpperCase())
      expect(insignias.length).toBeGreaterThan(0)
      for (const i of insignias) expect(i.className).toContain(`hz-insignia--${r}`)
    }
  })
})

describe('EncabezadoProducto', () => {
  it('muestra el logo, el nombre y la firma «por Estratek» con la » decorativa', () => {
    render(
      <EncabezadoProducto href="#inicio">
        <span>Mesa 2</span>
      </EncabezadoProducto>,
    )
    const marca = screen.getByRole('link')
    expect(marca.getAttribute('href')).toBe('#inicio')
    expect(marca.textContent).toBe('Horizontespor Estratek »')
    // El logo es decorativo: el nombre va en texto al lado.
    const logo = marca.querySelector('svg')!
    expect(logo.getAttribute('aria-hidden')).toBe('true')
    expect(logo.getAttribute('class')).toContain('hz-producto__glifo')
    expect(screen.getByText('»').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('banner').textContent).toContain('Mesa 2')
  })

  it('sin href la marca no es enlace', () => {
    render(<EncabezadoProducto nombre="IRMI" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByRole('banner').textContent).toContain('IRMI')
  })

  it('con onIr el clic en la marca lo maneja la vista (navegar sin recargar)', () => {
    const onIr = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(<EncabezadoProducto href="/admin/salas" onIr={onIr} />)
    fireEvent.click(screen.getByRole('link'))
    expect(onIr).toHaveBeenCalledTimes(1)
  })
})

describe('una sola apariencia: página clara y barra superior carbón (20-oct)', () => {
  it('el encabezado de producto lleva el tema carbón en su <header>, sin envoltorio de cada área', () => {
    render(
      <div data-tema="claro">
        <EncabezadoProducto href="/">
          <button type="button">Menú</button>
        </EncabezadoProducto>
      </div>,
    )
    const barra = screen.getByRole('banner')
    expect(barra.getAttribute('data-tema')).toBe('carbon')
    // Lo que va dentro de la barra (navegación, botones, menú) también queda en carbón.
    expect(screen.getByRole('button', { name: 'Menú' }).closest('[data-tema]')).toBe(barra)
  })

  it('la barra pinta su fondo y su tinta (no hereda la del claro)', () => {
    const css = readFileSync('web/shared/ui/componentes.css', 'utf8')
    expect(css).toMatch(/\.hz-producto \{ position: relative; background: var\(--hz-fondo\); color: var\(--hz-tinta\); \}/)
  })

  it('la muestra /m/_ui es clara con la barra carbón y ya no tiene un bloque carbón', () => {
    const { container } = render(<MuestraUI />)
    expect(container.querySelector('.hz-vista')!.getAttribute('data-tema')).toBe('claro')
    expect([...container.querySelectorAll('[data-tema="carbon"]')].map((e) => e.tagName)).toEqual(['HEADER'])
  })

  it('el logo de Estratek es una imagen con nombre y se pinta con la tinta del tema', () => {
    render(<LogoEstratek className="pie" />)
    const logo = screen.getByRole('img', { name: 'Estratek' })
    expect(logo.className).toBe('hz-logo-estratek pie')
    const css = readFileSync('web/shared/ui/componentes.css', 'utf8')
    expect(css).toMatch(/\.hz-logo-estratek \{[^}]*background: var\(--hz-tinta\);[^}]*mask: url\('\.\/marca\/estratek-logo\.png'\)/)
    expect(css).toMatch(/forced-colors: active\) \{ \.hz-logo-estratek \{ forced-color-adjust: none; background: CanvasText; \}/)
  })

  it('index.html: color-scheme claro y theme-color en el carbón de la barra (el valor de --et-carbon)', () => {
    const html = readFileSync('web/index.html', 'utf8')
    const tokens = readFileSync('web/shared/ui/tokens.css', 'utf8')
    expect(html).toMatch(/<meta name="color-scheme" content="light" \/>/)
    const carbon = /--et-carbon: (#[0-9A-F]{6});/i.exec(tokens)![1]
    expect(html).toContain(`<meta name="theme-color" content="${carbon}" />`)
    expect(html).toMatch(/<html lang="es-CO">/)
  })
})

/** Archivos de una carpeta, recursivo, con estas extensiones (sin pruebas). */
function archivos(dir: string, ext: RegExp): string[] {
  return readdirSync(dir).flatMap((n) => {
    const r = join(dir, n)
    if (statSync(r).isDirectory()) return n === 'node_modules' ? [] : archivos(r, ext)
    return ext.test(n) && !/\.test\.tsx?$/.test(n) ? [r] : []
  })
}

describe('tokens del sistema de diseño', () => {
  const tokens = readFileSync('web/shared/ui/tokens.css', 'utf8')
  const definidos = new Set([...tokens.matchAll(/(--(?:hz|et)-[a-z0-9-]+):/g)].map((m) => m[1]))

  it('todo var(--hz-…) o var(--et-…) de la web existe en tokens.css (un token borrado no falla en silencio)', () => {
    const textos = archivos('web', /\.(css|tsx?|js)$/).map((f) => [f, readFileSync(f, 'utf8')] as const)
    // Variables propias que un área define en su CSS o en un style de React (por ejemplo --hz-cols del tablero).
    const locales = new Set(textos.flatMap(([, t]) => [...t.matchAll(/['"]?(--(?:hz|et)-[a-z0-9-]+)['"]?\s*:/g)].map((m) => m[1])))
    const faltan = textos.flatMap(([f, t]) =>
      [...t.matchAll(/var\((--(?:hz|et)-[a-z0-9-]+)/g)].filter((m) => !definidos.has(m[1]) && !locales.has(m[1])).map((m) => `${f}: ${m[1]}`),
    )
    expect(faltan).toEqual([])
  })

  it('se quitaron los alias sin uso del tema anterior', () => {
    for (const viejo of ['--hz-marca-teal', '--hz-marca-azul', '--hz-lienzo', '--hz-cielo', '--hz-acento-2', '--hz-borde-suave', '--hz-borde-fuerte', '--hz-superficie-4', '--hz-sobre-acento', '--hz-sp-seccion'])
      expect(definidos.has(viejo), viejo).toBe(false)
  })

  it('sin colores en duro fuera de tokens.css en el sistema de diseño y la landing', () => {
    const hex = /#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i
    const conColor = [...archivos('web/shared/ui', /\.(css|tsx?)$/), ...archivos('web/inicio', /\.(css|tsx?)$/)]
      .filter((f) => f !== join('web', 'shared', 'ui', 'tokens.css'))
      .filter((f) => hex.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')))
    expect(conColor).toEqual([])
  })
})

describe('useTemaDocumento', () => {
  function Vista() {
    useTemaDocumento('carbon')
    return null
  }

  it('pone el tema en <html> mientras la vista está montada y lo quita al salir', () => {
    const { unmount } = render(<Vista />)
    expect(document.documentElement.getAttribute('data-tema')).toBe('carbon')
    unmount()
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false)
  })
})

describe('ancho de página estándar de la familia Estratek (§5)', () => {
  const css = readFileSync('web/shared/ui/componentes.css', 'utf8')
  const tokens = readFileSync('web/shared/ui/tokens.css', 'utf8')
  it('token de 1280 px, el del panel, con margen de 16, 24 y 32 px', () => {
    expect(tokens).toMatch(/--hz-ancho-pagina: 1280px;/)
    expect(tokens).toMatch(/--hz-margen-pagina: 1rem;/)
    expect(tokens).toMatch(/@media \(min-width: 48rem\) \{ :root \{ --hz-margen-pagina: 1\.5rem; \} \}/)
    expect(tokens).toMatch(/@media \(min-width: 80rem\) \{ :root \{ --hz-margen-pagina: 2rem; \} \}/)
    expect(css).toMatch(/\.hz-pagina \{\s*width: 100%;\s*max-width: var\(--hz-ancho-pagina\);\s*margin-inline: auto;\s*padding-inline: var\(--hz-margen-pagina\);\s*\}/)
  })
  it('el encabezado de producto y la barra de acción usan el contenedor de página', () => {
    const { container } = render(
      <>
        <EncabezadoProducto />
        <BarraAccion>
          <Boton>Seguir</Boton>
        </BarraAccion>
      </>,
    )
    expect(container.querySelector('.hz-producto__fila')!.classList.contains('hz-pagina')).toBe(true)
    expect(container.querySelector('.hz-barra-accion__interior')!.classList.contains('hz-pagina')).toBe(true)
    // La fila no pisa el margen lateral del contenedor.
    expect(css).not.toMatch(/\.hz-producto__fila \{[^}]*padding:/)
  })
})
