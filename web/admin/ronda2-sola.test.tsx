// @vitest-environment jsdom
// La ronda 2 se abre sola cuando todos votaron la ronda 1 (decisión de Paola, 21-oct): aviso en Sala en vivo, texto de
// la bitácora y el simulador del panel imitando al servidor. Contra la API real está en admin.real.test.tsx.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { RONDA_2_SOLA, textoEvento } from './textos'
import { MENSAJE_RONDA_2_SOLA } from '../../server/dominio/participantes'
import type { SalaDetalle } from './tipos'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

/** La sala del simulador con la ronda 1 abierta, en Sala en vivo. */
async function abrirSala() {
  montar('/admin/login')
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'paola' } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
  fireEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
  await screen.findByRole('heading', { name: 'Sala en vivo' })
  await screen.findByText('Ronda 1 abierta', { selector: '.estado' })
  const lista = (await responderMock('GET', '/api/admin/salas')).body as { id: string }[]
  return lista[0].id
}

const detalle = async (id: string) => (await responderMock('GET', `/api/admin/salas/${id}`)).body as SalaDetalle

/** Desactiva a quienes no han completado la ronda: la sala queda completa, como si hubieran votado todos. */
async function completarSala(id: string) {
  for (const p of (await detalle(id)).participantes.filter((x) => x.activo && !x.completo_ronda)) {
    expect((await responderMock('PATCH', `/api/admin/participantes/${p.id}`, { activo: false })).status).toBe(200)
  }
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
  usarTransporte(responderMock)
})
afterEach(() => cleanup())

describe('la ronda 2 se abre sola (21-oct)', () => {
  it('el mensaje del servidor y el aviso del panel son el mismo texto, sin rayas', () => {
    expect(RONDA_2_SOLA).toBe(MENSAJE_RONDA_2_SOLA)
    expect(RONDA_2_SOLA).not.toMatch(/[—–]/)
  })

  it('la bitácora cuenta el evento ronda_2_automatica sin autor (lo hizo el sistema)', () => {
    expect(textoEvento({ tipo: 'ronda_2_automatica', detalle: { ronda: 2, mensaje: RONDA_2_SOLA }, por: 'sistema' })).toBe('Todos votaron la ronda 1: la ronda 2 se abrió sola')
  })

  it('el simulador imita al servidor: al completar la sala la R1 se cierra y la R2 se abre, con los eventos por sistema', async () => {
    reiniciarMock({ simularVotos: false })
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    const id = ((await responderMock('GET', '/api/admin/salas')).body as { id: string }[])[0].id
    expect((await detalle(id)).sala.estado).toBe('r1_abierta')
    await completarSala(id)
    const d = await detalle(id)
    expect(d.sala).toMatchObject({ estado: 'r2_abierta', ronda_actual: 2 })
    expect(d.sala.config.revelar_hojas).toBe(true)
    expect(d.eventos.slice(0, 3).map((ev) => [ev.tipo, ev.por])).toEqual([
      ['ronda_2_automatica', 'sistema'],
      ['ronda_abierta', 'sistema'],
      ['ronda_cerrada', 'sistema'],
    ])
    expect(d.eventos[0].detalle).toMatchObject({ ronda: 2, mensaje: RONDA_2_SOLA })
    // Nadie completó todavía la ronda 2.
    expect(d.participantes.every((p) => !p.completo_ronda)).toBe(true)
  })

  it('Sala en vivo muestra el aviso en r2_abierta cuando el último cambio de ronda fue el automático', async () => {
    const id = await abrirSala()
    expect(screen.queryByText(RONDA_2_SOLA)).toBeNull()
    await completarSala(id)
    await screen.findByText('Ronda 2 abierta', { selector: '.estado' }, { timeout: 5000 })
    const aviso = await screen.findByText(RONDA_2_SOLA, {}, { timeout: 5000 })
    expect(aviso.closest('[role="status"]')).not.toBeNull()

    // Al volver a la ronda anterior el aviso se va (la sala ya no está en r2_abierta).
    expect((await responderMock('POST', `/api/admin/salas/${id}/acciones`, { accion: 'volver_ronda_anterior' })).status).toBe(200)
    await screen.findByText('Ronda 1 abierta', { selector: '.estado' }, { timeout: 5000 })
    expect(screen.queryByText(RONDA_2_SOLA)).toBeNull()
  }, 20_000)

  it('no se ve si la ronda 2 se abrió a mano', async () => {
    const id = await abrirSala()
    for (const accion of ['cerrar_ronda_1', 'abrir_ronda_2']) {
      expect((await responderMock('POST', `/api/admin/salas/${id}/acciones`, { accion })).status).toBe(200)
    }
    await screen.findByText('Ronda 2 abierta', { selector: '.estado' }, { timeout: 5000 })
    expect(screen.queryByText(RONDA_2_SOLA)).toBeNull()
    expect((await detalle(id)).eventos.some((ev) => ev.tipo === 'ronda_2_automatica')).toBe(false)
  }, 20_000)
})
