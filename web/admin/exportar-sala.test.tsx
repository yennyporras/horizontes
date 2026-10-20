// @vitest-environment jsdom
// Exportar con selector de sala (pedido de Paola, 21-oct), contra el simulador del panel.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { salaRecordada } from './memoria'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { SelectorSalaExportar } from './paginas/Exportar'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar() {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'paola' } })
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
afterEach(() => cleanup())

describe('Exportar: selector de sala', () => {
  it('con una sola sala el selector se ve, con su etiqueta, pero deshabilitado', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(nav().getByText('Exportar'))
    const selector = (await screen.findByLabelText('Sala de la que exportas')) as HTMLSelectElement
    expect(selector.tagName).toBe('SELECT')
    expect(selector.disabled).toBe(true)
    expect(screen.getByText('Solo hay una sala.')).toBeTruthy()
  })

  it('lista todas las salas con código, estado y si es ensayo; al cambiar va a Exportar de esa sala y la recuerda', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    const nueva = (await responderMock('POST', '/api/admin/salas', { nombre: 'Ensayo Norte', mesas: 2, tipo: 'ensayo' })).body as { id: string; codigo: string }
    montar('/admin/salas/s_demo/export')
    const selector = (await screen.findByLabelText('Sala de la que exportas')) as HTMLSelectElement
    expect(selector.disabled).toBe(false)
    expect(selector.value).toBe('s_demo')
    const opciones = within(selector).getAllByRole('option').map((o) => o.textContent)
    expect(opciones).toHaveLength(2)
    expect(opciones).toContain(`Ensayo Norte · ${nueva.codigo} · Preparada · Ensayo`)
    fireEvent.change(selector, { target: { value: nueva.id } })
    await waitFor(() => expect(screen.getByText('Ensayo Norte', { selector: '.encabezado-sala__meta strong' })).toBeTruthy())
    expect(screen.getByRole('heading', { level: 1, name: 'Exportar datos' })).toBeTruthy()
    expect((screen.getByLabelText('Sala de la que exportas') as HTMLSelectElement).value).toBe(nueva.id)
    await waitFor(() => expect(salaRecordada()).toBe(nueva.id))
  })

  it('sin salas muestra un estado vacío que lleva a crear la primera', async () => {
    usarTransporte(async () => ({ status: 200, body: { salas: [] } }))
    render(
      <MemoryRouter>
        <SelectorSalaExportar salaId={undefined} />
      </MemoryRouter>,
    )
    expect(await screen.findByText(/Aún no hay salas para exportar/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Salas' }).getAttribute('href')).toBe('/admin/salas')
  })
})
