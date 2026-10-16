// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import mockJson from '../../mocks/GET_api_tablero.json'
import PaginaTablero from './PaginaTablero'
import type { DatosTablero } from './tipos'

const mock = mockJson as unknown as DatosTablero

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/tablero/:sala/*" element={<PaginaTablero />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PaginaTablero', () => {
  let llamadas: string[]
  beforeEach(() => {
    llamadas = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        llamadas.push(url)
        return new Response(JSON.stringify(mock), { status: 200, headers: { ETag: `"${mock.version}"` } })
      }),
    )
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  test('muestra matriz, paneles, progreso y aviso de precierre', async () => {
    montar('/tablero/s_demo?t=tok')
    expect(await screen.findByRole('heading', { name: mock.sala.nombre })).toBeTruthy()
    expect(llamadas[0]).toBe('/api/tablero/s_demo?alcance=sala&t=tok')
    expect(document.querySelector('svg.hz-matriz')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'INSUMEX' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'NUTRIWHAT' })).toBeTruthy()
    expect(screen.getByText('Mesa 1: todos votaron')).toBeTruthy()
    expect(screen.getByText('Preliminar')).toBeTruthy()
    // R2 abierta: vista por defecto Ronda 2
    expect(screen.getByRole('button', { name: 'Ronda 2' }).getAttribute('aria-pressed')).toBe('true')
    // con token: selector de alcance
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  test('sin token no hay selector de alcance y respeta ?mesa=', async () => {
    montar('/tablero/s_demo?mesa=m2')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(llamadas[0]).toBe('/api/tablero/s_demo?alcance=mesa&mesa=m2')
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  test('error sin datos muestra texto útil', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { codigo: 'X', mensaje: 'x' } }), { status: 403 })))
    montar('/tablero/s_demo')
    expect(await screen.findByText(/No pudimos abrir el tablero/)).toBeTruthy()
    expect(screen.getByText(/token/)).toBeTruthy()
  })

  test('atajos: C, 1 y 2 cambian la vista; F oculta los controles', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const pulsado = () => document.querySelector('.hz-segmento [aria-pressed="true"]')?.textContent
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(pulsado()).toBe('Comparación'))
    await waitFor(() => expect(document.querySelectorAll('.hz-flecha').length).toBe(2))
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(pulsado()).toBe('Ronda 1'))
    // dentro del selector de alcance no se interceptan teclas
    fireEvent.keyDown(screen.getByRole('combobox'), { key: '2' })
    await waitFor(() => expect(pulsado()).toBe('Ronda 1'))
    // jsdom no tiene requestFullscreen: F igual activa el modo sin controles
    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => expect(document.querySelector('main')?.className).toContain('hz-pantalla-completa'))
    fireEvent.keyDown(window, { key: 'F' })
    await waitFor(() => expect(document.querySelector('main')?.className).not.toContain('hz-pantalla-completa'))
  })

  test('cambiar de alcance no desmonta la página ni pierde la vista elegida', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    fireEvent.keyDown(window, { key: 'c' })
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'm2' } })
    expect(screen.getByRole('combobox')).toBe(select)
    expect(screen.queryByText('Cargando el tablero…')).toBeNull()
    await waitFor(() => expect(llamadas.at(-1)).toBe('/api/tablero/s_demo?alcance=mesa&mesa=m2&t=tok'))
    expect(document.querySelector('.hz-segmento [aria-pressed="true"]')?.textContent).toBe('Comparación')
  })

  test('todas las mesas: una matriz por mesa con inscritos, solo con token', async () => {
    montar('/tablero/s_demo?t=tok&vista=mesas')
    await screen.findByRole('heading', { name: 'Mesa 3' })
    expect(screen.getByRole('heading', { name: 'Mesa 1' })).toBeTruthy()
    await waitFor(() => expect(document.querySelectorAll('svg.hz-matriz').length).toBe(3))
    expect(llamadas[0]).toBe('/api/tablero/s_demo?alcance=sala&t=tok')
    await waitFor(() => expect(llamadas).toContain('/api/tablero/s_demo?alcance=mesa&mesa=m2&t=tok'))
    expect(screen.getByText('7 de 7, todos votaron')).toBeTruthy()
    cleanup()
    llamadas.length = 0
    montar('/tablero/s_demo?vista=mesas')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(screen.queryByRole('heading', { name: 'Mesa 3' })).toBeNull()
  })

  test('progreso con más completos que inscritos no pasa del 100 %', async () => {
    const raro = structuredClone(mock)
    raro.progreso.completos = 25
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(raro), { status: 200 })))
    montar('/tablero/s_demo')
    const barra = await screen.findByRole('progressbar')
    expect(Number(barra.getAttribute('aria-valuenow'))).toBeLessThanOrEqual(Number(barra.getAttribute('aria-valuemax')))
    expect((barra.firstChild as HTMLElement).style.width).toBe('100%')
  })

  test('estado vacío de la ronda 1', async () => {
    const vacio = structuredClone(mock)
    vacio.sala.estado = 'r1_abierta'
    vacio.sala.ronda_actual = 1
    for (const v of vacio.proyectos_vivos) for (const r of v.rondas) Object.assign(r, { n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(vacio), { status: 200 })))
    montar('/tablero/s_demo')
    expect(await screen.findByText('Aún no hay votos en la ronda 1')).toBeTruthy()
    await act(async () => {})
  })
})
