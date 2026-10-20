// @vitest-environment jsdom
// Guía de uso del panel (pedido del 20-oct; antes «Recorrido»): se abre sola la primera vez de cada admin, marca en el
// menú la sección de cada paso, sigue el orden exacto del menú, se puede saltar y se vuelve a ver con el botón «Guía de
// uso». El logo lleva a Salas.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA, PASOS_GUIA, pasosDe } from './componentes/GuiaUso'
import { seccionesDe } from './secciones'

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
  reiniciarMock()
  localStorage.clear()
  // Con el simulador tal cual la guía no se abre sola (modo de desarrollo); envuelto, se porta como la API real.
  usarTransporte((m, r, c, e) => responderMock(m, r, c, e))
})
afterEach(cleanup)

describe('guía de uso del panel', () => {
  it('se abre la primera vez, marca la sección de cada paso y al saltarla no vuelve a abrirse sola', async () => {
    montar('/admin/login')
    await entrar()
    const dialogo = await screen.findByRole('dialog', { name: PASOS_GUIA[0].titulo })
    expect(within(dialogo).getByText(`Paso 1 de ${PASOS_GUIA.length}`)).toBeTruthy()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialogo).getByRole('heading', { name: 'Salas' })).toBeTruthy()
    expect(nav().getByRole('link', { name: 'Salas' }).className).toContain('nav__item--guia')

    // Con las flechas también se avanza y se retrocede; después de Salas viene Configuración, como en el menú.
    fireEvent.keyDown(dialogo, { key: 'ArrowRight' })
    expect(within(dialogo).getByRole('heading', { name: 'Configuración' })).toBeTruthy()
    expect(nav().getByRole('link', { name: 'Configuración' }).className).toContain('nav__item--guia')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Anterior' }))
    expect(within(dialogo).getByRole('heading', { name: 'Salas' })).toBeTruthy()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Saltar la guía' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(nav().getByRole('link', { name: 'Salas' }).className).not.toContain('nav__item--guia')
    expect(localStorage.getItem(CLAVE_GUIA)).toBe('1')

    // Otra visita del mismo admin: no se abre sola.
    cleanup()
    montar('/admin/salas')
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('el botón «Guía de uso» la abre cuando se quiera y el último paso cierra con «Empezar»', async () => {
    localStorage.setItem(CLAVE_GUIA, '1')
    montar('/admin/login')
    await entrar()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('button', { name: /Recorrido/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guía de uso' }))
    const dialogo = await screen.findByRole('dialog')
    for (let i = 1; i < PASOS_GUIA.length; i++) fireEvent.click(within(dialogo).getByRole('button', { name: 'Siguiente' }))
    expect(within(dialogo).getByText(`Paso ${PASOS_GUIA.length} de ${PASOS_GUIA.length}`)).toBeTruthy()
    expect(within(dialogo).getByText(/Vuelve a esta guía cuando quieras con el botón «Guía de uso»/)).toBeTruthy()
    expect(within(dialogo).queryByRole('button', { name: 'Siguiente' })).toBeNull()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Empezar' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each([
    ['paola', true],
    ['jorge', false],
  ])('para %s los pasos siguen exactamente el orden del menú, sin rayas', async (usuario, esSuper) => {
    expect(pasosDe(esSuper).flatMap((p) => (p.seccion ? [p.seccion] : []))).toEqual(seccionesDe(esSuper).map((s) => s.texto))
    localStorage.setItem(CLAVE_GUIA, '1,2')
    montar('/admin/login')
    await entrar(usuario)
    const menu = nav().getAllByRole('link').map((a) => a.textContent)
    fireEvent.click(screen.getByRole('button', { name: 'Guía de uso' }))
    const dialogo = await screen.findByRole('dialog')
    const vistas: string[] = []
    for (;;) {
      expect(dialogo.textContent).not.toMatch(/[—–]/)
      expect(dialogo.textContent).not.toMatch(/recorrido/i)
      const marcado = nav().queryAllByRole('link').filter((a) => a.className.includes('nav__item--guia'))
      if (marcado.length) vistas.push(marcado[0].textContent ?? '')
      const siguiente = within(dialogo).queryByRole('button', { name: 'Siguiente' })
      if (!siguiente) break
      fireEvent.click(siguiente)
    }
    expect(vistas).toEqual(menu)
    expect(menu.includes('Administradores')).toBe(esSuper)
  })

  it('el logo lleva al panel principal (Salas) sin recargar', async () => {
    localStorage.setItem(CLAVE_GUIA, '1')
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
