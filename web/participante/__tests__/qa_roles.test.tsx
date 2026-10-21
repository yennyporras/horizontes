// @vitest-environment jsdom
// QA por roles del 20-oct (participante, Paula, empresa, Sebastián y jurado): lo que cambia en el celular.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import yoBase from '../../../mocks/GET_api_yo.json'
import tablero from '../../../mocks/GET_api_tablero.json'
import PaginaMesa, { PIDE_ACCESO, TEXTO_SIN_SENAL } from '../PaginaMesa'
import { AVISO_AVANCE } from '../pantallas/Votacion'
import { AVISO_CASO_FICTICIO } from '../pantallas/Lectura'
import { AVISO_DATOS, AYUDA_CORREO, TEXTO_FALTA_CASILLA, TEXTO_QUE_HARAS, VERSION_AVISO_DATOS } from '../pantallas/Inscripcion'
import { cambiosEntreRondas, ResultadoAlcance, TEXTO_PARCIAL, TEXTO_R1_OCULTA } from '../pantallas/Resultado'
import { FALLOS_SIN_SENAL, usarYo } from '../usarYo'
import { marcarBienvenida } from '../sesion'
import { LECTURA_BURBUJA, LECTURA_EJES, LECTURA_ESCALA, NOMBRE_CORTO } from '../../shared/criterios'
import type { Resultados, RondaVivo, Voto, Yo } from '../api'

const CODIGO = 'HZ7K2-1'
const MESA = {
  sala: { id: 's_demo', nombre: 'Taller Horizontes demo', estado: 'inscripcion' },
  mesa: { id: 'm1', nombre: 'Mesa 1' },
  inscripcion_abierta: true,
  consentimiento: { version: 'hz-1.2', texto_autorizacion: 'Autorizo a Estratek a tratar mis datos (texto del servidor).', politica_url: 'https://estratek.com.co/politica' },
}
const TODAS = { alistamiento_tecnico: 3, conocimiento_cliente: 3, regulacion: 3, capacidades_organizacionales: 3, alineacion_core: 3, inversion_requerida: 3 }

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const yoCon = (cambios: (y: Yo) => void): Yo => {
  const y = clonar(yoBase) as unknown as Yo
  cambios(y)
  return y
}
const completo = (y: Yo) => {
  y.mis_votos.push({ ...y.mis_votos[0], proyecto_id: 'nutriwhat' })
  y.pendientes = []
  y.completo_ronda = true
}

type Manejador = (url: string, init: RequestInit) => { status: number; body?: unknown; headers?: Record<string, string> } | 'sin-red'
let llamadas: { url: string; init: RequestInit }[] = []
function servidor(manejar: Manejador) {
  llamadas = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url, init })
      const r = manejar(url, init)
      if (r === 'sin-red') throw new TypeError('Failed to fetch')
      return new Response(r.status === 304 || r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...(r.headers ?? {}) },
      })
    }),
  )
}
const conYo = (y: () => Yo, resto: Manejador = () => ({ status: 404 })): Manejador => (url, init) =>
  url === '/api/yo' ? { status: 200, body: y(), headers: { ETag: y().version } } : resto(url, init)
