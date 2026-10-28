// @vitest-environment jsdom
// Entrar al panel: ver la clave escrita y ayuda para restablecerla (pedido de Paola, 28-oct).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'

function montar() {
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('login: ver y restablecer la clave', () => {
  beforeEach(() => {
    reiniciarMock()
    usarTransporte(responderMock)
  })
  afterEach(cleanup)

  it('«Mostrar» deja ver la clave y «Ocultar» la vuelve a tapar', async () => {
    montar()
    const clave = (await screen.findByLabelText('Clave')) as HTMLInputElement
    fireEvent.change(clave, { target: { value: 'demo1234' } })
    expect(clave.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    expect(clave.type).toBe('text')
    expect(screen.getByRole('button', { name: 'Ocultar' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Ocultar' }))
    expect(clave.type).toBe('password')
    // Con la clave visible igual se entra.
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar' }))
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'paola' } })
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
  })

  it('«¿Olvidaste tu clave?» explica cómo restablecerla para cada rol', async () => {
    montar()
    await screen.findByLabelText('Clave')
    expect(screen.getByText('¿Olvidaste tu clave?')).toBeTruthy()
    expect(screen.getByText(/pídele al superadministrador de Estratek que la restablezca en\s+Administradores/)).toBeTruthy()
    expect(screen.getByText('node_modules/.bin/tsx server/restablecer_superadmin.ts --confirmar')).toBeTruthy()
  })
})
