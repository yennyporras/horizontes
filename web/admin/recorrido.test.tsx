// @vitest-environment jsdom
// Recorrido guiado del panel (pedido del 20-oct): se abre solo la primera vez de cada admin, marca en el menú la
// sección de cada paso, se puede saltar y se vuelve a ver con el botón «Recorrido». El logo lleva a Salas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_RECORRIDO, PASOS_RECORRIDO } from './componentes/Recorrido'

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
  reiniciarMock()
  localStorage.clear()
  // Con el simulador tal cual el recorrido no se abre solo (modo de desarrollo); envuelto, se porta como la API real.
  usarTransporte((m, r, c, e) => responderMock(m, r, c, e))
})
afterEach(cleanup)

describe('recorrido guiado del panel', () => {
  it('se abre la primera vez, marca la sección de cada paso y al saltarlo no vuelve a abrirse solo', async () => {
    montar('/admin/login')
    await entrar()
    const dialogo = await screen.findByRole('dialog', { name: PASOS_RECORRIDO[0].titulo })
    expect(within(dialogo).getByText(`Paso 1 de ${PASOS_RECORRIDO.length}`)).toBeTruthy()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialogo).getByRole('heading', { name: 'Salas' })).toBeTruthy()
    expect(nav().getByRole('link', { name: 'Salas' }).className).toContain('nav__item--recorrido')

    // Con las flechas también se avanza y se retrocede.
    fireEvent.keyDown(dialogo, { key: 'ArrowRight' })
    expect(within(dialogo).getByRole('heading', { name: 'Configuración' })).toBeTruthy()
    expect(nav().getByRole('link', { name: 'Configuración' }).className).toContain('nav__item--recorrido')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Anterior' }))
    expect(within(dialogo).getByRole('heading', { name: 'Salas' })).toBeTruthy()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Saltar recorrido' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(nav().getByRole('link', { name: 'Salas' }).className).not.toContain('nav__item--recorrido')
    expect(localStorage.getItem(CLAVE_RECORRIDO)).toBe('1')

    // Otra visita del mismo admin: no se abre solo.
    cleanup()
    montar('/admin/salas')
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('el botón «Recorrido» lo abre cuando se quiera y el último paso cierra con «Empezar»', async () => {
    localStorage.setItem(CLAVE_RECORRIDO, '1')
    montar('/admin/login')
    await entrar()
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Recorrido' }))
    const dialogo = await screen.findByRole('dialog')
    for (let i = 1; i < PASOS_RECORRIDO.length; i++) fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialogo).getByText(`Paso ${PASOS_RECORRIDO.length} de ${PASOS_RECORRIDO.length}`)).toBeTruthy()
    expect(within(dialogo).queryByRole('button', { name: 'Siguiente' })).toBeNull()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Empezar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('los textos del recorrido no llevan rayas y cada sección nombrada existe en el menú', async () => {
    localStorage.setItem(CLAVE_RECORRIDO, '1')
    montar('/admin/login')
    await entrar()
    fireEvent.click(screen.getByRole('button', { name: 'Recorrido' }))
    const dialogo = await screen.findByRole('dialog')
    for (const paso of PASOS_RECORRIDO) {
      expect(dialogo.textContent).not.toMatch(/[—–]/)
      if (paso.seccion) expect(nav().getByRole('link', { name: paso.seccion })).toBeTruthy()
      const siguiente = within(dialogo).queryByRole('button', { name: 'Siguiente' })
      if (siguiente) fireEvent.click(siguiente)
    }
  })

  it('el logo lleva al panel principal (Salas) sin recargar', async () => {
    localStorage.setItem(CLAVE_RECORRIDO, '1')
    montar('/admin/login')
    await entrar()
    fireEvent.click(nav().getByRole('link', { name: 'Salud' }))
    await screen.findByRole('heading', { level: 1, name: /Salud/ })
    const logo = screen.getByRole('link', { name: /Horizontes\s*por Estratek/ })
    expect(logo.getAttribute('href')).toBe('/admin/salas')
    fireEvent.click(logo)
    expect(await screen.findByRole('heading', { level: 1, name: 'Salas' })).toBeTruthy()
  })
})
