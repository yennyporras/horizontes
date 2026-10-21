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
/** La matriz está en pantalla completa (la del navegador o el respaldo de jsdom, que no tiene la API). */
const enPantalla = () => document.querySelector('.hz-lienzo, .hz-mesas-lienzo')?.hasAttribute('data-pantalla') ?? false

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
    // Composición común (21-oct): la sala va en la segunda franja clara, bajo la barra carbón.
    expect(titulo.closest('.hz-franja-pagina')!.getAttribute('data-tema')).toBe('claro')
    expect(titulo.closest('.hz-producto')).toBeNull()
    expect(titulo.className).toBe('hz-h1')
    expect(document.querySelector('.hz-cab-controles')!.closest('.hz-franja-pagina')).toBeTruthy()
    // Pie común (en el proyector lo oculta el CSS: el tablero ocupa justo la pantalla).
    expect(document.querySelector('.hz-tablero > footer.hz-pie')).toBeTruthy()
    for (const el of main.querySelectorAll('[data-tema]')) {
      expect(barra.contains(el), 'data-tema fuera de la barra').toBe(true)
      // Carbón en la barra; el único claro dentro de ella es la franja de la sala y los controles.
      if (el.getAttribute('data-tema') === 'claro') expect(el.classList.contains('hz-franja-pagina')).toBe(true)
      else expect(el.getAttribute('data-tema')).toBe('carbon')
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

  test('dos modos de proyección: «Gráfica» (por defecto, la matriz) y «Detallado», en ?modo=, con selector y teclas G, D y M', async () => {
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
    // Teclas: D y G eligen; M alterna. T ya no es un atajo.
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
    // Nicolai (QA por roles): Esc fuera de la pantalla completa no hace nada y un clic en la matriz no cambia de modo
    // (pasaba al dar foco a la ventana del proyector).
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(document.querySelector('.hz-lienzo')!)
    await act(async () => {})
    expect(modoEnUrl()).toBe('grafica')
    expect(document.querySelector('.hz-lateral')).toBeNull()
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
    // V (votos) desde Gráfica abre Detallado en «Cómo votó» (para el facilitador).
    fireEvent.keyDown(window, { key: 'g' })
    fireEvent.keyDown(window, { key: 'v' })
    expect(await screen.findByRole('heading', { name: 'Cómo votó la mesa' })).toBeTruthy()
    expect(modoEnUrl()).toBe('detallado')
    // QA-T-07: volver a abrir Detallado con M o D lo abre en «Promedios», no en la última pestaña.
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

  test('la insignia de la ronda abierta («En vivo: se actualiza cada 3 votos») es un estado, no un modo: va junto al estado y fuera del selector', async () => {
    const abierta = structuredClone(mock)
    abierta.progreso.precierre = false
    abierta.progreso.por_mesa.forEach((m) => (m.precierre = false))
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(abierta), { status: 200 })))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const insignia = document.querySelector('.hz-tb-insignia-vivo')!
    expect(insignia.textContent).toBe('En vivo: se actualiza cada 3 votos')
    expect(insignia.tagName).toBe('SPAN')
    expect(insignia.closest('.hz-cab-meta')).toBeTruthy()
    expect(insignia.closest('[role="group"], button')).toBeNull()
    const selector = screen.getByRole('group', { name: 'Modo de proyección' })
    expect(selector.textContent).not.toMatch(/vivo/i)
  })

  test('Cada mesa por separado: sin selector de modo (ahí no cambia nada), con la leyenda de las rondas y la pantalla completa', async () => {
    montar('/tablero/s_demo?t=tok&vista=mesas&modo=detallado')
    await screen.findByRole('heading', { name: 'Mesa 3' })
    expect(screen.queryByRole('group', { name: 'Modo de proyección' })).toBeNull()
    expect(screen.getByRole('group', { name: 'Vista de la matriz' })).toBeTruthy()
    expect(document.querySelector('.hz-pie-mesas .hz-leyenda')!.textContent).toContain('Proyectos de referencia')
    // Nicolai: el selector lo dice como es.
    expect(screen.getByRole('option', { name: 'Cada mesa por separado' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Todas las mesas' })).toBeNull()
    // Matrices compactas: los fijos como puntos sin nombre.
    await waitFor(() => expect(document.querySelectorAll('svg.hz-matriz').length).toBe(3))
    expect(document.querySelectorAll('svg.hz-matriz .hz-etq-fijo')).toHaveLength(0)
    expect(document.querySelectorAll('svg.hz-matriz circle.hz-fijo').length).toBe(3 * mock.proyectos_fijos.length)
    // Pantalla completa: solo las matrices de la página, sin la leyenda ni la barra; «Salir» la cierra.
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa F' }))
    await waitFor(() => expect(enPantalla()).toBe(true))
    const cuadro = document.querySelector<HTMLElement>('.hz-mesas-lienzo')!
    expect(cuadro.querySelectorAll('svg.hz-matriz').length).toBe(3)
    expect(cuadro.querySelector('.hz-leyenda, .hz-cab')).toBeNull()
    fireEvent.click(within(cuadro).getByRole('button', { name: 'Salir Esc' }))
    await waitFor(() => expect(enPantalla()).toBe(false))
  })

  test('una tecla sostenida no repite el atajo (F no entra y sale de la pantalla completa sin parar)', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const main = document.querySelector('main')!
    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => expect(enPantalla()).toBe(true))
    fireEvent.keyDown(window, { key: 'f', repeat: true })
    fireEvent.keyDown(window, { key: 'm', repeat: true })
    expect(enPantalla()).toBe(true)
    expect(main.dataset.modo).toBe('grafica')
  })

  test('modo Gráfica: la matriz con la marca, la sala, la ronda y los votos recibidos; la explicación breve en el pie; sin tabla', async () => {
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    // Con la ronda abierta, la franja dice en grande qué ronda es; la barra no lo repite.
    expect(document.querySelector('.hz-franja')!.textContent).toBe('Ronda 2 · Discusión en la mesa')
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
      expect(screen.getByText('Este enlace del tablero no tiene permiso. Pídele al facilitador el enlace completo del tablero.')).toBeTruthy()
      await act(async () => vi.advanceTimersByTime(10_000))
      expect(f).toHaveBeenCalledTimes(1)
      cleanup()
      vi.useRealTimers()
    }
  })

  test('franja de fase de la ronda abierta', async () => {
    montar('/tablero/s_demo?t=tok')
    expect(await screen.findByText('Ronda 2 · Discusión en la mesa')).toBeTruthy()
    cleanup()
    const r1 = structuredClone(mock)
    r1.sala.estado = 'r1_abierta'
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(r1), { status: 200 })))
    montar('/tablero/s_demo?t=tok')
    expect(await screen.findByText('Ronda 1 · Individual y en silencio')).toBeTruthy()
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
    // Nicolai: el selector de alcance no se come los atajos (con el foco en él, 2 cambia la vista).
    fireEvent.keyDown(screen.getByRole('combobox'), { key: '2' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 2'))
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 1'))
    // jsdom no tiene requestFullscreen: F igual pone la matriz sola sobre toda la ventana (respaldo).
    const main = document.querySelector('main')!
    fireEvent.keyDown(window, { key: 'f' })
    await waitFor(() => expect(enPantalla()).toBe(true))
    const lienzo = document.querySelector<HTMLElement>('.hz-lienzo')!
    expect(lienzo.className).toContain('hz-lienzo-completo')
    // Solo la matriz: el botón «Salir» va dentro del lienzo; la barra, la leyenda y la columna quedan fuera.
    expect(within(lienzo).getByRole('button', { name: 'Salir Esc' })).toBeTruthy()
    for (const sel of ['.hz-cab', '.hz-leyenda', '.hz-columna', '.hz-pie-matriz']) expect(lienzo.querySelector(sel)).toBeNull()
    expect(lienzo.querySelector('svg.hz-matriz')).toBeTruthy()
    // Las teclas de vista siguen dentro de la pantalla completa (C repite la animación).
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(vistaPulsada()).toBe('Comparación'))
    fireEvent.keyDown(window, { key: '2' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 2'))
    expect(enPantalla()).toBe(true)
    // En pantalla completa, Esc sale (no cambia de modo).
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(enPantalla()).toBe(false))
    expect(main.dataset.modo).toBe('grafica')
    // En Detallado también va solo la matriz (sin el panel); el mismo botón entra y «Salir» sale.
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Pantalla completa F' }))
    await waitFor(() => expect(enPantalla()).toBe(true))
    expect(document.querySelector('.hz-lienzo')!.querySelector('.hz-lateral, .hz-tabla')).toBeNull()
    // G y D no la cierran: la matriz es el mismo elemento en los dos modos.
    fireEvent.keyDown(window, { key: 'g' })
    await waitFor(() => expect(main.dataset.modo).toBe('grafica'))
    expect(enPantalla()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Salir Esc' }))
    await waitFor(() => expect(enPantalla()).toBe(false))
  })

  test('pantalla completa con la API del navegador: sobre el lienzo de la matriz, con zoom vectorial', async () => {
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
      const lienzo = document.querySelector<HTMLElement>('.hz-lienzo')!
      const caja = () => document.querySelector('svg.hz-matriz')!.getAttribute('viewBox')!
      const entera = caja()
      // Sin pantalla completa y sin foco, la rueda no toca la matriz (la página se desplaza como siempre).
      fireEvent.wheel(lienzo, { deltaY: -200 })
      expect(caja()).toBe(entera)
      fireEvent.keyDown(window, { key: 'f' })
      await waitFor(() => expect(pedir).toHaveBeenCalledTimes(1))
      expect(pedir.mock.contexts[0]).toBe(lienzo)
      await waitFor(() => expect(enPantalla()).toBe(true))
      expect(lienzo.className).not.toContain('hz-lienzo-completo')
      // Rueda: acerca (viewBox más chico, misma proporción); «Ver entera» aparece; 0 vuelve a 1×.
      fireEvent.wheel(lienzo, { deltaY: -300 })
      await waitFor(() => expect(caja()).not.toBe(entera))
      const [, , w0] = entera.split(' ').map(Number)
      const [, , w1] = caja().split(' ').map(Number)
      expect(w1).toBeLessThan(w0)
      expect(lienzo.dataset.zoom).toBeTruthy()
      expect(within(lienzo).getByRole('button', { name: 'Ver entera 0' })).toBeTruthy()
      fireEvent.keyDown(window, { key: '0' })
      await waitFor(() => expect(caja()).toBe(entera))
      expect(within(lienzo).queryByRole('button', { name: 'Ver entera 0' })).toBeNull()
      // Doble clic acerca al doble; el botón «Ver entera» la deja entera.
      fireEvent.doubleClick(lienzo)
      await waitFor(() => expect(lienzo.dataset.zoom).toBe('2'))
      fireEvent.click(within(lienzo).getByRole('button', { name: 'Ver entera 0' }))
      await waitFor(() => expect(caja()).toBe(entera))
      // Al salir, la vista normal queda como siempre (sin zoom).
      fireEvent.wheel(lienzo, { deltaY: -300 })
      await waitFor(() => expect(caja()).not.toBe(entera))
      fireEvent.keyDown(window, { key: 'f' })
      await waitFor(() => expect(salir).toHaveBeenCalledTimes(1))
      await waitFor(() => expect(enPantalla()).toBe(false))
      await waitFor(() => expect(caja()).toBe(entera))
      // Fuera de la pantalla completa, con el foco en la matriz, la rueda también acerca.
      lienzo.focus()
      fireEvent.wheel(lienzo, { deltaY: -300 })
      await waitFor(() => expect(caja()).not.toBe(entera))
      fireEvent.keyDown(window, { key: '0' })
      await waitFor(() => expect(caja()).toBe(entera))
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
    // En Detallado, el panel lateral sigue al lado (progreso y promedios). Sin matriz no hay pantalla completa.
    await verDatos()
    expect(screen.queryByRole('button', { name: /Pantalla completa/ })).toBeNull()
    fireEvent.keyDown(window, { key: 'f' })
    expect(document.querySelector('[data-pantalla]')).toBeNull()
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
    expect(await screen.findByText('Aún no hay resultados en la ronda 1. Se actualizan cada 3 votos nuevos.')).toBeTruthy()
    expect(document.querySelector('.hz-aviso-ensayo')).toBeNull()
    expect(document.querySelector('.hz-tb-insignia-vivo')!.textContent).toBe('En vivo: se actualiza cada 3 votos')
    await verDatos()
    // En Detallado la foto de 3 en 3 la sigue diciendo la insignia de la barra (sin repetirla en el panel).
    expect(document.querySelector('.hz-tb-insignia-vivo')!.textContent).toBe('En vivo: se actualiza cada 3 votos')
    expect(document.querySelector('.hz-lateral')!.textContent).not.toContain('Se actualizan cada')
    await act(async () => {})
  })

  test('sala de ensayo (21-oct): aviso visible, insignia «con cada voto» y el mensaje con el conteo real desde 1 voto', async () => {
    const ensayo = { ...structuredClone(mock), ensayo: true as const, minimo_votos: 1, votos_por_actualizacion: 1 }
    ensayo.sala.estado = 'r1_abierta'
    ensayo.sala.ronda_actual = 1
    ensayo.progreso.por_mesa.forEach((m) => (m.precierre = false))
    for (const v of ensayo.proyectos_vivos) for (const r of v.rondas) Object.assign(r, { n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(ensayo), { status: 200 })))
    montar('/tablero/s_demo')
    expect((await screen.findByRole('note')).textContent).toBe('Sala de ensayo: no cuenta en las cifras de talleres.')
    expect(document.querySelector('.hz-tb-insignia-vivo')!.textContent).toBe('En vivo: se actualiza con cada voto')
    expect(screen.getByText('Aún no hay resultados en la ronda 1. Se actualizan con cada voto nuevo.')).toBeTruthy()
    // El aviso va en el contenido (claro), no en la barra.
    expect(document.querySelector('.hz-aviso-ensayo')!.closest('.hz-area')).toBeTruthy()
    await act(async () => {})
  })

  test('bajo el mínimo (21-oct): un solo mensaje con el conteo real en la matriz y en el Detallado, sin «Faltan votos»', async () => {
    const pocos = structuredClone(mock)
    pocos.sala.estado = 'r1_cerrada'
    pocos.sala.ronda_actual = 1
    pocos.minimo_votos = 3
    for (const v of pocos.proyectos_vivos) {
      v.rondas = v.rondas.filter((r) => r.ronda === 1)
      Object.assign(v.rondas[0], { n_votos: 1, bajo_minimo: true, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(pocos), { status: 200 })))
    montar('/tablero/s_demo?t=tok&modo=detallado')
    const msg = 'Hay 1 voto de los 3 que hacen falta para mostrar el resultado. Así nadie puede deducir cómo votó otra persona.'
    expect((await screen.findAllByText(msg)).length).toBeGreaterThanOrEqual(1)
    expect(document.querySelector('.hz-tablero')!.textContent).not.toContain('Faltan votos')
    // Ninguna columna con resultado: el mensaje va en lugar de la tabla.
    expect(document.querySelector('.hz-comparada table')).toBeNull()
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

// ── QA por roles (20-oct): ronda 1 oculta, control del proyector, convergencia, marca y textos ──

/** Responde siempre con lo que tenga `actual` en ese momento (para cambiar el estado de la sala a mitad de prueba). */
function servir(inicial: DatosTablero) {
  const caja = { actual: inicial, version: 1 }
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ ...caja.actual, version: `v${caja.version}` }), { status: 200, headers: { ETag: `"v${caja.version}"` } })),
  )
  return {
    poner(d: DatosTablero) {
      caja.actual = d
      caja.version++
    },
  }
}

