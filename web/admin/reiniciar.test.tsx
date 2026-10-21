// @vitest-environment jsdom
// «Reiniciar…» en Sala en vivo (decisión 3 de Paola, 21-oct): el administrador elige qué reiniciar. Contra el simulador
// del panel; la misma ruta contra la API real está en admin.real.test.tsx.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { opcionesReinicio, textoEvento } from './textos'
import type { EstadoSala } from './tipos'

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
async function abrirDemo() {
  montar('/admin/login')
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'paola' } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
  fireEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
  await screen.findByRole('heading', { name: 'Sala en vivo' })
  await screen.findByText('Ronda 1 abierta', { selector: '.estado' })
  const lista = (await responderMock('GET', '/api/admin/salas')).body as { id: string; nombre: string }[]
  return lista[0]
}

const corregir = () => within(screen.getByRole('group', { name: 'Corregir' }))
const abrirDialogo = async () => {
  fireEvent.click(corregir().getByRole('button', { name: 'Reiniciar…' }))
  return within(await screen.findByRole('dialog', { name: '¿Qué quieres reiniciar?' }))
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
  usarTransporte(responderMock)
})
afterEach(() => cleanup())

describe('opciones según el estado', () => {
  it('solo las que aplican, en orden, cada una con su línea de qué pasa y sin rayas', () => {
    const ids = (e: EstadoSala) => opcionesReinicio(e).map((o) => o.id)
    expect(ids('preparada')).toEqual([])
    expect(ids('inscripcion')).toEqual(['sala'])
    expect(ids('r1_abierta')).toEqual(['volver', 'ronda_1', 'sala'])
    expect(ids('r1_cerrada')).toEqual(['volver', 'ronda_1', 'sala'])
    expect(ids('r2_abierta')).toEqual(['volver', 'ronda_2', 'ronda_1', 'sala'])
    expect(ids('r2_cerrada')).toEqual(['volver', 'ronda_2', 'ronda_1', 'sala'])
    expect(ids('cerrada')).toEqual(['sala'])
    const volverR2 = opcionesReinicio('r2_abierta')[0]
    expect(volverR2).toMatchObject({ cuerpo: { accion: 'volver_ronda_anterior' }, borra: false })
    expect(volverR2.quePasa).toBe('La sala vuelve a la ronda 1 abierta. Se conservan todos los votos de las dos rondas.')
    expect(opcionesReinicio('r1_cerrada')[0].quePasa).toBe('La sala vuelve a la inscripción abierta. Se conservan los votos de la ronda 1.')
    expect(opcionesReinicio('r2_cerrada').find((o) => o.id === 'ronda_2')).toMatchObject({
      cuerpo: { accion: 'reiniciar_desde_ronda', ronda: 2 },
      quePasa: 'Borra solo los votos de la ronda 2 y deja la ronda 2 abierta para votar de nuevo.',
    })
    expect(opcionesReinicio('r2_cerrada').find((o) => o.id === 'ronda_1')?.quePasa).toBe('Borra los votos de la ronda 1 y de la ronda 2 y deja la ronda 1 abierta.')
    expect(opcionesReinicio('cerrada')[0]).toMatchObject({ cuerpo: { accion: 'reiniciar_sala' }, borra: true })
    for (const e of ['r2_abierta', 'r1_abierta', 'cerrada'] as EstadoSala[]) {
      for (const o of opcionesReinicio(e)) for (const t of [o.titulo, o.quePasa, o.boton, o.hecho]) expect(t).not.toMatch(/[—–]/)
    }
  })

  it('la bitácora cuenta cada reinicio en palabras', () => {
    expect(textoEvento({ tipo: 'ronda_anterior', detalle: { hacia: 'r1_abierta', ronda: 1 }, por: 'admin:paola' })).toBe(
      'Volvió a la ronda 1 abierta, con los votos de las dos rondas · paola',
    )
    expect(textoEvento({ tipo: 'ronda_anterior', detalle: { hacia: 'inscripcion' }, por: 'admin:nico' })).toBe('Volvió a la inscripción abierta, con los votos de la ronda 1 · nico')
    expect(textoEvento({ tipo: 'reinicio_ronda', detalle: { ronda: 2, rondas_borradas: [2], votos_borrados: 4 }, por: 'admin:paola' })).toBe(
      'Ronda 2 reiniciada: sus votos borrados (4 votos) · paola',
    )
    expect(textoEvento({ tipo: 'reinicio_ronda', detalle: { ronda: 1, rondas_borradas: [1, 2], votos_borrados: 1 }, por: 'admin:paola' })).toBe(
      'Ronda 1 reiniciada: votos de las dos rondas borrados (1 voto) · paola',
    )
    expect(textoEvento({ tipo: 'reinicio_sala', detalle: { votos_borrados: 10 }, por: 'admin:paola' })).toBe(
      'Sala reiniciada: votos de las dos rondas borrados, inscripción abierta (10 votos) · paola',
    )
  })
})

