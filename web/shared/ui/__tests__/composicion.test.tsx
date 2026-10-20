// @vitest-environment jsdom
// Composición común de las cuatro áreas (pedido de Paola del 21-oct: «parecen cada página de un proyecto diferente»).
// Una barra, una franja, una cabecera de página, un pie y un contenedor, con las mismas medidas en todas las vistas.
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { CabeceraPagina, EncabezadoProducto, PiePagina } from '..'

afterEach(cleanup)

const desplegable = () => document.querySelector<HTMLElement>('.hz-producto__desplegable')
const tokens = readFileSync('web/shared/ui/tokens.css', 'utf8')
const css = readFileSync('web/shared/ui/componentes.css', 'utf8')
const sinComentarios = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '')

describe('barra común (EncabezadoProducto)', () => {
  it('mide lo mismo en todas las vistas: 64 px en celular y tableta, 72 px desde 1024 px, con la línea incluida', () => {
    expect(tokens).toMatch(/--hz-alto-barra: 4rem;/)
    expect(tokens).toMatch(/@media \(min-width: 64rem\) \{ :root \{ --hz-alto-barra: 4\.5rem; \} \}/)
    expect(css).toMatch(/\.hz-producto__fila \{[^}]*height: var\(--hz-alto-barra\);[^}]*padding-block: 0 4px;/)
    // Ningún área cambia el alto ni el ancho de la fila de la barra.
    for (const f of ['web/admin/admin.css', 'web/inicio/inicio.css', 'web/participante/participante.css', 'web/tablero/tablero.css']) {
      const area = sinComentarios(readFileSync(f, 'utf8'))
      expect(area, f).not.toMatch(/\.hz-producto__fila \{[^}]*(height|padding|max-width|flex-wrap)/)
      expect(area, f).not.toMatch(/\.hz-producto__extra \{[^}]*display: contents/)
    }
  })

  it('lo del área va a la derecha y, bajo 1024 px, en «Menú»: se muda al desplegable, sin duplicarse, y se cierra al elegir', () => {
    render(
      <EncabezadoProducto
        href="/"
        menu={
          <nav aria-label="Secciones">
            <a href="#uno">Uno</a>
            <a href="#dos">Dos</a>
          </nav>
        }
      />,
    )
    const boton = screen.getByRole('button', { name: 'Menú' })
    expect(boton.getAttribute('aria-expanded')).toBe('false')
    // Cerrado: el menú va en la barra (visible desde 1024 px por CSS).
    expect(screen.getByRole('navigation', { name: 'Secciones' }).closest('.hz-producto__menu')).toBeTruthy()
    expect(desplegable()).toBeNull()
    fireEvent.click(boton)
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getAllByRole('navigation', { name: 'Secciones' })).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Secciones' }).closest('.hz-producto__desplegable')).toBeTruthy()
    // El desplegable es parte de la barra: tema carbón.
    expect(desplegable()!.closest('[data-tema]')!.getAttribute('data-tema')).toBe('carbon')
    fireEvent.click(within(desplegable()!).getByRole('link', { name: 'Dos' }))
    expect(desplegable()).toBeNull()
    expect(screen.getByRole('navigation', { name: 'Secciones' }).closest('.hz-producto__menu')).toBeTruthy()
  })

  it('el desplegable se cierra con Escape (el foco vuelve a «Menú») y con un toque fuera de la barra', () => {
    render(
      <>
        <EncabezadoProducto menu={<button type="button">Salir</button>} />
        <p>Página</p>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(desplegable()).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.pointerDown(desplegable()!)
    expect(desplegable()).toBeTruthy()
    fireEvent.pointerDown(screen.getByText('Página'))
    expect(desplegable()).toBeNull()
  })

  it('sin nada que plegar no hay botón «Menú» (el celular y el tablero)', () => {
    render(<EncabezadoProducto href="/m/X" />)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('la franja es clara, de 56 px y de una fila; en el panel se pliega dentro del menú y en el tablero se desliza', () => {
    expect(tokens).toMatch(/--hz-alto-franja: 3\.5rem;/)
    expect(css).toMatch(/\.hz-franja-pagina__fila \{[^}]*min-height: var\(--hz-alto-franja\);[^}]*overflow-x: auto;/)
    expect(css).not.toMatch(/\.hz-franja-pagina__fila \{[^}]*flex-wrap: wrap/)
    const { unmount } = render(<EncabezadoProducto franja={<div>Controles</div>} />)
    const franja = screen.getByText('Controles').closest('.hz-franja-pagina')!
    expect(franja.getAttribute('data-tema')).toBe('claro')
    expect(franja.closest('header')!.getAttribute('data-tema')).toBe('carbon')
    expect(franja.firstElementChild!.classList.contains('hz-pagina')).toBe(true)
    expect(franja.classList.contains('hz-franja-pagina--plegable')).toBe(false)
    expect(screen.queryByRole('button', { name: 'Menú' })).toBeNull()
    unmount()

    const onMenu = vi.fn()
    const { rerender } = render(
      <EncabezadoProducto franjaEnMenu franja={<nav aria-label="Secciones del panel">Pestañas</nav>} etiquetaMenu="Menú · Salas" menuAbierto={false} onMenu={onMenu} />,
    )
    expect(screen.getByRole('navigation', { name: 'Secciones del panel' }).closest('.hz-franja-pagina')!.classList.contains('hz-franja-pagina--plegable')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Menú · Salas' }))
    expect(onMenu).toHaveBeenCalledWith(true)
    // Controlado: abre cuando el área lo dice; la franja se muda al desplegable.
    rerender(<EncabezadoProducto franjaEnMenu franja={<nav aria-label="Secciones del panel">Pestañas</nav>} etiquetaMenu="Menú · Salas" menuAbierto onMenu={onMenu} />)
    expect(screen.getAllByRole('navigation', { name: 'Secciones del panel' })).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Secciones del panel' }).closest('.hz-producto__desplegable')).toBeTruthy()
    expect(document.querySelector('.hz-franja-pagina')).toBeNull()
  })

  it('el desplegable queda bajo la pantalla completa de la matriz del tablero (z-index 15)', () => {
    const z = Number(css.match(/\.hz-encabezado \{[^}]*z-index: (\d+)/)![1])
    expect(z).toBeLessThan(15)
    expect(z).toBeGreaterThan(10) // sobre la barra de acción fija del celular
  })
})

describe('cabecera de página (CabeceraPagina)', () => {
  it('h1 con la escala única (900, de 24 a 32 px), contexto y acciones', () => {
    render(<CabeceraPagina enfocable id="t" titulo="Salas" contexto="Taller demo" acciones={<button type="button">Crear sala</button>} />)
    const h1 = screen.getByRole('heading', { level: 1, name: 'Salas' })
    expect(h1.className).toBe('hz-h1')
    expect(h1.getAttribute('tabindex')).toBe('-1')
    expect(h1.id).toBe('t')
    expect(screen.getByText('Taller demo').className).toBe('hz-cabecera-pagina__contexto')
    expect(screen.getByRole('button', { name: 'Crear sala' }).closest('.hz-cabecera-pagina__acciones')).toBeTruthy()
    expect(tokens).toMatch(/--hz-fs-h1: clamp\(1\.5rem, 1\.2rem \+ 1vw, 2rem\);/)
    expect(tokens).toMatch(/--hz-fw-h1: var\(--hz-fw-display\);/)
    expect(css).toMatch(/\.hz-h1, \.hz-titulo \{[^}]*font-size: var\(--hz-fs-h1\); font-weight: var\(--hz-fw-h1\);/)
  })

  it('ningún área define otra escala para su h1 (la landing conserva su titular grande solo en el héroe)', () => {
    for (const f of ['web/admin/admin.css', 'web/participante/participante.css', 'web/tablero/tablero.css', 'web/inicio/inicio.css']) {
      const area = sinComentarios(readFileSync(f, 'utf8'))
      for (const regla of area.match(/[^{}]*\bh1\b[^{}]*\{[^}]*font-size:[^}]*\}/g) ?? []) {
        expect(regla, f).toMatch(/font-size: var\(--hz-fs-h1\)/)
      }
    }
    // Las secciones de la landing usan la escala del título de página, no la del héroe.
    expect(readFileSync('web/inicio/inicio.css', 'utf8')).toMatch(/\.in-h2 \{ font-size: var\(--hz-fs-h1\); font-weight: var\(--hz-fw-h1\);/)
  })
})

