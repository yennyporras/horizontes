// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom'
import PaginaInicio from './PaginaInicio'
import { codigoDeMesa } from './EntradaMesa'

function Mesa() {
  return <p>Mesa destino {useParams().codigo}</p>
}

function montar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/m/:codigo" element={<Mesa />} />
        <Route path="/admin" element={<p>Panel</p>} />
        <Route path="*" element={<PaginaInicio />} />
      </Routes>
    </MemoryRouter>,
  )
}

const json = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } })

const mesa = (estado: string, inscripcion_abierta: boolean) => ({
  sala: { id: 's1', nombre: 'Taller Bogotá', estado },
  mesa: { id: 'm1', nombre: 'Mesa 2' },
  inscripcion_abierta,
  consentimiento: { version: 'hz-1.1', texto_autorizacion: '', politica_url: '' },
})

function escribirCodigo(texto: string) {
  fireEvent.change(screen.getByLabelText('Código de tu mesa'), { target: { value: texto } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar a mi mesa' }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('landing de la raíz', () => {
  it('muestra qué es Horizontes, las anclas con su sección y el acceso al panel', () => {
    const { container } = montar()
    expect(screen.getByRole('heading', { level: 1, name: 'La mesa mueve el portafolio' })).toBeTruthy()
    expect(document.title).toContain('Horizontes')
    const secciones = screen.getByRole('navigation', { name: 'Secciones' })
    const anclas = [...secciones.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(anclas).toEqual(['#entrar', '#como-funciona', '#que-se-evalua', '#facilitadores', '#privacidad'])
    for (const a of anclas) expect(container.querySelector(a!)).toBeTruthy()
    const panel = screen.getAllByRole('link', { name: 'Ingresar al panel' })
    expect(panel.length).toBeGreaterThanOrEqual(2)
    for (const l of panel) expect(l.getAttribute('href')).toBe('/admin')
    expect(screen.getAllByRole('listitem').length).toBeGreaterThan(6)
    expect(container.textContent).not.toContain('—')
  })

  it('se ve en el tema carbón con la marca de Horizontes y el logo oficial de Estratek', () => {
    const { container, unmount } = montar()
    expect(container.querySelector('.hz-inicio')!.getAttribute('data-tema')).toBe('carbon')
    expect(document.documentElement.getAttribute('data-tema')).toBe('carbon')
    expect(screen.getByRole('link', { name: /Horizontes\s*por Estratek/ }).getAttribute('href')).toBe('#inicio')
    expect(screen.getByRole('heading', { level: 1 }).querySelector('.in-clave')!.textContent).toBe('portafolio')
    expect(screen.getByRole('img', { name: 'Estratek' }).getAttribute('src')).toContain('estratek-logo-blanco')
    unmount()
    expect(document.documentElement.hasAttribute('data-tema')).toBe(false)
  })

  it('explica los 6 criterios, los dos ejes y la escala impar sin pesos', () => {
    const { container } = montar()
    for (const n of ['Regulación', 'Capacidades Organizacionales', 'Inversión Requerida para Probar', 'Time 2 Market', 'Value Generation Capacity'])
      expect(container.textContent).toContain(n)
    expect(container.textContent).toContain('1, 3, 5, 7 y 9')
    expect(container.textContent).not.toMatch(/0,3|0,35|0,6|0,7|30 ?%/)
    fireEvent.click(screen.getByRole('radio', { name: /^1:/ }))
    expect(screen.getByText(/Marcaste 1\./)).toBeTruthy()
  })

  it('el código válido consulta la mesa y lleva a /m/:codigo', async () => {
    const f = vi.fn(async () => json(200, mesa('inscripcion', true)))
    vi.stubGlobal('fetch', f)
    montar()
    escribirCodigo('  hz7k2-1 ')
    expect(await screen.findByText('Mesa destino HZ7K2-1')).toBeTruthy()
    expect(f).toHaveBeenCalledWith('/api/mesas/HZ7K2-1', expect.anything())
  })

  it('el código que no existe muestra el error en la misma página', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(404, { error: { codigo: 'MESA_NO_EXISTE', mensaje: 'No encontramos esa mesa.' } })))
    montar()
    escribirCodigo('HZ000-9')
    expect(await screen.findByText(/No encontramos una mesa con el código HZ000-9/)).toBeTruthy()
    expect(screen.getByLabelText('Código de tu mesa').getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByText(/Mesa destino/)).toBeNull()
  })

  it('un texto sin forma de código no llama al servidor', () => {
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    montar()
    escribirCodigo('hola')
    expect(screen.getByText(/no tiene la forma de un código de mesa/)).toBeTruthy()
    expect(f).not.toHaveBeenCalled()
  })

  it('con la inscripción cerrada lo dice y deja ir a la mesa a quien ya se inscribió', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, mesa('cerrada', false))))
    montar()
    escribirCodigo('HZ7K2-2')
    expect((await screen.findByRole('alert')).textContent).toContain('Taller Bogotá ya terminó y no recibe más inscripciones')
    expect(screen.getByRole('link', { name: 'Ir a Mesa 2' }).getAttribute('href')).toBe('/m/HZ7K2-2')
  })

  it('la inscripción que aún no abre también se explica', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, mesa('preparada', false))))
    montar()
    escribirCodigo('HZ7K2-2')
    expect((await screen.findByRole('alert')).textContent).toContain('La inscripción de Mesa 2 todavía no abre')
  })
})

describe('codigoDeMesa', () => {
  it('acepta el código o el enlace del QR y rechaza lo demás', () => {
    expect(codigoDeMesa('hz7k2-1')).toBe('HZ7K2-1')
    expect(codigoDeMesa('https://horizontes.estratek.com.co/m/HZ7K2-12')).toBe('HZ7K2-12')
    expect(codigoDeMesa('HZ7K2')).toBeNull()
    expect(codigoDeMesa('')).toBeNull()
    expect(codigoDeMesa('../admin-1')).toBeNull()
  })
})
