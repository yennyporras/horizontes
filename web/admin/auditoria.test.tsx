// @vitest-environment jsdom
// Auditoría final del panel (20-oct, pedido de Paola): coherencia de textos y del flujo con el orden del menú, el largo
// mínimo de la clave igual al del servidor y los enlaces del tablero con sus modos nuevos.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { LARGO_MINIMO_CLAVE as LARGO_SERVIDOR } from '../../server/dominio/admins'
import { LARGO_MINIMO_CLAVE, MODOS_TABLERO, conModo, fechaCorta } from './textos'
import { SECCIONES, nombreSeccionSala } from './secciones'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario = 'paola') {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
}

const nav = () => within(screen.getByRole('navigation', { name: 'Secciones del panel' }))

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
  usarTransporte(responderMock)
})
afterEach(cleanup)

describe('auditoría del panel (20-oct)', () => {
  it('el largo mínimo de la clave es el del servidor y la pantalla de cambio de clave lo dice', async () => {
    expect(LARGO_MINIMO_CLAVE).toBe(LARGO_SERVIDOR)
    montar('/admin/login')
    await entrar()
    fireEvent.click(screen.getByRole('link', { name: 'Cambiar mi clave' }))
    expect(await screen.findByText(`Escribe tu clave actual y elige una nueva de al menos ${LARGO_SERVIDOR} caracteres.`)).toBeTruthy()
    expect(screen.queryByText(/10 caracteres/)).toBeNull()
    expect(screen.getByLabelText('Clave nueva').getAttribute('minlength')).toBe(String(LARGO_SERVIDOR))
    expect(screen.getByLabelText('Repite la clave nueva').getAttribute('minlength')).toBe(String(LARGO_SERVIDOR))
  })

  it('una clave de 8 caracteres se acepta y una de 7 sale con el mensaje del servidor', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(screen.getByRole('link', { name: 'Cambiar mi clave' }))
    await screen.findByLabelText('Clave nueva')
    const llenar = (nueva: string) => {
      fireEvent.change(screen.getByLabelText('Clave actual'), { target: { value: 'demo1234' } })
      fireEvent.change(screen.getByLabelText('Clave nueva'), { target: { value: nueva } })
      fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: nueva } })
      fireEvent.submit(screen.getByRole('button', { name: 'Guardar clave' }).closest('form')!)
    }
    llenar('corta77')
    expect((await screen.findByRole('alert')).textContent).toBe(`La clave debe tener al menos ${LARGO_SERVIDOR} caracteres.`)
    llenar('ocho1234')
    expect(await screen.findByText('Tu clave quedó cambiada.')).toBeTruthy()
  })

  it('«Elige una sala» dice qué sección se va a abrir y lista las salas', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(nav().getByRole('link', { name: 'Respuestas' }))
    await screen.findByRole('heading', { level: 1, name: 'Elige una sala' })
    expect(screen.getByText(/^Respuestas trabaja sobre una sala\./)).toBeTruthy()
    expect(document.title).toBe('Elige una sala · Respuestas · Horizontes')
    for (const s of SECCIONES.filter((x) => x.deSala)) expect(nombreSeccionSala(s.ruta)).toBe(s.texto)
  })

  it('una sala recién creada (preparada) recuerda preparar Configuración, Hojas y Mesas y QR antes de abrir', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Taller de auditoría' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { level: 1, name: 'Sala en vivo' })
    const paso = (await screen.findByText(/^Antes de abrir, revisa/)) as HTMLElement
    expect(within(paso).getAllByRole('link').map((a) => a.textContent)).toEqual(['Configuración', 'Hojas', 'Mesas y QR'])
  })

  it('los modos del tablero se llaman Gráfica y Detallado y van en el enlace como modo=grafica y modo=detallado', () => {
    expect(MODOS_TABLERO.map((m) => [m.nombre, m.modo, m.tecla])).toEqual([
      ['Gráfica', 'grafica', 'G'],
      ['Detallado', 'detallado', 'D'],
    ])
    expect(conModo('https://x.co/tablero/HZ7K2?t=TOK', 'grafica')).toBe('/tablero/HZ7K2?t=TOK&modo=grafica')
    expect(conModo('/tablero/HZ7K2?t=TOK&modo=grafica', 'detallado')).toBe('/tablero/HZ7K2?t=TOK&modo=detallado')
  })

  it('Respuestas usa la fecha corta (sin año) para que la tabla quepa en 1280 px', () => {
    expect(fechaCorta('2026-10-20T11:54:00Z').replace(/\s/g, ' ')).toBe('20 de oct, 6:54 a. m.')
    expect(fechaCorta(null)).toBe('Sin definir')
  })
})
