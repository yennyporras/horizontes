// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { useState } from 'react'
import { Boton } from '../Boton'
import { Campo } from '../Campo'
import { Casilla } from '../Casilla'
import { Rubrica } from '../Rubrica'
import { Pestanas } from '../Pestanas'
import { BarraProgreso } from '../BarraProgreso'
import { Aviso } from '../Aviso'
import { MuestraUI } from '../MuestraUI'

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
    expect(screen.getAllByRole('radiogroup').length).toBeGreaterThan(0)
    expect(screen.getByRole('tablist')).toBeTruthy()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    expect(screen.getByRole('checkbox')).toBeTruthy()
    expect(container.textContent).not.toContain('—')
  })
})

describe('Colores de ronda', () => {
  // Luminancia relativa WCAG 2.1.
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
  }
  const contraste = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m)
    return (x + 0.05) / (y + 0.05)
  }

  const css = readFileSync(join(__dirname, '..', 'tokens.css'), 'utf8')
  /** Valor hex de un token, siguiendo los alias var(--hz-…). */
  const token = (n: string): string => {
    const v = css.match(new RegExp(`--hz-${n}:\\s*([^;]+);`))![1].trim()
    const alias = v.match(/^var\(--hz-([a-z0-9-]+)\)$/)
    return alias ? token(alias[1]) : v
  }
  const fondos = ['fondo', 'superficie-1', 'superficie-2', 'superficie-3', 'superficie-4']

  it('--hz-r1 y --hz-r2 cumplen AA (4,5:1) sobre el lienzo y las cuatro superficies, sin usar el acento', () => {
    for (const r of ['r1', 'r2']) for (const f of fondos) expect(contraste(token(r), token(f)), `${r} sobre ${f}`).toBeGreaterThanOrEqual(4.5)
    expect([token('r1'), token('r2')]).toEqual(['#3FB25A', '#F36363'])
    expect(token('r1')).not.toBe(token('acento'))
    expect(contraste(token('sobre-r1'), token('r1'))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(token('sobre-r2'), token('r2'))).toBeGreaterThanOrEqual(4.5)
  })

  it('tinta, acento y estados cumplen AA sobre el sistema oscuro', () => {
    for (const t of ['tinta', 'tinta-2', 'tinta-3', 'acento', 'cielo']) {
      for (const f of fondos.slice(0, 4)) expect(contraste(token(t), token(f)), `${t} sobre ${f}`).toBeGreaterThanOrEqual(4.5)
    }
    for (const e of ['ok', 'alerta', 'error']) expect(contraste(token(e), token(`${e}-fondo`)), e).toBeGreaterThanOrEqual(4.5)
    expect(contraste(token('acento'), token('info-fondo'))).toBeGreaterThanOrEqual(4.5)
    // Texto del botón primario sobre los dos extremos del degradado de marca.
    for (const extremo of ['marca-teal', 'marca-azul']) expect(contraste(token('sobre-acento'), token(extremo))).toBeGreaterThanOrEqual(4.5)
    expect(contraste(token('deshabilitado-texto'), token('deshabilitado-fondo'))).toBeGreaterThanOrEqual(4.5)
    // Borde de campos y casillas: 3:1 (componente de interfaz, WCAG 1.4.11).
    for (const f of ['fondo', 'superficie-1', 'superficie-2']) expect(contraste(token('borde-control'), token(f))).toBeGreaterThanOrEqual(3)
  })

  it('la insignia de ronda siempre lleva su texto y una forma distinta por ronda', () => {
    render(<MuestraUI />)
    expect(screen.getByText('R1').className).toContain('hz-insignia--r1')
    expect(screen.getByText('R2').className).toContain('hz-insignia--r2')
  })
})