const alcanceSala = (d: DatosTablero): DatosTablero => ({ ...d, alcance: { tipo: 'sala', mesa_id: null, mesa_nombre: null } })

function conR1Oculta(): DatosTablero {
  const d = alcanceSala(structuredClone(mock))
  d.sala.estado = 'r1_abierta'
  d.sala.ronda_actual = 1
  d.progreso.precierre = false
  d.progreso.por_mesa.forEach((m) => (m.precierre = false))
  for (const v of d.proyectos_vivos)
    v.rondas = [{ ronda: 1, n_votos: 14, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null, oculta: true }]
  return d
}

function conConvergencia(estado: DatosTablero['sala']['estado'] = 'r2_cerrada'): DatosTablero {
  const d = alcanceSala(structuredClone(mock))
  d.sala.estado = estado
  d.proyectos_vivos[0].convergencia = { dispersion_r1: 2.1, dispersion_r2: 1.3, reduccion_pct: 38, criterio_mayor_cambio: 'regulacion', delta_x: -0.34, delta_y: -0.11 }
  d.proyectos_vivos[1].convergencia = { dispersion_r1: 1.9, dispersion_r2: 1.3, reduccion_pct: 32, criterio_mayor_cambio: 'inversion_requerida', delta_x: -0.4, delta_y: 0.59 }
  d.convergencia_alcance = { reduccion_pct: 35 }
  return d
}

