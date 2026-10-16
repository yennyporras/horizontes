// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { ACCIONES_POR_ESTADO, bogotaLocalAIso, faltan, isoABogotaLocal, rutaApiTablero, textoEvento, urlTableroSala } from './textos'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario: string) {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  usarTransporte(responderMock)
})
afterEach(cleanup)

describe('textos del panel', () => {
  it('convierte hora Bogotá ida y vuelta', () => {
    expect(bogotaLocalAIso('2026-10-20T18:00')).toBe('2026-10-20T18:00:00-05:00')
    expect(isoABogotaLocal('2026-10-20T18:00:00-05:00')).toBe('2026-10-20T18:00')
    expect(isoABogotaLocal('2026-10-20T23:00:00Z')).toBe('2026-10-20T18:00')
    expect(bogotaLocalAIso('2026-10-20')).toBeNull()
  })

  it('cuenta regresiva legible', () => {
    expect(faltan(65 * 60 * 1000)).toBe('1 h 05 min')
    expect(faltan(249 * 1000)).toBe('4 min 09 s')
    expect(faltan(-1)).toBe('ya')
  })

  it('deriva el tablero de sala y la ruta de la API del tablero', () => {
    const mesa = 'https://horizontes.estratek.com.co/tablero/HZ7K2?mesa=m1&t=TOK'
    expect(urlTableroSala(undefined, mesa)).toBe('https://horizontes.estratek.com.co/tablero/HZ7K2?t=TOK')
    expect(urlTableroSala('/x', mesa)).toBe('/x')
    expect(rutaApiTablero('s_demo', mesa, 'm1')).toBe('/api/tablero/s_demo?alcance=mesa&mesa=m1&t=TOK')
    expect(rutaApiTablero('s_demo', mesa)).toBe('/api/tablero/s_demo?alcance=sala&t=TOK')
  })

  it('describe los eventos de la bitácora en lenguaje claro', () => {
    expect(textoEvento({ tipo: 'ronda_cerrada', detalle: { ronda: 1 }, por: 'admin:paola' })).toBe('Ronda 1 cerrada · paola')
    expect(textoEvento({ tipo: 'inscripcion_abierta', detalle: {}, por: 'admin:paola' })).toBe('Inscripción abierta · paola')
    expect(textoEvento({ tipo: 'cierre_programado', detalle: {}, por: 'programado' })).toBe('Cierre programado aplicado · automático')
    expect(textoEvento({ tipo: 'precierre', detalle: { mensaje: 'Todos votaron en Mesa 1. Puedes cerrar la ronda.' }, por: 'sistema' })).toBe('Todos votaron en Mesa 1. Puedes cerrar la ronda.')
  })

  it('abrir R2 exige R1 cerrada y la sala cerrada solo se reabre', () => {
    expect(ACCIONES_POR_ESTADO.r1_abierta).not.toContain('abrir_ronda_2')
    expect(ACCIONES_POR_ESTADO.r1_cerrada).toContain('abrir_ronda_2')
    expect(ACCIONES_POR_ESTADO.cerrada).toEqual(['reabrir_sala'])
  })
})

describe('panel admin contra el simulador', () => {
  it('sin sesión manda al login', async () => {
    montar('/admin/salas')
    expect(await screen.findByRole('heading', { name: 'Panel de administración' })).toBeTruthy()
  })

  it('el admin normal no ve Administradores y la ruta le muestra sin permiso', async () => {
    montar('/admin/login')
    await entrar('jorge')
    const nav = screen.getByRole('navigation', { name: 'Secciones del panel' })
    expect(within(nav).queryByText('Administradores')).toBeNull()
    cleanup()
    montar('/admin/administradores')
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeTruthy()
  })

  it('el superadmin crea un admin con clave temporal', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Administradores'))
    await screen.findByRole('heading', { name: 'Nuevo administrador' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'nicolai' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nicolai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear administrador' }))
    expect(await screen.findByText(/Creamos la cuenta de Nicolai/)).toBeTruthy()
    expect(await screen.findByRole('rowheader', { name: 'Nicolai' })).toBeTruthy()
  })

  it('crea una sala y recorre el ciclo de estados con botones inválidos deshabilitados', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Ensayo' } })
    fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    await screen.findByText('Preparada')

    const boton = (n: string) => screen.getByRole('button', { name: n }) as HTMLButtonElement
    expect(boton('Abrir ronda 1').disabled).toBe(true)
    const pasos: [string, string][] = [
      ['Abrir inscripción', 'Inscripción abierta'],
      ['Abrir ronda 1', 'Ronda 1 abierta'],
      ['Cerrar ronda 1', 'Ronda 1 cerrada'],
      ['Abrir ronda 2', 'Ronda 2 abierta'],
      ['Cerrar ronda 2', 'Ronda 2 cerrada'],
    ]
    for (const [accion, estado] of pasos) {
      await waitFor(() => expect(boton(accion).disabled).toBe(false))
      fireEvent.click(boton(accion))
      await screen.findByText(estado, { selector: '.estado' })
    }
    // Cerrar sala pide confirmación.
    fireEvent.click(boton('Cerrar sala'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la sala' }))
    await screen.findByText('Sala cerrada', { selector: '.estado' })
    expect(boton('Reabrir sala').disabled).toBe(false)
  })

  it('el monitor de salud muestra el servidor y la latencia', async () => {
    montar('/admin/login')
    await entrar('jorge')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Salud'))
    expect(await screen.findByText('En línea')).toBeTruthy()
    expect(screen.getByText('Versión desplegada: simulador')).toBeTruthy()
    expect(screen.getByText('p95')).toBeTruthy()
  })

  it('avisa el precierre de una mesa sin cerrar la ronda y muestra el resultado preliminar', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    // En el simulador inicial la Mesa 1 tiene a todos sus inscritos completos.
    expect(await screen.findByText(/Todos votaron en Mesa 1/, { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado de Mesa 1' }))
    expect(await screen.findByRole('heading', { name: /Resultado preliminar · Mesa 1/ })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'INSUMEX' })).toBeTruthy()
  })
})