const montar = (ruta = `/m/${CODIGO}`) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/m/:codigo/*" element={<PaginaMesa />} />
      </Routes>
    </MemoryRouter>,
  )
const conToken = () => localStorage.setItem(`hz_token:${CODIGO}`, 'tok-1')

/** Resultado de la ronda 1 como lo manda el servidor con `oculta` (contrato del 20-oct): solo `n_votos`. */
const resultadosOcultos = (): Resultados => {
  const r = clonar(tablero) as unknown as Resultados
  r.proyectos_vivos = r.proyectos_vivos.map((p) => ({
    ...p,
    rondas: p.rondas
      .filter((x) => x.ronda === 1)
      .map((x) => ({ ...x, n_votos: 5, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null, total: null, oculta: true }) as RondaVivo),
  }))
  r.preliminar = true
  return r
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('1. escala bajo cada pregunta', () => {
  it('la lectura de la escala va fija bajo la pregunta y el lector la oye; en la primera de la ronda 1, cómo se avanza', async () => {
    servidor(conYo(() => yoCon((y) => ((y.mis_votos = []), (y.pendientes = ['insumex', 'nutriwhat'])))))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:insumex')
    montar()
    const grupo = await screen.findByRole('radiogroup')
    expect(screen.getByText(LECTURA_ESCALA)).toBeTruthy()
    const descrito = (grupo.getAttribute('aria-describedby') ?? '').split(' ').map((id) => document.getElementById(id)?.textContent)
    expect(descrito).toContain(LECTURA_ESCALA)
    expect(screen.getByText(AVISO_AVANCE).closest('.hz-aviso--info')).toBeTruthy()
    // En la segunda pregunta ya no hace falta.
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(screen.getByText(LECTURA_ESCALA)).toBeTruthy()
    expect(screen.queryByText(AVISO_AVANCE)).toBeNull()
  })

  it('en la ronda 2 la primera pregunta no repite cómo se avanza', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.sala.estado = 'r2_abierta'
          y.sala.ronda_actual = 2
          y.mis_votos = []
          y.pendientes = ['insumex', 'nutriwhat']
        }),
      ),
    )
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:insumex')
    montar()
    await screen.findByRole('radiogroup')
    expect(screen.getByText(LECTURA_ESCALA)).toBeTruthy()
    expect(screen.queryByText(AVISO_AVANCE)).toBeNull()
  })
})

describe('2. ronda 1 sin resultados en vivo (decisión 1 de Paola)', () => {
  it('con `oculta`, tras votar: «Calificación enviada» y cuándo salen los resultados, sin promedios ni matriz', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          completo(y)
          y.config.vista_participante = 'en_vivo'
          y.resultados = resultadosOcultos() as Yo['resultados']
        }),
      ),
    )
    conToken()
    const { container } = montar()
    expect(await screen.findByRole('heading', { name: 'Calificación enviada', level: 1 })).toBeTruthy()
    expect(screen.getByText(TEXTO_R1_OCULTA)).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Resultado parcial/ })).toBeNull()
    expect(container.querySelector('.hzp-matriz')).toBeNull()
    expect(container.querySelector('table')).toBeNull()
    expect(container.textContent).not.toMatch(/Hacen falta al menos/)
  })

  it('sin `oculta` (precierre o ronda 2) el resultado parcial se ve como antes', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          completo(y)
          y.config.vista_participante = 'en_vivo'
          y.resultados = { ...(clonar(tablero) as unknown as Resultados), preliminar: true } as Yo['resultados']
        }),
      ),
    )
    conToken()
    const { container } = montar()
    expect(await screen.findByRole('heading', { name: 'Resultado parcial de tu mesa' })).toBeTruthy()
    expect(container.querySelector('.hzp-matriz')).toBeTruthy()
    expect(screen.queryByText(TEXTO_R1_OCULTA)).toBeNull()
  })

  it('el resultado con la ronda oculta no dice que faltan votos: dice cuándo sale', () => {
    const y = yoBase as unknown as Yo
    const { container } = render(<ResultadoAlcance resultados={resultadosOcultos()} criterios={y.criterios} alcance="mesa" />)
    expect(screen.getByText(TEXTO_R1_OCULTA)).toBeTruthy()
    expect(container.textContent).not.toMatch(/Hacen falta/)
  })

  it('con `oculta` y `bajo_minimo` a la vez (contrato final del servidor) manda `oculta`', () => {
    const y = yoBase as unknown as Yo
    const r = resultadosOcultos()
    for (const p of r.proyectos_vivos) for (const x of p.rondas) Object.assign(x, { n_votos: 2, bajo_minimo: true })
    const { container } = render(<ResultadoAlcance resultados={r} criterios={y.criterios} alcance="mesa" />)
    expect(screen.getByText(TEXTO_R1_OCULTA)).toBeTruthy()
    expect(container.textContent).not.toMatch(/Hacen falta/)
    expect(container.querySelector('.hzp-matriz')).toBeNull()
  })
})

