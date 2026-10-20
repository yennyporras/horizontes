// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import mockJson from '../../mocks/GET_api_tablero.json'
import PaginaTablero from './PaginaTablero'
import type { DatosTablero } from './tipos'

// El mock del servidor viene en modo guiado con una pregunta fijada; las pruebas de la matriz parten sin ella.
const mock = structuredClone(mockJson) as unknown as DatosTablero
mock.sala.pregunta_guiada = null

/** Por defecto el tablero va en el modo «Gráfica» (solo la matriz); D abre el modo «Detallado». */
async function verDatos() {
  fireEvent.keyDown(window, { key: 'd' })
  await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
}

/** La URL actual, para ver que el modo queda en ?modo=. */
function Ubicacion() {
  const l = useLocation()
  return <output data-testid="url">{l.search}</output>
}
const modoEnUrl = () => new URLSearchParams(screen.getByTestId('url').textContent ?? '').get('modo')
/** Botones de la vista (Ronda 1, Ronda 2, Comparación): el grupo tiene su nombre. */
const vistaPulsada = () => document.querySelector('[aria-label="Vista de la matriz"] [aria-pressed="true"]')?.textContent

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route
          path="/tablero/:sala/*"
          element={
            <>
              <PaginaTablero />
              <Ubicacion />
            </>
          }
        />
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

  test('tema claro con la barra carbón de la familia Estratek: logo, «Horizontes por Estratek »» y el nombre de la sala', async () => {
    montar('/tablero/s_demo?t=tok')
    // Mientras carga, ya en claro y con la barra de la marca.
    expect(document.querySelector('main')!.dataset.tema).toBe('claro')
    expect(document.querySelector('.hz-cab')!.getAttribute('data-tema')).toBe('carbon')
    expect(screen.getByText('Cargando el tablero…').getAttribute('role')).toBe('status')
    const titulo = await screen.findByRole('heading', { level: 1, name: mock.sala.nombre })
    const main = document.querySelector('main')!
    expect(main.dataset.tema).toBe('claro')
    // También en <html> (fondo del rebote y theme-color).
    expect(document.documentElement.dataset.tema).toBe('claro')
    // El carbón queda solo en la barra, como en el panel (Paola, 20-oct: una sola apariencia).
    const barra = titulo.closest('.hz-cab')!
    expect(barra.getAttribute('data-tema')).toBe('carbon')
    for (const el of main.querySelectorAll('[data-tema]')) {
      expect(barra.contains(el), 'data-tema fuera de la barra').toBe(true)
      expect(el.getAttribute('data-tema')).toBe('carbon')
    }
    expect(main.querySelector('.hz-area')!.closest('[data-tema="carbon"]')).toBeNull()
    const marca = barra.querySelector('a.hz-producto__marca')!
    expect(marca.querySelector('.hz-producto__nombre')!.textContent).toBe('Horizontes')
    expect(marca.querySelector('.hz-producto__firma')!.textContent!.replace(/\s+/g, ' ').trim()).toBe('por Estratek »')
    // La » es la marca gráfica: decorativa para el lector de pantalla.
    expect(marca.querySelector('.hz-producto__flecha')!.getAttribute('aria-hidden')).toBe('true')
    // Logo decorativo y enlace: con el token del facilitador lleva a su panel.
    expect(marca.querySelector('svg')!.getAttribute('aria-hidden')).toBe('true')
    expect(marca.getAttribute('href')).toBe('/admin/salas')
  })

  test('sin token del facilitador, el logo del tablero lleva al inicio', async () => {
    montar('/tablero/s_demo')
    const titulo = await screen.findByRole('heading', { level: 1, name: mock.sala.nombre })
    expect(titulo.closest('.hz-cab')!.querySelector('a.hz-producto__marca')!.getAttribute('href')).toBe('/')
  })

  test('dos modos de proyección: «Gráfica» (por defecto, solo la matriz) y «Detallado», en ?modo=, con selector y teclas G, D, M y Esc', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const main = document.querySelector('main')!
    expect(main.className).toContain('hz-matriz-sola')
    expect(main.dataset.modo).toBe('grafica')
    expect(document.querySelector('.hz-lateral')).toBeNull()
    expect(document.querySelector('.hz-comparada, .hz-panel')).toBeNull()
    const selector = screen.getByRole('group', { name: 'Modo de proyección' })
    expect(within(selector).getAllByRole('button').map((b) => b.textContent)).toEqual(['Gráfica', 'Detallado'])
    expect(within(selector).getByRole('button', { name: 'Gráfica' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(selector).getByRole('button', { name: 'Gráfica' }).getAttribute('aria-keyshortcuts')).toBe('G')
    expect(within(selector).getByRole('button', { name: 'Detallado' }).getAttribute('aria-keyshortcuts')).toBe('D')
    // Selector: «Detallado» trae el panel y queda en la URL.
    fireEvent.click(within(selector).getByRole('button', { name: 'Detallado' }))
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
    expect(modoEnUrl()).toBe('detallado')
    expect(main.dataset.modo).toBe('detallado')
    fireEvent.click(within(selector).getByRole('button', { name: 'Gráfica' }))
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeNull())
    expect(modoEnUrl()).toBe('grafica')
    // Teclas: D y G eligen; M alterna; Esc pasa a Detallado. T ya no es un atajo.
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => expect(modoEnUrl()).toBe('detallado'))
    fireEvent.keyDown(window, { key: 'g' })
    await waitFor(() => expect(modoEnUrl()).toBe('grafica'))
    fireEvent.keyDown(window, { key: 'm' })
    await waitFor(() => expect(modoEnUrl()).toBe('detallado'))
    fireEvent.keyDown(window, { key: 'm' })
    await waitFor(() => expect(modoEnUrl()).toBe('grafica'))
    fireEvent.keyDown(window, { key: 't' })
    expect(modoEnUrl()).toBe('grafica')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(modoEnUrl()).toBe('detallado'))
    // Clic en la matriz (sin arrastre) alterna; un arrastre no cuenta como clic.
    fireEvent.keyDown(window, { key: 'G' })
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeNull())
    const lienzo = document.querySelector('.hz-lienzo')!
    // jsdom no trae PointerEvent: un MouseEvent llamado pointerdown hace de puntero.
    const bajar = (x: number, y: number) => act(() => void lienzo.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: x, clientY: y })))
    bajar(100, 100)
    fireEvent.click(lienzo, { clientX: 160, clientY: 130 })
    expect(document.querySelector('.hz-lateral')).toBeNull()
    bajar(100, 100)
    fireEvent.click(lienzo, { clientX: 101, clientY: 100 })
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
    // V (votos) desde Gráfica abre Detallado en «Cómo votó» (para el facilitador).
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'v' })
    expect(await screen.findByRole('heading', { name: 'Cómo votó la mesa' })).toBeTruthy()
    expect(modoEnUrl()).toBe('detallado')
    // QA-T-07: volver a abrir Detallado con clic, M o D lo abre en «Promedios», no en la última pestaña.
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'm' })
    await waitFor(() => expect(document.querySelector('.hz-comparada')).toBeTruthy())
    expect(screen.queryByRole('heading', { name: 'Cómo votó la mesa' })).toBeNull()
  })

  test('?modo=detallado abre directo el detalle; los enlaces viejos (?modo=tabla y ?modo=vivo) siguen sirviendo; otro valor, Gráfica', async () => {
    for (const [valor, detallado] of [
      ['detallado', true],
      ['tabla', true],
      ['grafica', false],
      ['vivo', false],
      ['otro', false],
    ] as const) {
      montar(`/tablero/s_demo?t=tok&modo=${valor}`)
      await screen.findByRole('heading', { name: mock.sala.nombre })
      expect(!!document.querySelector('.hz-lateral'), valor).toBe(detallado)
      expect(!!document.querySelector('.hz-comparada'), valor).toBe(detallado)
      expect(document.querySelector('main')!.dataset.modo).toBe(detallado ? 'detallado' : 'grafica')
      const pulsado = screen.getByRole('group', { name: 'Modo de proyección' }).querySelector('[aria-pressed="true"]')!
      expect(pulsado.textContent).toBe(detallado ? 'Detallado' : 'Gráfica')
      cleanup()
    }
  })

  test('la insignia de la ronda abierta («En vivo, cada 3 votos») es un estado, no un modo: va junto al estado y fuera del selector', async () => {
    const abierta = structuredClone(mock)
    abierta.progreso.precierre = false
    abierta.progreso.por_mesa.forEach((m) => (m.precierre = false))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(abierta), { status: 200 })))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const insignia = document.querySelector('.hz-tb-insignia-vivo')!
    expect(insignia.textContent).toBe('En vivo, cada 3 votos')
    expect(insignia.tagName).toBe('SPAN')
    expect(insignia.closest('.hz-cab-meta')).toBeTruthy()
    expect(insignia.closest('[role="group"], button')).toBeNull()
    const selector = screen.getByRole('group', { name: 'Modo de proyección' })
    expect(selector.textContent).not.toMatch(/vivo/i)
  })

  test('Todas las mesas: sin selector de modo (ahí no cambia nada), con la leyenda de las rondas y la pantalla completa', async () => {
    montar('/tablero/s_demo?t=tok&vista=mesas&modo=detallado')
    await screen.findByRole('heading', { name: 'Mesa 3' })
    expect(screen.queryByRole('group', { name: 'Modo de proyección' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Vista de la matriz' })).toBeTruthy()
    expect(document.querySelector('.hz-pie-mesas .hz-leyenda')!.textContent).toContain('Proyectos fijos')
    expect(screen.getByRole('button', { name: 'Pantalla completa F' })).toBeTruthy()
  })

  test('una tecla sostenida no repite el atajo (F no entra y sale de la pantalla completa sin parar)', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const main = document.querySelector('main')!
    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => expect(main.className).toContain('hz-pantalla-completa'))
    fireEvent.keyDown(window, { key: 'f', repeat: true })
    fireEvent.keyDown(window, { key: 'm', repeat: true })
    expect(main.className).toContain('hz-pantalla-completa')
    expect(main.dataset.modo).toBe('grafica')
  })

  test('modo Gráfica: la matriz con la marca, la sala, la ronda y los votos recibidos; la explicación breve en el pie; sin tabla', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    // Con la ronda abierta, la franja dice en grande qué ronda es; la barra no lo repite.
    expect(document.querySelector('.hz-franja')!.textContent).toBe('Ronda 2 · discusión en la mesa')
    expect(document.querySelector('.hz-cab-meta')!.textContent).not.toContain('Ronda 2 abierta')
    expect(document.querySelector('.hz-cab-votos')!.textContent).toBe('7 de 7 votaron')
    // D2: la insignia dice que el resultado llega de 3 en 3 votos.
    const vivo = document.querySelector('.hz-tb-insignia-vivo, .hz-tb-insignia-alerta')
    expect(vivo).toBeTruthy()
    const texto = document.querySelector('.hz-explica-breve')!.textContent!
    expect(texto).toBe('Eje X: qué tan lejos está del mercado. Eje Y: qué tan lejos está del core. 1 es cerca; 9, lejos.')
    expect(texto).not.toMatch(/—|%|peso|Total/)
    expect(screen.getByRole('button', { name: 'Pantalla completa F' })).toBeTruthy()
    expect(document.querySelector('.hz-comparada, .hz-cv, .hz-tb-progreso')).toBeNull()
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
    // Sin franja, el estado va en la barra; los datos van separados por «·», sin uno suelto al principio.
    const meta = document.querySelector('.hz-cab-meta')!
    expect(meta.textContent).toBe('Ronda 2 cerrada·7 de 7 votaron')
    expect(meta.firstElementChild!.getAttribute('aria-hidden')).toBeNull()
  })

  test('atajos: C, 1 y 2 cambian la vista; F y el botón ponen la pantalla completa en el modo elegido; Esc o F salen', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(vistaPulsada()).toBe('Comparación'))
    await waitFor(() => expect(document.querySelectorAll('.hz-flecha').length).toBe(2))
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 1'))
    // dentro del selector de alcance no se interceptan teclas
    fireEvent.keyDown(screen.getByRole('combobox'), { key: '2' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 1'))
    // jsdom no tiene requestFullscreen: F igual quita los controles del encabezado.
    const main = document.querySelector('main')!
    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => expect(main.className).toContain('hz-pantalla-completa'))
    expect(document.querySelector('.hz-cab-vista')!.textContent).toBe('Ronda 1')
    expect(screen.getByRole('button', { name: 'Salir de pantalla completa F' })).toBeTruthy()
    // En pantalla completa, Esc solo sale (no cambia de modo).
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(main.className).not.toContain('hz-pantalla-completa'))
    expect(main.dataset.modo).toBe('grafica')
    // En Detallado, la pantalla completa lleva el panel; el botón lo dice, entra y sale.
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa con detalle F' }))
    await waitFor(() => expect(main.className).toContain('hz-pantalla-completa'))
    expect(document.querySelector('.hz-lateral')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Salir de pantalla completa F' }))
    await waitFor(() => expect(main.className).not.toContain('hz-pantalla-completa'))
  })

  test('pantalla completa con la API del navegador: sobre el tablero, y sin zoom por porcentaje', async () => {
    const pedir = vi.fn(function (this: HTMLElement) {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this })
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    const salir = vi.fn(() => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', { configurable: true, value: pedir })
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: salir })
    try {
      montar('/tablero/s_demo?t=tok')
      await screen.findByRole('heading', { name: mock.sala.nombre })
      fireEvent.keyDown(window, { key: 'f' })
      await waitFor(() => expect(pedir).toHaveBeenCalledTimes(1))
      expect(pedir.mock.contexts[0]).toBe(document.querySelector('main'))
      await waitFor(() => expect(document.querySelector('main')!.className).toContain('hz-pantalla-completa'))
      fireEvent.keyDown(window, { key: 'f' })
      await waitFor(() => expect(salir).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(document.querySelector('main')!.className).not.toContain('hz-pantalla-completa'))
      // Pedido de Paola (20-oct): sin controles de zoom ni teclas +, − y 0.
      expect(screen.queryByRole('group', { name: 'Zoom de la matriz' })).toBeNull()
      const svg = document.querySelector('svg.hz-matriz')!
      const caja = svg.getAttribute('viewBox')
      for (const key of ['+', '-', '0']) fireEvent.keyDown(window, { key })
      expect(svg.getAttribute('viewBox')).toBe(caja)
    } finally {
      delete (HTMLElement.prototype as { requestFullscreen?: unknown }).requestFullscreen
      delete (document as { exitFullscreen?: unknown }).exitFullscreen
      delete (document as { fullscreenElement?: unknown }).fullscreenElement
    }
  })

  test('«Cómo votó»: el botón o la tecla V cambian la tabla por el conteo 1-3-5-7-9, sin tapar la matriz', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    await verDatos()
    const detalle = screen.getByRole('group', { name: 'Detalle del panel' })
    expect(within(detalle).getByRole('button', { name: 'Promedios' }).getAttribute('aria-pressed')).toBe('true')
    expect(within(detalle).getByRole('button', { name: 'Cómo votó' }).getAttribute('aria-keyshortcuts')).toBe('V')
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
    fireEvent.keyDown(window, { key: 'v' })
    await waitFor(() => expect(document.querySelector('.hz-cv')).toBeNull())
    expect(document.querySelector('.hz-comparada')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'V' })
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
    expect(vistaPulsada()).toBe('Comparación')
    // QA-T-04: al pasar a todas las mesas no queda la mesa anterior en la URL.
    fireEvent.change(select, { target: { value: 'mesas' } })
    await waitFor(() => expect(new URLSearchParams(screen.getByTestId('url').textContent!).get('vista')).toBe('mesas'))
    expect(new URLSearchParams(screen.getByTestId('url').textContent!).get('mesa')).toBeNull()
  })

  test('todas las mesas: una matriz por mesa con inscritos, solo con token', async () => {
    montar('/tablero/s_demo?t=tok&vista=mesas')
    await screen.findByRole('heading', { name: 'Mesa 3' })
    expect(screen.getByRole('heading', { name: 'Mesa 1' })).toBeTruthy()
    await waitFor(() => expect(document.querySelectorAll('svg.hz-matriz').length).toBe(3))
    expect(llamadas[0]).toBe('/api/tablero/s_demo?alcance=sala&t=tok')
    await waitFor(() => expect(llamadas).toContain('/api/tablero/s_demo?alcance=mesa&mesa=m2&t=tok'))
    // QA-T-04: el conteo dice de qué ronda es (la de la vista; en la ronda en curso, el progreso en vivo).
    expect(screen.getByText('R2: 7 de 7, todos votaron')).toBeTruthy()
    cleanup()
    llamadas.length = 0
    montar('/tablero/s_demo?vista=mesas')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(screen.queryByRole('heading', { name: 'Mesa 3' })).toBeNull()
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
    expect([...bloque.querySelectorAll('.hz-tb-rubrica li')].map((li) => li.textContent)).toEqual(['9Nivel 9', '7Nivel 7', '5Nivel 5', '3Nivel 3', '1Nivel 1'])
    expect(document.querySelector('svg.hz-matriz')).toBeNull()
    // En Detallado, el panel lateral sigue al lado (progreso y promedios); F también sirve sin matriz.
    await verDatos()
    expect(screen.getByRole('button', { name: 'Pantalla completa con detalle F' })).toBeTruthy()
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
    vacio.progreso.por_mesa.forEach((m) => (m.precierre = false))
    for (const v of vacio.proyectos_vivos) for (const r of v.rondas) Object.assign(r, { n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(vacio), { status: 200 })))
    montar('/tablero/s_demo')
    // D2: con la ronda abierta llega la última foto; no se afirma que no haya votos.
    expect(await screen.findByText('Aún no hay resultados en la ronda 1. Se actualizan cada 3 votos nuevos')).toBeTruthy()
    expect(document.querySelector('.hz-tb-insignia-vivo')!.textContent).toBe('En vivo, cada 3 votos')
    await verDatos()
    // En Detallado la foto de 3 en 3 la sigue diciendo la insignia de la barra (sin repetirla en el panel).
    expect(document.querySelector('.hz-tb-insignia-vivo')!.textContent).toBe('En vivo, cada 3 votos')
    expect(document.querySelector('.hz-lateral')!.textContent).not.toContain('Se actualizan cada')
    await act(async () => {})
  })

  test('QA-T-09: el progreso no lista mesas sin inscritos', async () => {
    const conVacia = structuredClone(mock)
    conVacia.progreso.por_mesa.push({ mesa_id: 'm9', nombre: 'Mesa 9', inscritos: 0, completos: 0, precierre: false })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(conVacia), { status: 200 })))
    montar('/tablero/s_demo?modo=detallado')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const mesas = screen.getByRole('list', { name: 'Progreso por mesa' })
    expect(within(mesas).queryByText('Mesa 9')).toBeNull()
    expect(within(mesas).getByText('Mesa 1')).toBeTruthy()
  })

  test('QA-T-05: enlace con una mesa que no existe', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { codigo: 'MESA_NO_EXISTE', mensaje: 'x' } }), { status: 404 })))
    montar('/tablero/s_demo?t=tok&mesa=m_nada')
    expect(await screen.findByText('No encontramos esta mesa en la sala. Revisa el enlace del tablero.')).toBeTruthy()
  })
})
