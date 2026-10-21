// @vitest-environment jsdom
// Eliminar salas, mesas y administradores desde el panel (pedido de Paola, 21-oct), contra el simulador.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { salaRecordada } from './memoria'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { textoEvento } from './textos'
import { motivoNoEliminarMesa } from './paginas/MesasQR'

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

async function salaNueva(nombre: string, mesas: number) {
  fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: nombre } })
  fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: String(mesas) } })
  fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
  await screen.findByRole('heading', { name: 'Sala en vivo' })
  await screen.findByText('Preparada', { selector: '.estado' })
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
  usarTransporte(responderMock)
})
afterEach(() => cleanup())

describe('Eliminar sala (Configuración)', () => {
  it('pide el nombre exacto, advierte si la sala está abierta y vuelve a Salas con un aviso', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(nav().getByText('Configuración'))
    const zona = within(await screen.findByRole('region', { name: 'Eliminar sala' }))
    expect(zona.getByText(/No se puede deshacer/)).toBeTruthy()
    const abrir = zona.getByRole('button', { name: 'Eliminar sala' })
    expect(abrir.className).toContain('hz-boton--peligro')
    fireEvent.click(abrir)

    const nombreSala = (await screen.findByText(/^Escribe el nombre de la sala para confirmar: /)).textContent!.replace('Escribe el nombre de la sala para confirmar: ', '')
    const dialogo = within(screen.getByRole('dialog', { name: `¿Eliminar «${nombreSala}»?` }))
    // La sala de ejemplo tiene la ronda 1 abierta.
    expect(dialogo.getByText(/^La sala está abierta \(ronda 1 abierta\): hay gente entrando o votando/)).toBeTruthy()
    expect(dialogo.getByText(/queda un respaldo de la base en el servidor/)).toBeTruthy()
    const campo = dialogo.getByLabelText(/^Escribe el nombre de la sala/) as HTMLInputElement
    expect(document.activeElement).toBe(campo)
    const confirmar = dialogo.getByRole('button', { name: 'Eliminar sala' }) as HTMLButtonElement
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(campo, { target: { value: nombreSala.toUpperCase() } })
    expect(confirmar.disabled).toBe(true)
    fireEvent.change(campo, { target: { value: nombreSala } })
    expect(confirmar.disabled).toBe(false)
    fireEvent.click(confirmar)

    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    expect(screen.getByText(`Eliminamos la sala «${nombreSala}». Quedó un respaldo de la base en el servidor.`)).toBeTruthy()
    expect(salaRecordada()).toBeNull()
    expect(((await responderMock('GET', '/api/admin/salas')).body as unknown[]).length).toBe(0)
  })

  it('Cancelar o Esc cierran el diálogo sin borrar y el foco vuelve al botón', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
    fireEvent.click(nav().getByText('Configuración'))
    const abrir = within(await screen.findByRole('region', { name: 'Eliminar sala' })).getByRole('button', { name: 'Eliminar sala' })
    fireEvent.click(abrir)
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(abrir)
    expect(((await responderMock('GET', '/api/admin/salas')).body as unknown[]).length).toBe(1)
  })

  it('una sala preparada no muestra el aviso de sala abierta', async () => {
    montar('/admin/login')
    await entrar()
    await salaNueva('Sala quieta', 1)
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.click(within(await screen.findByRole('region', { name: 'Eliminar sala' })).getByRole('button', { name: 'Eliminar sala' }))
    const dialogo = within(await screen.findByRole('dialog', { name: '¿Eliminar «Sala quieta»?' }))
    expect(dialogo.queryByText(/La sala está abierta/)).toBeNull()
  })

  it('un admin normal no ve la zona de eliminar', async () => {
    montar('/admin/login')
    await entrar('jorge')
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByRole('region', { name: 'Rúbricas' })
    expect(screen.queryByRole('region', { name: 'Eliminar sala' })).toBeNull()
    // El simulador responde como el servidor.
    const r = await responderMock('DELETE', '/api/admin/salas/s_demo', { confirmar: 'x' })
    expect(r.status).toBe(403)
  })
})