describe('3. aviso de datos hz-1.3 (decisiones 2 de Paola, 20 y 21-oct)', () => {
  it('dice qué datos se guardan, para qué, quién ve qué y el plazo; la casilla sale del servidor una sola vez', async () => {
    servidor(() => ({ status: 200, body: MESA }))
    const { container } = montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    const fila = (dt: string) => screen.getByText(dt, { selector: 'dt' }).nextElementSibling!.textContent
    expect(container.querySelector('.hzp-aviso-datos')!.getAttribute('data-version')).toBe(VERSION_AVISO_DATOS)
    expect(VERSION_AVISO_DATOS).toBe('hz-1.3')
    expect(fila('Qué datos')).toBe(AVISO_DATOS.datos)
    expect(fila('Qué datos')).toMatch(/IP, el país y el navegador/)
    expect(fila('Para qué')).toMatch(/^Identificarte en tu mesa, evitar inscripciones dobles y devolverte el acceso si cambias de celular\./)
    expect(fila('Quién ve qué')).toMatch(/nadie ve tu nombre: se ven los promedios de tu mesa o de la sala, que se actualizan con cada calificación/)
    expect(fila('Quién ve qué')).not.toMatch(/3 o más/)
    expect(fila('Quién ve qué')).toMatch(/sí ve tus calificaciones con tu nombre/)
    expect(fila('Tus derechos')).toMatch(/respondemos en un plazo máximo de 10 días hábiles\./)
    expect(screen.queryByText('Dónde se guardan')).toBeNull()
    expect(screen.getByText(AYUDA_CORREO)).toBeTruthy()
    expect(screen.getAllByText(/texto del servidor/)).toHaveLength(1)
  })

  it('en Perú dice que los datos se guardan fuera del país', async () => {
    servidor(() => ({ status: 200, body: { ...MESA, sala: { ...MESA.sala, pais: 'PE' } } }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    expect(screen.getByText('Dónde se guardan', { selector: 'dt' }).nextElementSibling!.textContent).toBe('En servidores ubicados fuera del Perú.')
  })
})

describe('4. inscripción con el botón siempre activo', () => {
  it('sin la casilla, el botón lleva a ella, le da el foco y dice qué falta; no inscribe', async () => {
    const desplazar = vi.fn()
    Element.prototype.scrollIntoView = desplazar
    // Cada ruta con su respuesta: tras inscribirse, la pantalla pide /api/yo y necesita una sala completa.
    servidor((url) =>
      url.startsWith('/api/mesas/')
        ? { status: 200, body: MESA }
        : url === '/api/yo'
          ? { status: 200, body: yoBase }
          : { status: 201, body: { token: 't', participante: yoBase.participante } },
    )
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    expect(screen.getByText(TEXTO_QUE_HARAS)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Pérez' } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: 'ana@empresa.com' } })
    const boton = screen.getByRole('button', { name: 'Inscribirme' })
    expect(boton.getAttribute('aria-disabled')).toBeNull()
    fireEvent.click(boton)
    expect(await screen.findByText(TEXTO_FALTA_CASILLA)).toBeTruthy()
    expect(screen.getByText(TEXTO_FALTA_CASILLA).closest('[role="alert"]')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('checkbox')))
    expect(desplazar).toHaveBeenCalled()
    expect(llamadas.some((l) => l.url === '/api/inscripcion')).toBe(false)
    // Al marcarla, el error se va y el mismo botón inscribe.
    fireEvent.click(screen.getByRole('checkbox'))
    expect(screen.queryByText(TEXTO_FALTA_CASILLA)).toBeNull()
    fireEvent.click(boton)
    await waitFor(() => expect(llamadas.some((l) => l.url === '/api/inscripcion')).toBe(true))
  })

  it('con datos que faltan y sin casilla, el foco va primero al campo y la casilla también avisa', async () => {
    servidor(() => ({ status: 200, body: MESA }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Tu nombre')))
    expect(screen.getByText(TEXTO_FALTA_CASILLA)).toBeTruthy()
  })
})

describe('5. pregunta compacta', () => {
  it('una línea «R1 · INSUMEX · Pregunta 1 de 6» con «Volver» pequeño, sin el título grande ni la fase', async () => {
    servidor(conYo(() => yoCon((y) => ((y.mis_votos = []), (y.pendientes = ['insumex', 'nutriwhat'])))))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:insumex')
    const { container } = montar()
    const h1 = await screen.findByRole('heading', { level: 1 })
    expect(h1.textContent).toBe('R1 · INSUMEX · Pregunta 1 de 6')
    expect(h1.querySelector('.hz-insignia--r1')!.textContent).toBe('R1')
    expect(container.querySelectorAll('h1')).toHaveLength(1)
    expect(container.querySelector('.hzp-fase')).toBeNull()
    expect(container.querySelector('.hz-titulo')).toBeNull()
    const volver = screen.getByRole('button', { name: 'Volver a los proyectos' })
    expect(volver.textContent).toBe('Volver')
    // La barra de avance va debajo de la línea, en el mismo bloque.
    expect(h1.closest('.hzp-cabeza')!.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('1')
    fireEvent.click(volver)
    expect(await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })).toBeTruthy()
  })

  it('en guiado la pregunta también va en una línea, sin el título del proyecto', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.config.modo_preguntas = 'guiado'
          y.sala.pregunta_guiada = { proyecto_id: 'nutriwhat', criterio_id: 'regulacion' }
        }),
      ),
    )
    conToken()
    const { container } = montar()
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toBe('R1 · NUTRIWHAT · Pregunta 3 de 6')
    expect(container.querySelector('.hzp-fase')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Volver a los proyectos' })).toBeNull()
  })
})

