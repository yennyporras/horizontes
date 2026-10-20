// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import mockJson from '../../mocks/GET_api_tablero.json'
import PaginaTablero from './PaginaTablero'
import type { DatosTablero } from './tipos'

// El mock del servidor viene en modo guiado con una pregunta fijada; las pruebas de la matriz parten sin ella.
const mock = structuredClone(mockJson) as unknown as DatosTablero
mock.sala.pregunta_guiada = null

/** Por defecto el tablero muestra solo la matriz (preentrega del 19-oct); M abre los datos. */
async function verDatos() {
  fireEvent.keyDown(window, { key: 'm' })
  await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
}

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

  test('tema carbón y encabezado de marca: nombre de la sala y firma «Horizontes por Estratek »»', async () => {
    montar('/tablero/s_demo?t=tok')
    // Mientras carga, también en carbón (sin destello claro en el proyector).
    expect(document.querySelector('main')!.dataset.tema).toBe('carbon')
    const titulo = await screen.findByRole('heading', { level: 1, name: mock.sala.nombre })
    expect(document.querySelector('main')!.dataset.tema).toBe('carbon')
    const firma = titulo.closest('.hz-cab')!.querySelector('.hz-firma')!
    expect(firma.textContent!.replace(/\s+/g, ' ').trim()).toBe('Horizontes por Estratek »')
    // También en <html> (fondo del rebote y theme-color).
    expect(document.documentElement.dataset.tema).toBe('carbon')
    // La » es la marca gráfica: decorativa para el lector de pantalla.
    expect(firma.querySelector('.hz-firma-flecha')!.getAttribute('aria-hidden')).toBe('true')
  })

  test('por defecto solo la matriz; clic en ella, el botón, M o Esc alternan con los datos', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(document.querySelector('main')!.className).toContain('hz-matriz-sola')
    expect(document.querySelector('.hz-lateral')).toBeNull()
    expect(document.querySelector('.hz-comparada, .hz-panel')).toBeNull()
    // Clic (sin arrastre) sobre la matriz: aparecen los datos; otro clic, de nuevo sola.
    const lienzo = document.querySelector('.hz-lienzo')!
    // jsdom no trae PointerEvent: un MouseEvent con pointerId hace de puntero.
    const puntero = (tipo: string, x: number, y: number) =>
      act(() => {
        const ev = new MouseEvent(tipo, { bubbles: true, button: 0, clientX: x, clientY: y })
        Object.defineProperty(ev, 'pointerId', { value: 1 })
        lienzo.dispatchEvent(ev)
      })
    const clic = () => {
      puntero('pointerdown', 100, 100)
      puntero('pointerup', 101, 100)
    }
    clic()
    expect(document.querySelector('.hz-lateral')).toBeTruthy()
    expect(document.querySelector('main')!.className).not.toContain('hz-matriz-sola')
    clic()
    expect(document.querySelector('.hz-lateral')).toBeNull()
    // Un arrastre no cuenta como clic.
    puntero('pointerdown', 100, 100)
    puntero('pointermove', 160, 130)
    puntero('pointerup', 160, 130)
    expect(document.querySelector('.hz-lateral')).toBeNull()
    // Botón accesible y teclas M y Esc.
    fireEvent.click(screen.getByRole('button', { name: 'Ver datos M' }))
    expect(document.querySelector('.hz-lateral')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Solo la matriz M' }))
    expect(document.querySelector('.hz-lateral')).toBeNull()
    fireEvent.keyDown(window, { key: 'm' })
    expect(document.querySelector('.hz-lateral')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'm' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.hz-lateral')).toBeTruthy()
    // D desde la matriz sola abre los datos en «Cómo votó» (para el facilitador).
    fireEvent.keyDown(window, { key: 'm' })
    fireEvent.keyDown(window, { key: 'd' })
    expect(await screen.findByRole('heading', { name: 'Cómo votó la mesa' })).toBeTruthy()
  })

  test('muestra matriz, paneles, progreso y aviso de precierre', async () => {
    montar('/tablero/s_demo?t=tok')
    expect(await screen.findByRole('heading', { name: mock.sala.nombre })).toBeTruthy()
    expect(llamadas[0]).toBe('/api/tablero/s_demo?alcance=sala&t=tok')
    expect(document.querySelector('svg.hz-matriz')).toBeTruthy()
    await verDatos()
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

  test('sin permiso (401 o 403): texto útil y deja de consultar', async () => {
    for (const status of [401, 403]) {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const f = vi.fn(async () => new Response(JSON.stringify({ error: { codigo: 'X', mensaje: 'x' } }), { status }))
      vi.stubGlobal('fetch', f)
      montar('/tablero/s_demo')
      expect(await screen.findByText(/No pudimos abrir el tablero/)).toBeTruthy()
      expect(screen.getByText('Este enlace del tablero no tiene permiso. Pide al facilitador el enlace completo del tablero.')).toBeTruthy()
      await act(async () => vi.advanceTimersByTime(10_000))
      expect(f).toHaveBeenCalledTimes(1)
      cleanup()
      vi.useRealTimers()
    }
  })

  test('franja de fase de la ronda abierta', async () => {
    montar('/tablero/s_demo?t=tok')
    expect(await screen.findByText('Ronda 2 · discusión en la mesa')).toBeTruthy()
    cleanup()
    const r1 = structuredClone(mock)
    r1.sala.estado = 'r1_abierta'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(r1), { status: 200 })))
    montar('/tablero/s_demo?t=tok')
    expect(await screen.findByText('Ronda 1 · individual y en silencio')).toBeTruthy()
    cleanup()
    r1.sala.estado = 'r2_cerrada'
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(document.querySelector('.hz-franja')).toBeNull()
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

  test('«Cómo votó»: el botón o la tecla D cambian la tabla por el conteo 1-3-5-7-9, sin tapar la matriz', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    await verDatos()
    const detalle = screen.getByRole('group', { name: 'Detalle del panel' })
    expect(within(detalle).getByRole('button', { name: 'Promedios' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('heading', { name: 'Cómo votó la mesa' })).toBeNull()
    fireEvent.click(within(detalle).getByRole('button', { name: 'Cómo votó' }))
    expect(screen.getByRole('heading', { name: 'Cómo votó la mesa' })).toBeTruthy()
    expect(document.querySelector('svg.hz-matriz')).toBeTruthy()
    expect(document.querySelector('.hz-comparada')).toBeNull()
    // Vista Ronda 2 (la de R2 abierta): solo barras R2; en Comparación, R1 y R2.
    expect(document.querySelectorAll('.hz-cv-barras-r1')).toHaveLength(0)
    expect(document.querySelectorAll('.hz-cv-barras-r2')).toHaveLength(mock.proyectos_vivos.length * mock.criterios.length)
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(document.querySelectorAll('.hz-cv-barras-r1')).toHaveLength(mock.proyectos_vivos.length * mock.criterios.length))
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => expect(document.querySelector('.hz-cv')).toBeNull())
    expect(document.querySelector('.hz-comparada')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'D' })
    await waitFor(() => expect(document.querySelector('.hz-cv')).toBeTruthy())
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

  test('zoom: botones con etiqueta, teclas +, − y 0, rueda; cambia el viewBox sin reemplazar el SVG', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const grupo = screen.getByRole('group', { name: 'Zoom de la matriz' })
    const nivel = () => within(grupo).getByRole('status').textContent
    const svg = document.querySelector('svg.hz-matriz')!
    const completa = svg.getAttribute('viewBox')
    expect(nivel()).toBe('100 %')
    expect(within(grupo).getByRole('button', { name: 'Alejar' })).toHaveProperty('disabled', true)
    expect(within(grupo).getByRole('button', { name: 'Ver todo' })).toHaveProperty('disabled', true)
    fireEvent.click(within(grupo).getByRole('button', { name: 'Acercar' }))
    expect(nivel()).toBe('150 %')
    expect(svg.getAttribute('viewBox')).not.toBe(completa)
    expect(document.querySelector('svg.hz-matriz')).toBe(svg)
    expect(document.querySelector('.hz-lienzo')!.className).toContain('hz-con-zoom')
    fireEvent.keyDown(window, { key: '+' })
    expect(nivel()).toBe('225 %')
    fireEvent.keyDown(window, { key: '-' })
    expect(nivel()).toBe('150 %')
    fireEvent.keyDown(window, { key: '0' })
    expect(nivel()).toBe('100 %')
    expect(svg.getAttribute('viewBox')).toBe(completa)
    // Rueda hacia arriba sobre la matriz: acerca. Hacia abajo en la vista completa: deja desplazar la página.
    const lienzo = document.querySelector('.hz-lienzo')!
    const abajo = new WheelEvent('wheel', { deltaY: 100, bubbles: true, cancelable: true })
    lienzo.dispatchEvent(abajo)
    expect(abajo.defaultPrevented).toBe(false)
    const arriba = new WheelEvent('wheel', { deltaY: -200, bubbles: true, cancelable: true })
    act(() => void lienzo.dispatchEvent(arriba))
    expect(arriba.defaultPrevented).toBe(true)
    expect(Number(nivel()!.replace(/\D/g, ''))).toBeGreaterThan(100)
    fireEvent.click(within(grupo).getByRole('button', { name: 'Ver todo' }))
    expect(nivel()).toBe('100 %')
  })

  test('bajo la matriz: qué significa cada eje y cada punto, sin pesos ni fórmulas', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const texto = document.querySelector('.hz-explica')!.textContent!
    expect(texto).toContain('Eje X, Time to Market: qué tan lejos está el proyecto del mercado.')
    expect(texto).toContain('Eje Y, Value Generation Capacity: qué tan lejos está del core del negocio y cuánto cuesta probarlo.')
    expect(texto).toContain('1 es cerca y listo; 9, lejos e incierto')
    // El mock trae alcance de mesa.
    expect(texto).toContain('Cada punto es el promedio de los votos de la mesa y el tamaño de la burbuja es el tamaño de la oportunidad.')
    expect(texto).not.toMatch(/—|%|peso|Total/)
    expect(screen.queryByText('¿Cómo se calcula?')).toBeNull()
  })

  test('modo guiado: la pregunta del facilitador con su rúbrica, en grande, en lugar de la matriz', async () => {
    const guiada = structuredClone(mock) as DatosTablero & Record<string, unknown>
    Object.assign(guiada.config, { modo_preguntas: 'guiado' })
    Object.assign(guiada.sala, { pregunta_guiada: { proyecto_id: 'nutriwhat', criterio_id: 'regulacion' } })
    guiada.criterios[2] = Object.assign(guiada.criterios[2], {
      pregunta: '¿Qué tantas barreras de entrada tiene el mercado?',
      rubrica: [9, 7, 5, 3, 1].map((valor) => ({ valor, texto: `Nivel ${valor}` })),
    })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(guiada), { status: 200 })))
    montar('/tablero/s_demo?t=tok')
    const titulo = await screen.findByRole('heading', { name: 'Regulación', level: 2 })
    const bloque = titulo.closest('section')!
    expect(bloque.textContent).toContain('NUTRIWHAT · Pregunta 3 de 6')
    expect(bloque.textContent).toContain('¿Qué tantas barreras de entrada tiene el mercado?')
    expect([...bloque.querySelectorAll('.hz-rubrica li')].map((li) => li.textContent)).toEqual(['9Nivel 9', '7Nivel 7', '5Nivel 5', '3Nivel 3', '1Nivel 1'])
    expect(document.querySelector('svg.hz-matriz')).toBeNull()
    // Con los datos abiertos, el panel lateral sigue al lado (progreso y promedios).
    await verDatos()
    expect(screen.getByRole('progressbar')).toBeTruthy()
    cleanup()
    // Modo automático o sin pregunta elegida: la matriz de siempre.
    Object.assign(guiada.config, { modo_preguntas: 'automatico' })
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    await waitFor(() => expect(document.querySelector('svg.hz-matriz')).toBeTruthy())
    expect(document.querySelector('.hz-guiada')).toBeNull()
  })

  test('progreso con más completos que inscritos no pasa del 100 %', async () => {
    const raro = structuredClone(mock)
    raro.progreso.completos = 25
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(raro), { status: 200 })))
    montar('/tablero/s_demo')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    await verDatos()
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