describe('Eliminar mesa (Mesas y QR)', () => {
  it('con inscritos el botón está deshabilitado y explica por qué', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(await screen.findByRole('link', { name: 'Abrir' }))
    fireEvent.click(nav().getByText('Mesas y QR'))
    const boton = (await screen.findByRole('button', { name: 'Eliminar Mesa 1' })) as HTMLButtonElement
    expect(boton.disabled).toBe(true)
    const motivo = document.getElementById(boton.getAttribute('aria-describedby')!)!
    expect(motivo.textContent).toBe('Tiene 4 personas inscritas. Para eliminarla, muévelas a otra mesa en Participantes.')
  })

  it('pide confirmar con el foco en Cancelar, elimina la mesa y deja la última sin poder borrarse', async () => {
    montar('/admin/login')
    await entrar()
    await salaNueva('Sala con mesas', 2)
    fireEvent.click(nav().getByText('Mesas y QR'))
    fireEvent.click(await screen.findByRole('button', { name: 'Eliminar Mesa 2' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar Mesa 2?' })
    expect(document.activeElement?.textContent).toBe('Cancelar')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, eliminar mesa' }))
    expect(await screen.findByText('Eliminamos Mesa 2.')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Eliminar Mesa 2' })).toBeNull())
    const ultima = screen.getByRole('button', { name: 'Eliminar Mesa 1' }) as HTMLButtonElement
    expect(ultima.disabled).toBe(true)
    expect(screen.getByText('Es la única mesa de la sala: una sala necesita al menos una.')).toBeTruthy()
    // Queda en la bitácora.
    fireEvent.click(nav().getByText('Sala en vivo'))
    expect(await screen.findByText(/^Se eliminó Mesa 2 \(código .+\) · paola$/)).toBeTruthy()
  })

  it('cuenta también a los inscritos inactivos', () => {
    const d = { mesas: [{ id: 'm1' }, { id: 'm2' }], participantes: [{ mesa_id: 'm1', activo: false }] } as never
    expect(motivoNoEliminarMesa(d, { id: 'm1' })).toBe('Tiene 1 persona inscrita. Para eliminarla, muévelas a otra mesa en Participantes.')
    expect(motivoNoEliminarMesa(d, { id: 'm2' })).toBeNull()
  })

  it('la bitácora nombra la mesa eliminada aunque ya no exista', () => {
    expect(textoEvento({ tipo: 'mesa_eliminada', detalle: { mesa_id: 'm9', nombre: 'Mesa 9', codigo: 'ABC-9' }, por: 'admin:jorge' })).toBe('Se eliminó Mesa 9 (código ABC-9) · jorge')
    expect(textoEvento({ tipo: 'mesa_eliminada', detalle: null, por: 'admin:jorge' })).toBe('Se eliminó una mesa · jorge')
  })
})

describe('Eliminar administrador', () => {
  it('«Eliminar» va junto a «Desactivar», pide confirmar y quita la cuenta; la superadministradora no lo tiene', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(nav().getByText('Administradores'))
    const fila = (await screen.findByRole('rowheader', { name: 'Jorge Puentes' })).closest('tr')!
    const botones = within(fila).getAllByRole('button').map((b) => b.textContent)
    expect(botones).toEqual(['Restablecer clave', 'Desactivar', 'Eliminar'])
    const filaPaola = screen.getByRole('rowheader', { name: 'Paola Porras' }).closest('tr')!
    expect(within(filaPaola).queryByRole('button', { name: /Eliminar/ })).toBeNull()

    fireEvent.click(within(fila).getByRole('button', { name: 'Eliminar a Jorge Puentes' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Eliminar la cuenta de Jorge Puentes?' })
    expect(document.activeElement?.textContent).toBe('Cancelar')
    expect(within(dialogo).getByText(/Las salas que creó y lo que hizo en la bitácora se conservan/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, eliminar cuenta' }))
    expect(await screen.findByText('Eliminamos la cuenta de Jorge Puentes (usuario jorge).')).toBeTruthy()
    await waitFor(() => expect(screen.queryByRole('rowheader', { name: 'Jorge Puentes' })).toBeNull())
  })

  it('el simulador no deja eliminar la propia cuenta', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    const r = await responderMock('DELETE', '/api/admin/admins/1')
    expect(r.status).toBe(409)
  })
})