describe('6. caso y hoja', () => {
  it('el caso abre con el aviso de caso ficticio y los 2 proyectos; los otros 8, plegados', async () => {
    servidor(conYo(() => yoCon((y) => (y.sala.estado = 'inscripcion'))))
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    const caso = container.querySelector('article.hzp-lectura')!
    expect(caso.firstElementChild!.textContent).toBe(AVISO_CASO_FICTICIO)
    const vivos = screen.getByRole('region', { name: 'Los 2 proyectos que vas a calificar' })
    expect(within(vivos).getAllByRole('listitem').map((li) => li.querySelector('.hzp-proyecto__nombre')!.textContent)).toEqual(['INSUMEX', 'NUTRIWHAT'])
    // Los 2 van antes del caso.
    const titulos = [...caso.querySelectorAll('h2')].map((h) => h.textContent)
    expect(titulos[0]).toBe('Los 2 proyectos que vas a calificar')
    const plegable = caso.querySelector('details')!
    expect(plegable.open).toBe(false)
    expect(plegable.querySelector('summary')!.textContent).toBe('Los otros 8 proyectos del portafolio')
    expect(plegable.querySelectorAll('li')).toHaveLength(8)
  })

  it('en la pestaña Caso el botón es «Leer mi hoja»; «Calificar proyectos» solo en la hoja', async () => {
    servidor(conYo(() => yoCon((y) => ((y.mis_votos = []), (y.pendientes = ['insumex', 'nutriwhat'])))))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'lectura')
    montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    expect(screen.queryByRole('button', { name: 'Calificar proyectos' })).toBeNull()
    document.documentElement.scrollTop = 500
    fireEvent.click(screen.getByRole('button', { name: 'Leer mi hoja' }))
    expect(screen.getByRole('tab', { name: 'Tu hoja' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Tu hoja (perfil Conocimiento del cliente)' })).toBeTruthy()
    await waitFor(() => expect(document.documentElement.scrollTop).toBe(0))
    fireEvent.click(screen.getByRole('button', { name: 'Calificar proyectos' }))
    expect(await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })).toBeTruthy()
  })

  it('con las 6 hojas abiertas el botón del caso dice «Leer las hojas»', async () => {
    servidor(conYo(() => yoCon((y) => (y.config.revelar_hojas = true))))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'lectura')
    montar()
    expect(await screen.findByRole('button', { name: 'Leer las hojas' })).toBeTruthy()
  })
})