describe('PaginaTablero: QA por roles', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  test('ronda 1 oculta en Gráfica: los fijos, sin vivos, y en grande cuántos votaron por mesa y cuándo se ve el resultado', async () => {
    servir(conR1Oculta())
    montar('/tablero/s_demo?t=tok')
    const cortina = await screen.findByRole('region', { name: 'Avance de la ronda 1' })
    expect([...cortina.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['Mesa 17 de 7 votaron', 'Mesa 24 de 7 votaron', 'Mesa 33 de 6 votaron'])
    expect(cortina.textContent).toContain('Los resultados de la ronda 1 se muestran cuando todos voten o al cerrar la ronda.')
    expect(document.querySelectorAll('svg.hz-matriz circle.hz-fijo')).toHaveLength(mock.proyectos_fijos.length)
    expect(document.querySelectorAll('svg.hz-matriz circle.hz-r1, svg.hz-matriz circle.hz-r2')).toHaveLength(0)
    // Ni aviso de vacío ni «En vivo»: la ronda 1 no se ve en vivo.
    expect(document.querySelector('.hz-vacio')).toBeNull()
    expect(document.querySelector('.hz-tb-insignia-vivo')).toBeNull()
    expect(document.querySelector('.hz-franja')!.textContent).toBe('Ronda 1 · Individual y en silencio')
  })

  test('ronda 1 oculta en Detallado: la misma cortina, sin promedios ni «Cómo votó»', async () => {
    servir(conR1Oculta())
    montar('/tablero/s_demo?t=tok&modo=detallado')
    const cortina = await screen.findByRole('region', { name: 'Avance de la ronda 1' })
    expect(cortina.closest('.hz-lateral')).toBeTruthy()
    expect(document.querySelector('.hz-comparada, .hz-panel, .hz-cv')).toBeNull()
    expect(screen.queryByRole('group', { name: 'Detalle del panel' })).toBeNull()
    fireEvent.keyDown(window, { key: 'v' })
    await act(async () => {})
    expect(document.querySelector('.hz-cv')).toBeNull()
  })

  test('con la ronda 2 abierta y sin resultados de R2, la vista por defecto es Ronda 1 (no una matriz vacía)', async () => {
    const d = structuredClone(mock)
    for (const v of d.proyectos_vivos) Object.assign(v.rondas[1], { n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })
    servir(d)
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(vistaPulsada()).toBe('Ronda 1')
    expect(document.querySelectorAll('svg.hz-matriz circle.hz-r1').length).toBe(2)
  })

  test('al cerrar la ronda 2 se conserva la vista elegida a mano; sin elección pasa sola a Comparación', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const abierta = structuredClone(mock)
    const cerrada = structuredClone(mock)
    cerrada.sala.estado = 'r2_cerrada'
    // Sin elección: Comparación.
    let s = servir(abierta)
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    expect(vistaPulsada()).toBe('Ronda 2')
    s.poner(cerrada)
    await act(async () => vi.advanceTimersByTime(3000))
    await waitFor(() => expect(vistaPulsada()).toBe('Comparación'))
    cleanup()
    // Con elección (Ronda 1): se queda.
    s = servir(abierta)
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 1'))
    s.poner(cerrada)
    await act(async () => vi.advanceTimersByTime(3000))
    await waitFor(() => expect(document.querySelector('.hz-cab-meta')!.textContent).toContain('Ronda 2 cerrada'))
    expect(vistaPulsada()).toBe('Ronda 1')
  })

  test('C en Comparación repite la animación R1 → R2', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    servir(structuredClone(mock))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(document.querySelector('svg.hz-matriz .hz-anim-mov')).toBeTruthy())
    await act(async () => vi.advanceTimersByTime(2600))
    await waitFor(() => expect(document.querySelector('svg.hz-matriz .hz-anim-mov')).toBeNull())
    fireEvent.keyDown(window, { key: 'c' })
    await waitFor(() => expect(document.querySelector('svg.hz-matriz .hz-anim-mov')).toBeTruthy())
    expect(vistaPulsada()).toBe('Comparación')
  })

  test('el selector de alcance suelta el foco al cambiar y nunca se come los atajos: elegir alcance y pulsar M no cambia el alcance', async () => {
    servir(structuredClone(mock))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const select = screen.getByRole('combobox') as HTMLSelectElement
    select.focus()
    fireEvent.change(select, { target: { value: 'm2' } })
    await waitFor(() => expect(new URLSearchParams(screen.getByTestId('url').textContent!).get('mesa')).toBe('m2'))
    expect(document.activeElement).not.toBe(select)
    // Aunque el foco vuelva al selector, M es el atajo del modo (no la búsqueda de «Mesa 1»).
    select.focus()
    const evento = new KeyboardEvent('keydown', { key: 'm', bubbles: true, cancelable: true })
    act(() => void select.dispatchEvent(evento))
    expect(evento.defaultPrevented).toBe(true)
    await waitFor(() => expect(modoEnUrl()).toBe('detallado'))
    expect(new URLSearchParams(screen.getByTestId('url').textContent!).get('mesa')).toBe('m2')
    expect(select.value).toBe('m2')
  })

  test('control de presentaciones: → y Página siguiente avanzan Ronda 1 → Ronda 2 → Comparación; ← y Página anterior retroceden', async () => {
    servir(structuredClone(mock))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    fireEvent.keyDown(window, { key: '1' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 1'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 2'))
    fireEvent.keyDown(window, { key: 'PageDown' })
    await waitFor(() => expect(vistaPulsada()).toBe('Comparación'))
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(vistaPulsada()).toBe('Comparación'))
    fireEvent.keyDown(window, { key: 'PageUp' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 2'))
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    await waitFor(() => expect(vistaPulsada()).toBe('Ronda 1'))
  })

  test('? muestra la ayuda de teclas superpuesta; Esc la cierra', async () => {
    servir(structuredClone(mock))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    fireEvent.keyDown(window, { key: '?' })
    const ayuda = await screen.findByRole('dialog', { name: 'Teclas del tablero' })
    const teclas = [...ayuda.querySelectorAll('dt')].map((d) => d.textContent)
    for (const k of ['F', 'G', 'D', 'M', 'V', '1', '2', 'C', '? ']) expect(teclas.some((t) => t!.startsWith(k.trim())), k).toBe(true)
    expect(teclas).toContain('→ o Página siguiente')
    expect(teclas).toContain('← o Página anterior')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // El botón «Teclas» también la abre.
    fireEvent.click(screen.getByRole('button', { name: 'Teclas ?' }))
    expect(await screen.findByRole('dialog', { name: 'Teclas del tablero' })).toBeTruthy()
  })

  test('sin conexión: los primeros 20 s un punto discreto «Reconectando» en la barra; después, el aviso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let caido = false
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (caido) throw new TypeError('Failed to fetch')
        return new Response(JSON.stringify(mock), { status: 200 })
      }),
    )
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    caido = true
    await act(async () => vi.advanceTimersByTime(3000))
    const punto = await screen.findByText('Reconectando')
    expect(punto.closest('.hz-cab-meta')).toBeTruthy()
    expect(document.querySelector('.hz-aviso-error')).toBeNull()
    await act(async () => vi.advanceTimersByTime(20_500))
    await waitFor(() => expect(document.querySelector('.hz-aviso-error')).toBeTruthy())
    expect(screen.queryByText('Reconectando')).toBeNull()
  })

  test('«Qué se movió»: en Comparación con datos, la columna de Gráfica con el titular y el cambio de cada proyecto en palabras', async () => {
    servir(conConvergencia())
    montar('/tablero/s_demo?t=tok')
    const bloque = await screen.findByRole('region', { name: 'Qué se movió de R1 a R2' })
    expect(bloque.closest('.hz-columna')).toBeTruthy()
    expect(bloque.querySelector('.hz-movio-titular')!.textContent).toBe('La discusión redujo la dispersión un 35 %')
    const [insumex, nutriwhat] = [...bloque.querySelectorAll('li')].map((li) => [...li.querySelectorAll('p')].map((p) => p.textContent))
    expect(insumex).toEqual(['Eje X −0,34: se acercó al mercado', 'Eje Y −0,11: se acercó al core', 'Mayor cambio: Regulación'])
    expect(nutriwhat).toEqual(['Eje X −0,40: se acercó al mercado', 'Eje Y +0,59: se alejó del core', 'Mayor cambio: Inversión para probar'])
    // Solo en Comparación.
    fireEvent.keyDown(window, { key: '2' })
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Qué se movió de R1 a R2' })).toBeNull())
  })

  test('Detallado en Comparación: marca «Mayor cambio» en la fila del criterio y el titular sobre la tabla; «TAM 5 de 10»', async () => {
    servir(conConvergencia())
    montar('/tablero/s_demo?t=tok&modo=detallado')
    await screen.findByRole('heading', { name: 'Promedios por criterio' })
    const tabla = document.querySelector('.hz-comparada')!
    const fila = (nombre: string) => [...tabla.querySelectorAll('tbody th')].find((th) => th.querySelector('.hz-crit-nombre')!.firstChild!.textContent === nombre)!
    expect(fila('Regulación').querySelector('.hz-mayor-cambio')!.textContent).toBe('Mayor cambio: INSUMEX')
    expect(fila('Inversión para probar').querySelector('.hz-mayor-cambio')!.textContent).toBe('Mayor cambio: NUTRIWHAT')
    expect(fila('Alineación con el core').querySelector('.hz-mayor-cambio')).toBeNull()
    expect(tabla.querySelector('.hz-movio-linea')!.textContent).toBe('La discusión redujo la dispersión un 35 %')
    expect([...tabla.querySelectorAll('.hz-col-proy .hz-panel-meta')].map((m) => m.textContent!.trim())).toEqual(
      mock.proyectos_vivos.map((p) => `TAM ${p.tam} de 10`),
    )
    // La descripción del criterio también va en el title de la fila (con poco alto se oculta la línea).
    expect(fila('Regulación').getAttribute('title')).toContain('1: mercado no regulado; 9: más de 5 años.')
    // Nombres cortos únicos (web/shared/criterios.ts).
    expect([...tabla.querySelectorAll('.hz-crit-nombre')].map((n) => n.firstChild!.textContent)).toEqual([
      'Alistamiento técnico',
      'Conocimiento del cliente',
      'Regulación',
      'Capacidades organizacionales',
      'Alineación con el core',
      'Inversión para probar',
    ])
  })

  test('lectura de la matriz: «Proyectos de referencia», el tamaño de la burbuja, los horizontes y los ejes, también en Detallado', async () => {
    servir(structuredClone(mock))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    const lectura = screen.getByRole('region', { name: 'Cómo leer la matriz' })
    expect(lectura.textContent).toContain('Tamaño de la burbuja: mercado potencial (TAM, de 1 a 10)')
    expect([...lectura.querySelectorAll('.hz-horizontes li')].map((li) => li.textContent)).toEqual([
      'H1 Core: mejorar el negocio de hoy',
      'H2 Adyacente: extender el negocio',
      'H3 Transformación: crear un negocio nuevo',
    ])
    expect(lectura.querySelector('.hz-explica-breve')!.textContent).toBe('Eje X: qué tan lejos está del mercado. Eje Y: qué tan lejos está del core. 1 es cerca; 9, lejos.')
    expect(document.querySelector('.hz-pie-matriz .hz-leyenda')!.textContent).toContain('Proyectos de referencia')
    expect(document.querySelector('.hz-leyenda')!.textContent).not.toMatch(/fijos|Burbuja: TAM/)
    fireEvent.keyDown(window, { key: 'd' })
    await waitFor(() => expect(document.querySelector('.hz-lateral')).toBeTruthy())
    expect(document.querySelector('.hz-zona-matriz .hz-explica-breve')!.textContent).toContain('Eje X: qué tan lejos está del mercado.')
  })

  test('marca Estratek: el logo en la barra, a la derecha', async () => {
    servir(structuredClone(mock))
    montar('/tablero/s_demo?t=tok')
    await screen.findByRole('heading', { name: mock.sala.nombre })
    // El logo de la barra y, en celular y tableta, el del pie común.
    const logo = within(document.querySelector<HTMLElement>('.hz-cab')!).getByRole('img', { name: 'Estratek' })
    expect(within(document.querySelector<HTMLElement>('.hz-pie')!).getByRole('img', { name: 'Estratek' })).toBeTruthy()
    expect(logo.classList.contains('hz-cab-logo')).toBe(true)
    // Es lo último de la barra: queda a la derecha de los controles.
    const fila = logo.closest('.hz-producto__fila')!
    const todos = [...fila.querySelectorAll('*')].filter((el) => el.closest('.hz-producto__extra'))
    expect(todos.at(-1)).toBe(logo)
  })

  test('cada mesa por separado con más de 4 mesas: de 4 en 4, con ← y → o los botones', async () => {
    const d = structuredClone(mock)
    d.progreso.por_mesa = Array.from({ length: 6 }, (_, i) => ({ mesa_id: `m${i + 1}`, nombre: `Mesa ${i + 1}`, inscritos: 4, completos: 4, precierre: true }))
    servir(d)
    montar('/tablero/s_demo?t=tok&vista=mesas')
    await screen.findByRole('heading', { name: 'Mesa 4' })
    expect(screen.queryByRole('heading', { name: 'Mesa 5' })).toBeNull()
    expect(screen.getByText('Mesas 1 a 4 de 6')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(await screen.findByRole('heading', { name: 'Mesa 5' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Mesa 6' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'Mesa 1' })).toBeNull()
    expect(screen.getByText('Mesas 5 a 6 de 6')).toBeTruthy()
    // En la página de mesas, ← y → pasan de página, no cambian la vista.
    const vistaAntes = vistaPulsada()
    fireEvent.click(screen.getByRole('button', { name: /Anteriores/ }))
    expect(await screen.findByRole('heading', { name: 'Mesa 1' })).toBeTruthy()
    expect(vistaPulsada()).toBe(vistaAntes)
  })
})