describe('pie común (PiePagina)', () => {
  it('logo de Estratek, «Horizontes, una herramienta de Estratek» y los enlaces mínimos, en el contenedor de página', () => {
    render(<PiePagina />)
    const pie = screen.getByRole('contentinfo')
    expect(pie.classList.contains('hz-pie')).toBe(true)
    expect(pie.firstElementChild!.classList.contains('hz-pagina')).toBe(true)
    expect(within(pie).getByRole('img', { name: 'Estratek' })).toBeTruthy()
    expect(pie.textContent).toContain('Horizontes, una herramienta de Estratek')
    const enlaces = within(pie).getAllByRole('link')
    expect(enlaces.map((a) => a.getAttribute('href'))).toEqual([
      'https://estratek.com.co/politica-de-privacidad-y-tratamiento-de-datos/',
      'https://estratek.com.co',
    ])
    for (const a of enlaces) expect(a.getAttribute('target')).toBe('_blank')
    expect(pie.textContent).not.toMatch(/[—–]/)
    // La línea del degradado encima, de borde a borde, y enlaces de 48 px.
    expect(css).toMatch(/\.hz-pie::before \{[^}]*height: 4px; background: var\(--hz-grad-marca\);/)
    expect(css).toMatch(/\.hz-pie__enlaces a \{[^}]*min-height: var\(--hz-tactil\)/)
  })
})