describe('7. textos de perfil, calificación y conexión', () => {
  it('bienvenida y proyectos con «perfil {nombre}»', async () => {
    servidor(conYo(() => yoCon((y) => ((y.mis_votos = []), (y.pendientes = ['insumex', 'nutriwhat'])))))
    conToken()
    marcarBienvenida(CODIGO, true)
    montar()
    expect(await screen.findByRole('heading', { name: 'Tu perfil: Conocimiento del cliente' })).toBeTruthy()
    expect(screen.getByText(/Tú aportas la mirada del perfil Conocimiento del cliente\./)).toBeTruthy()
    cleanup()
    marcarBienvenida(CODIGO, false)
    montar()
    expect(await screen.findByText(/Usa el caso y tu hoja del perfil Conocimiento del cliente\./)).toBeTruthy()
  })

  it('con respuestas a medias dice cuántas lleva en vez de «Pendiente»', async () => {
    servidor(conYo(() => yoCon((y) => ((y.mis_votos = []), (y.pendientes = ['insumex', 'nutriwhat'])))))
    conToken()
    sessionStorage.setItem(`hz_borrador_insumex_r1:${CODIGO}`, JSON.stringify({ alistamiento_tecnico: 3, conocimiento_cliente: 5, regulacion: 7 }))
    montar()
    await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })
    const fila = (n: string) => screen.getByText(n, { selector: '.hzp-proyecto__nombre' }).closest('li')!
    expect(within(fila('INSUMEX')).getByText('3 de 6 respondidas')).toBeTruthy()
    expect(within(fila('NUTRIWHAT')).getByText('Pendiente')).toBeTruthy()
  })

  it('con todo calificado, la hoja ofrece «Ver mis calificaciones»', async () => {
    servidor(conYo(() => yoCon(completo)))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'lectura')
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Tu hoja' }))
    expect(screen.getByRole('button', { name: 'Ver mis calificaciones' })).toBeTruthy()
  })

  it('la sesión perdida se pide en el salón, sin hablar del panel', () => {
    expect(PIDE_ACCESO).toBe('Levanta la mano y pídele al facilitador que te dé acceso de nuevo: te muestra un QR para volver a entrar.')
    expect(PIDE_ACCESO).not.toMatch(/panel/)
  })

  it('«sin señal» se avisa desde el tercer fallo seguido, no antes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let fallar = false
    servidor((url) => (url === '/api/yo' ? (fallar ? 'sin-red' : { status: 200, body: yoBase, headers: { ETag: 'v1' } }) : { status: 404 }))
    const { result } = renderHook(() => usarYo('tok-1'))
    await waitFor(() => expect(result.current.yo).toBeTruthy())
    fallar = true
    const consultas = () => llamadas.filter((l) => l.url === '/api/yo').length
    // Paso a paso (500 ms): cada consulta fallida se revisa antes de la siguiente.
    for (let i = 1; i <= FALLOS_SIN_SENAL; i++) {
      const antes = consultas()
      while (consultas() === antes)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(500)
        })
      await act(async () => {})
      if (i < FALLOS_SIN_SENAL) expect(result.current.sinConexion).toBe(false)
    }
    await waitFor(() => expect(result.current.sinConexion).toBe(true))
    expect(FALLOS_SIN_SENAL).toBe(3)
  })

  it('el aviso de sin señal es un chip de una línea que no asusta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let fallar = false
    servidor((url) => (url === '/api/yo' ? (fallar ? 'sin-red' : { status: 200, body: yoBase, headers: { ETag: 'v1' } }) : { status: 404 }))
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })
    fallar = true
    for (let i = 0; i < 4 && !screen.queryByText(TEXTO_SIN_SENAL); i++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
    const chip = (await screen.findByText(TEXTO_SIN_SENAL)).closest('.hzp-chip')!
    expect(chip.getAttribute('role')).toBe('status')
    expect(chip.querySelector('.hz-aviso__titulo')).toBeNull()
  })
})