describe('«Reiniciar…» en Corregir', () => {
  it('abre el diálogo con las opciones de la ronda 1; sin elegir no se aplica; Esc cierra y devuelve el foco', async () => {
    await abrirDemo()
    expect(corregir().queryByRole('button', { name: 'Reiniciar votos de la ronda' })).toBeNull()
    const dialogo = await abrirDialogo()
    expect(dialogo.getByText('Estado actual: Ronda 1 abierta. Solo aparecen las opciones que aplican.')).toBeTruthy()
    expect(dialogo.getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual([
      'Volver a la ronda anteriorLa sala vuelve a la inscripción abierta. Se conservan los votos de la ronda 1.',
      'Reiniciar la ronda 1Borra los votos de la ronda 1 y la deja abierta para votar de nuevo.',
      'Reiniciar la sala completaBorra los votos de las dos rondas y vuelve a la inscripción abierta. Se conservan las mesas y los inscritos. Antes queda un respaldo de la base.',
    ])
    // Ninguna viene marcada; el foco va a la primera y la línea de qué pasa la describe.
    expect(dialogo.getAllByRole('radio').every((r) => !(r as HTMLInputElement).checked)).toBe(true)
    const primera = dialogo.getAllByRole('radio')[0]
    expect(document.activeElement).toBe(primera)
    expect(document.getElementById(primera.getAttribute('aria-describedby')!)?.textContent).toMatch(/^La sala vuelve a la inscripción abierta/)
    expect((dialogo.getByRole('button', { name: 'Reiniciar' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent(screen.getByRole('dialog'), new Event('cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(corregir().getByRole('button', { name: 'Reiniciar…' }))
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
  })

  it('«Volver a la ronda anterior» desde la ronda 2 deja la ronda 1 abierta, avisa y queda en la bitácora', async () => {
    const sala = await abrirDemo()
    for (const accion of ['cerrar_ronda_1', 'abrir_ronda_2']) expect((await responderMock('POST', `/api/admin/salas/${sala.id}/acciones`, { accion })).status).toBe(200)
    await screen.findByText('Ronda 2 abierta', { selector: '.estado' }, { timeout: 5000 })
    const dialogo = await abrirDialogo()
    expect(dialogo.getAllByRole('radio')).toHaveLength(4)
    fireEvent.click(dialogo.getByLabelText(/^Volver a la ronda anterior/))
    const aplicar = dialogo.getByRole('button', { name: 'Volver a la ronda anterior' }) as HTMLButtonElement
    expect(aplicar.disabled).toBe(false)
    expect(aplicar.className).toContain('hz-boton--primario')
    fireEvent.click(aplicar)
    await screen.findByText('Ronda 1 abierta', { selector: '.estado' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('Volviste a la ronda 1 abierta. Los votos se conservan.')).toBeTruthy()
    expect(await screen.findByText(/Volvió a la ronda 1 abierta, con los votos de las dos rondas/)).toBeTruthy()
  })

  it('«Reiniciar la ronda 2» borra en rojo y deja la ronda 2 abierta', async () => {
    const sala = await abrirDemo()
    for (const accion of ['cerrar_ronda_1', 'abrir_ronda_2', 'cerrar_ronda_2']) await responderMock('POST', `/api/admin/salas/${sala.id}/acciones`, { accion })
    await screen.findByText('Ronda 2 cerrada', { selector: '.estado' }, { timeout: 5000 })
    const dialogo = await abrirDialogo()
    fireEvent.click(dialogo.getByLabelText(/^Reiniciar la ronda 2/))
    expect(dialogo.getByText('Lo borrado no se puede deshacer desde el panel. Queda registrado en la bitácora.')).toBeTruthy()
    const aplicar = dialogo.getByRole('button', { name: 'Reiniciar la ronda 2' })
    expect(aplicar.className).toContain('hz-boton--destructivo')
    fireEvent.click(aplicar)
    await screen.findByText('Ronda 2 abierta', { selector: '.estado' })
    expect(screen.getByText('Reiniciaste la ronda 2: sus votos se borraron y está abierta.')).toBeTruthy()
  })

  it('«Reiniciar la sala completa» pide el nombre exacto y vuelve a la inscripción; un error del servidor sale en el diálogo', async () => {
    const sala = await abrirDemo()
    const dialogo = await abrirDialogo()
    fireEvent.click(dialogo.getByLabelText(/^Reiniciar la sala completa/))
    const campo = dialogo.getByLabelText(`Escribe el nombre de la sala para confirmar: ${sala.nombre}`)
    const aplicar = dialogo.getByRole('button', { name: 'Reiniciar la sala' }) as HTMLButtonElement
    expect(aplicar.disabled).toBe(true)
    fireEvent.change(campo, { target: { value: sala.nombre.toUpperCase() } })
    expect(aplicar.disabled).toBe(true)
    // Si el servidor rechaza (otra pestaña cambió el estado), el mensaje sale en el diálogo y nada se cierra.
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      metodo === 'POST' && ruta.endsWith('/acciones')
        ? { status: 409, body: { error: { codigo: 'TRANSICION_INVALIDA', mensaje: 'No se puede reiniciar la sala completa: la sala está preparada.' } } }
        : responderMock(metodo, ruta, cuerpo, etag),
    )
    fireEvent.change(campo, { target: { value: ` ${sala.nombre} ` } })
    expect(aplicar.disabled).toBe(false)
    fireEvent.click(aplicar)
    expect((await dialogo.findByRole('alert')).textContent).toBe('No se puede reiniciar la sala completa: la sala está preparada.')
    usarTransporte(responderMock)
    fireEvent.click(aplicar)
    await screen.findByText('Inscripción abierta', { selector: '.estado' })
    expect(screen.getByText('Reiniciaste la sala: los votos se borraron y la inscripción está abierta. Quedó un respaldo de la base en el servidor.')).toBeTruthy()
    // En inscripción solo queda la sala completa.
    const otra = await abrirDialogo()
    expect(otra.getAllByRole('radio')).toHaveLength(1)
  })
})

describe('simulador', () => {
  it('responde como el servidor: 422 sin ronda ni nombre, 409 fuera de estado', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    const sala = ((await responderMock('GET', '/api/admin/salas')).body as { id: string; nombre: string }[])[0]
    const acc = (cuerpo: object) => responderMock('POST', `/api/admin/salas/${sala.id}/acciones`, cuerpo)
    expect((await acc({ accion: 'reiniciar_desde_ronda' })).status).toBe(422)
    expect((await acc({ accion: 'reiniciar_desde_ronda', ronda: 2 })).status).toBe(409)
    expect((await acc({ accion: 'reiniciar_sala', confirmar: 'otra' })).status).toBe(422)
    expect((await acc({ accion: 'reiniciar_desde_ronda', ronda: 1 })).status).toBe(200)
    expect((await acc({ accion: 'volver_ronda_anterior' })).status).toBe(200)
    expect((await acc({ accion: 'volver_ronda_anterior' })).status).toBe(409)
    expect((await acc({ accion: 'reiniciar_sala', confirmar: sala.nombre })).status).toBe(200)
  })
})