describe('mismas piezas en todas las áreas', () => {
  it('tarjetas con el relleno común y botones de 48 px también en el tablero', () => {
    expect(tokens).toMatch(/--hz-sp-tarjeta: var\(--hz-sp-4\);/)
    expect(tokens).toMatch(/@media \(min-width: 48rem\) \{ :root \{ --hz-sp-tarjeta: var\(--hz-sp-6\); --hz-sp-bloque: var\(--hz-sp-8\); \} \}/)
    expect(readFileSync('web/admin/admin.css', 'utf8')).toMatch(/\.hz-admin \.panel \{[^}]*padding: var\(--hz-sp-tarjeta\);/)
    const tablero = readFileSync('web/tablero/tablero.css', 'utf8')
    expect(tablero).toMatch(/\.hz-boton-pantalla \{[^}]*min-height: var\(--hz-tactil\);/)
    expect(tablero).toMatch(/\.hz-alcance select \{[^}]*min-height: var\(--hz-tactil\);/)
    expect(css).toMatch(/\.hz-segmento > button \{[^}]*min-height: var\(--hz-tactil\);/)
    // El control segmentado es uno solo, del sistema de diseño: el tablero no lo vuelve a definir.
    expect(sinComentarios(tablero)).not.toMatch(/\.hz-segmento button/)
    // Sin radios sueltos en el tablero: los del sistema.
    expect(sinComentarios(tablero)).not.toMatch(/border-radius: (6|8|10)px/)
  })

  it('el celular centra su columna de lectura (640 px) dentro del contenedor de página', () => {
    expect(tokens).toMatch(/--hz-ancho-lectura: 40rem;/)
    expect(css).toMatch(/\.hz-pagina\.hz-pagina--lectura \{ max-width: calc\(var\(--hz-ancho-lectura\) \+ 2 \* var\(--hz-margen-pagina\)\); \}/)
  })
})