describe('8. resultado', () => {
  const y = yoBase as unknown as Yo

  it('nombres cortos, «Promedio de N votos» y la leyenda de la matriz con letra de 12 px o más', () => {
    const r = clonar(tablero) as unknown as Resultados
    const { container } = render(<ResultadoAlcance resultados={r} criterios={y.criterios} alcance="mesa" />)
    const tabla = screen.getAllByRole('table')[0]
    expect(within(tabla).getAllByRole('rowheader').map((th) => th.getAttribute('abbr'))).toEqual(Object.values(NOMBRE_CORTO))
    expect(within(tabla).getAllByRole('columnheader')[0].textContent).toBe('Promedio de 20 votos')
    const leyenda = container.querySelector('.hzp-leyenda')!
    expect(leyenda.previousElementSibling!.classList.contains('hzp-matriz')).toBe(true)
    expect(leyenda.textContent).toContain(LECTURA_BURBUJA)
    expect(leyenda.textContent).toContain(LECTURA_EJES)
    expect([...leyenda.querySelectorAll('.hz-insignia')].map((i) => i.textContent)).toEqual(['R1', 'R2'])
    const letras = [...container.querySelectorAll('.hzp-matriz svg text')].filter((t) => !t.classList.contains('hz-mz-horizonte')).map((t) => Number(t.getAttribute('font-size')))
    expect(letras.length).toBeGreaterThan(0)
    expect(Math.min(...letras)).toBeGreaterThanOrEqual(12)
  })

  it('con votos distintos por ronda, el encabezado dice cuántos en cada una', () => {
    const r = clonar(tablero) as unknown as Resultados
    for (const p of r.proyectos_vivos) for (const x of p.rondas) x.n_votos = x.ronda === 1 ? 6 : 5
    render(<ResultadoAlcance resultados={r} criterios={y.criterios} alcance="mesa" />)
    expect(within(screen.getAllByRole('table')[0]).getAllByRole('columnheader')[0].textContent).toBe('Promedio de 6 votos en R1 y 5 votos en R2')
  })

  it('la insignia del resultado parcial informa sin alarmar', () => {
    const r = { ...(clonar(tablero) as unknown as Resultados), preliminar: true }
    render(<ResultadoAlcance resultados={r} criterios={y.criterios} alcance="mesa" />)
    const insignia = screen.getByText(TEXTO_PARCIAL)
    expect(insignia.className).toBe('hz-insignia hz-insignia--neutra')
    expect(screen.queryByText('Preliminar')).toBeNull()
  })

  it('cuenta tus respuestas que cambiaron entre rondas, sin recalcular nada', () => {
    const v = (proyecto_id: string, ronda: 1 | 2, cambios: Partial<typeof TODAS> = {}) => ({ proyecto_id, ronda, respuestas: { ...TODAS, ...cambios }, actualizado_at: '' }) as unknown as Voto
    expect(cambiosEntreRondas([v('insumex', 1), v('nutriwhat', 1), v('insumex', 2, { regulacion: 7, alineacion_core: 1 }), v('nutriwhat', 2, { inversion_requerida: 9 })], y.criterios)).toEqual({ cambios: 3, total: 12 })
    // Un proyecto sin voto en la ronda 1 no cuenta.
    expect(cambiosEntreRondas([v('insumex', 1), v('insumex', 2), v('nutriwhat', 2)], y.criterios)).toEqual({ cambios: 0, total: 6 })
    expect(cambiosEntreRondas([v('insumex', 2)], y.criterios)).toEqual({ cambios: 0, total: 0 })
  })

  it('al cerrar la ronda 2: «Cambiaste N de tus 12 respuestas» y la pregunta para la mesa', async () => {
    const v = (proyecto_id: string, ronda: 1 | 2, cambios: Partial<typeof TODAS> = {}) => ({ proyecto_id, ronda, respuestas: { ...TODAS, ...cambios }, actualizado_at: '' })
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.sala.estado = 'r2_cerrada'
          y.sala.ronda_actual = 2
          y.mis_votos = [v('insumex', 2, { regulacion: 9 }), v('nutriwhat', 2, { regulacion: 1, alineacion_core: 5 })] as Yo['mis_votos']
          y.mis_votos_anteriores = [v('insumex', 1), v('nutriwhat', 1)] as Yo['mis_votos']
          y.resultados = clonar(tablero) as unknown as Yo['resultados']
        }),
      ),
    )
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Ronda 2 cerrada' })
    expect(screen.getByText('Cambiaste 3 de tus 12 respuestas entre la ronda 1 y la 2.')).toBeTruthy()
    expect(screen.getByText('¿Qué dato de otra hoja te hizo cambiar?')).toBeTruthy()
  })

  it('en la ronda 1 cerrada no hay cierre personal', async () => {
    servidor(conYo(() => yoCon((y) => ((y.sala.estado = 'r1_cerrada'), (y.resultados = clonar(tablero) as unknown as Yo['resultados'])))))
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Ronda 1 cerrada' })
    expect(screen.queryByText(/Cambiaste|No cambiaste/)).toBeNull()
  })
})

describe('9. logo del celular', () => {
  it('lleva a la entrada de la mesa, no a la landing', async () => {
    servidor(() => ({ status: 200, body: MESA }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    const logo = document.querySelector('.hzp-cabecera a.hz-producto__marca')!
    expect(logo.getAttribute('href')).toBe(`/m/${CODIGO}`)
  })
})
