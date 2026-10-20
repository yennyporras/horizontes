// @vitest-environment jsdom
// Auditoría final del celular (20-oct): textos que dicen lo que pasa, precierre del alcance, barra superior carbón,
// espacio del pie fijo y diagramación del resumen.
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import yoBase from '../../../mocks/GET_api_yo.json'
import tablero from '../../../mocks/GET_api_tablero.json'
import PaginaMesa, { TEXTO_COLA_VARIAS } from '../PaginaMesa'
import { TEXTO_QUE_HARAS } from '../pantallas/Inscripcion'
import { ResultadoAlcance } from '../pantallas/Resultado'
import type { Resultados, Voto, Yo } from '../api'

const CODIGO = 'HZ7K2-1'
const MESA = {
  sala: { id: 's_demo', nombre: 'Taller Horizontes demo', estado: 'inscripcion' },
  mesa: { id: 'm1', nombre: 'Mesa 1' },
  inscripcion_abierta: true,
  consentimiento: { version: 'estratek-v1', texto_autorizacion: 'Autorizo a Estratek a tratar mis datos.', politica_url: 'https://estratek.com.co/politica' },
}
const TODAS = { alistamiento_tecnico: 3, conocimiento_cliente: 3, regulacion: 3, capacidades_organizacionales: 3, alineacion_core: 3, inversion_requerida: 3 }

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const yoCon = (cambios: (y: Yo) => void): Yo => {
  const y = clonar(yoBase) as unknown as Yo
  cambios(y)
  return y
}
/** Los 2 proyectos votados en la ronda 1. */
const completo = (y: Yo) => {
  y.mis_votos = [y.mis_votos[0], { ...y.mis_votos[0], proyecto_id: 'nutriwhat' }]
  y.pendientes = []
  y.completo_ronda = true
}
const resultadosSala = (precierre: boolean) => {
  const r = clonar(tablero) as unknown as Resultados
  r.alcance = { tipo: 'sala' } as Resultados['alcance']
  r.progreso.precierre = precierre
  return r
}

type Manejador = (url: string) => { status: number; body?: unknown; headers?: Record<string, string> } | 'sin-red'
let llamadas: string[] = []
function servidor(manejar: Manejador) {
  llamadas = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      llamadas.push(url)
      const r = manejar(url)
      if (r === 'sin-red') throw new TypeError('Failed to fetch')
      return new Response(r.status === 304 || r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...(r.headers ?? {}) },
      })
    }),
  )
}
const conYo = (y: () => Yo, resto: Manejador = () => ({ status: 404 })): Manejador => (url) =>
  url === '/api/yo' ? { status: 200, body: y(), headers: { ETag: y().version } } : resto(url)

const montar = (ruta = `/m/${CODIGO}`) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/m/:codigo/*" element={<PaginaMesa />} />
      </Routes>
    </MemoryRouter>,
  )
const conToken = () => localStorage.setItem(`hz_token:${CODIGO}`, 'tok-1')
const css = () => readFileSync('web/participante/participante.css', 'utf8')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('marco: la misma apariencia que el panel', () => {
  it('barra superior carbón (data-tema="carbon") sobre la página clara', async () => {
    servidor(conYo(() => yoCon((y) => (y.sala.estado = 'inscripcion'))))
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    const raiz = container.querySelector('.hzp-vista')!
    expect(raiz.getAttribute('data-tema')).toBe('claro')
    const cabecera = container.querySelector('.hzp-cabecera')!
    expect(cabecera.getAttribute('data-tema')).toBe('carbon')
    expect(cabecera.querySelector('.hz-producto')).toBeTruthy()
    // Solo la barra es carbón: el contenido sigue en el tema claro.
    expect(container.querySelector('main')!.closest('[data-tema]')!.getAttribute('data-tema')).toBe('claro')
  })

  it('el espacio final mide lo que el pie fijo; sin pie no queda un hueco de barra', async () => {
    servidor(conYo(() => yoCon((y) => (y.sala.estado = 'inscripcion'))))
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    const raiz = container.querySelector<HTMLElement>('.hzp-vista')!
    // jsdom no mide: con barra, la variable existe (alto del pie); el CSS la suma al respiro final.
    expect(raiz.style.getPropertyValue('--hzp-alto-pie')).toMatch(/^\d+px$/)
    expect(css()).toMatch(/\.hz\.hzp-vista \{ padding-bottom: calc\(var\(--hzp-alto-pie, 7\.5rem\) \+ var\(--hz-sp-8\)\); \}/)
    cleanup()
    // Sala cerrada sin barra: el alto del pie es 0.
    sessionStorage.clear()
    servidor(conYo(() => yoCon((y) => ((y.sala.estado = 'cerrada'), (y.resultados = null)))))
    const otro = montar()
    await screen.findByRole('heading', { name: 'El taller terminó' })
    expect(otro.container.querySelector('.hzp-pie')).toBeNull()
    expect(otro.container.querySelector<HTMLElement>('.hzp-vista')!.style.getPropertyValue('--hzp-alto-pie')).toBe('0px')
  })

  it('celular girado: el contexto conserva el margen lateral de la página', () => {
    const bloque = css().slice(css().indexOf('@media (max-height: 30rem) and (orientation: landscape)'))
    const contexto = bloque.match(/\.hzp-contexto \{[^}]*\}/)![0]
    expect(contexto).not.toMatch(/padding:/)
    expect(contexto).toMatch(/padding-block:/)
    // La regla compacta solo toca el celular, no el panel ni el tablero si comparten la página.
    expect(bloque).toMatch(/\.hzp-vista \.hz-contenido \{ gap: var\(--hz-sp-3\); \}/)
  })
})

describe('textos que dicen lo que pasa', () => {
  it('sin señal en la primera carga el título dice «Sin conexión», no una falla del servidor', async () => {
    servidor(() => 'sin-red')
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeTruthy()
    expect(screen.getByText('No pudimos cargar tu mesa. Revisa la señal, seguimos intentando.')).toBeTruthy()
    expect(screen.queryByText('Algo falló de nuestro lado')).toBeNull()
  })

  it('con un 500 en la primera carga sí es «Algo falló de nuestro lado»', async () => {
    servidor(() => ({ status: 500, body: { error: { codigo: 'ERROR', mensaje: 'x' } } }))
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Algo falló de nuestro lado' })).toBeTruthy()
  })

  it('2 calificaciones por enviar: el texto concuerda en plural', async () => {
    servidor((url) => (url === '/api/yo' ? { status: 200, body: yoCon((y) => ((y.mis_votos = []), (y.pendientes = ['insumex', 'nutriwhat']))) } : 'sin-red'))
    conToken()
    localStorage.setItem(
      `hz_cola:${CODIGO}`,
      JSON.stringify(['insumex', 'nutriwhat'].map((p, i) => ({ id: `v${i}`, participante_id: 'p_8f2a', proyecto_id: p, nombre: p.toUpperCase(), ronda: 1, respuestas: TODAS }))),
    )
    montar()
    // Chip de una línea que dice qué hacer, sin asustar (QA por roles del 20-oct).
    const chip = (await screen.findByText('2 calificaciones por enviar')).closest('.hzp-chip')!
    expect(chip.getAttribute('role')).toBe('status')
    expect(chip.querySelector(':scope > span:last-child')!.textContent).toBe(`2 calificaciones por enviar. ${TEXTO_COLA_VARIAS}`)
  })

  it('el caso cuenta los proyectos que trae el portafolio', async () => {
    servidor(conYo(() => yoCon((y) => ((y.sala.estado = 'inscripcion'), (y.contenido.portafolio = y.contenido.portafolio.slice(0, 7))))))
    conToken()
    montar()
    // Los 2 que se califican arriba; los otros, plegados al final (QA por roles del 20-oct).
    expect(await screen.findByRole('heading', { name: 'Los 2 proyectos que vas a calificar' })).toBeTruthy()
    expect(screen.getByText('Los otros 5 proyectos del portafolio')).toBeTruthy()
  })

  it('voto registrado: el enlace al caso dice lo mismo que en las demás pantallas', async () => {
    servidor(conYo(() => yoCon(completo)))
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Calificación enviada' })
    expect(screen.getByRole('button', { name: 'Leer el caso y tu hoja' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Volver al caso' })).toBeNull()
  })

  it('la inscripción se reabre sola: con la ronda 2 cerrada la pantalla sigue consultando la mesa', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let estado = 'r2_cerrada'
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: { ...MESA, inscripcion_abierta: estado !== 'r2_cerrada', sala: { ...MESA.sala, estado } } } : { status: 404 }))
    montar()
    await screen.findByRole('heading', { name: 'La votación ya terminó' })
    expect(screen.getByText('Las dos rondas de esta sala ya se cerraron y no recibe inscripciones nuevas.')).toBeTruthy()
    // El facilitador reabre la ronda 2: la inscripción vuelve a estar abierta.
    estado = 'r2_abierta'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5100)
    })
    expect(await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })).toBeTruthy()
  })

  it('con la sala cerrada no sigue consultando', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: { ...MESA, inscripcion_abierta: false, sala: { ...MESA.sala, estado: 'cerrada' } } } : { status: 404 }))
    montar()
    await screen.findByRole('heading', { name: 'El taller ya terminó' })
    const antes = llamadas.length
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000)
    })
    expect(llamadas.length).toBe(antes)
  })

  it('la inscripción no repite la sala y la mesa que ya muestra la franja de arriba', async () => {
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: MESA } : { status: 404 }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    expect(screen.getByText(TEXTO_QUE_HARAS)).toBeTruthy()
    expect(screen.queryByText(/Estás en Mesa 1 de/)).toBeNull()
  })
})

describe('precierre: el que cuenta es el del alcance de los resultados (SPEC §4)', () => {
  it('alcance sala en vivo: que termine la mesa no cambia el resultado parcial de la sala', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          completo(y)
          y.config.alcance_resultados = 'sala'
          y.config.vista_participante = 'en_vivo'
          y.progreso_mesa = { inscritos: 3, completos: 3, precierre: true }
          y.resultados = resultadosSala(false)
        }),
      ),
    )
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Resultado parcial de la sala' })).toBeTruthy()
    expect(screen.queryByText(/Todos votaron/)).toBeNull()
  })

  it('alcance sala con «Voto registrado»: la mesa completa no promete un resultado que no llega', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          completo(y)
          y.config.alcance_resultados = 'sala'
          y.progreso_mesa = { inscritos: 3, completos: 3, precierre: true }
          y.resultados = null
        }),
      ),
    )
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Calificación enviada' })
    expect(screen.queryByText(/Todos votaron/)).toBeNull()
    expect(screen.queryByText(/El resultado se muestra cuando hay al menos/)).toBeNull()
  })

  it('alcance sala con la sala completa: «Todos votaron en la sala» y su resultado preliminar', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          completo(y)
          y.config.alcance_resultados = 'sala'
          y.progreso_mesa = { inscritos: 3, completos: 3, precierre: true }
          y.resultados = resultadosSala(true)
        }),
      ),
    )
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Resultado preliminar de la sala' })).toBeTruthy()
    expect(screen.getByText('Todos votaron en la sala')).toBeTruthy()
    // Una sola vez «preliminar» en el texto: el título y la insignia ya lo dicen.
    expect(screen.getByText('Puedes editar tus calificaciones hasta que el facilitador cierre la ronda. Al cerrarla sale el resultado final.')).toBeTruthy()
  })
})

describe('resultado', () => {
  it('en la comparación «Tú» va solo en la ronda 2 (mis_votos es de la ronda actual) y el texto lo dice', () => {
    const r = clonar(tablero) as unknown as Resultados
    const mios: Voto[] = [{ proyecto_id: 'insumex', ronda: 2, respuestas: TODAS, actualizado_at: '' } as unknown as Voto]
    const y = yoBase as unknown as Yo
    render(<ResultadoAlcance resultados={r} criterios={y.criterios} alcance="mesa" misVotos={mios} />)
    expect(screen.getByText('Debajo de cada promedio de la ronda 2 va tu calificación (Tú). Solo la ves en tu celular.')).toBeTruthy()
  })

  it('con mis_votos_anteriores, la comparación R1→R2 muestra «Tú» en las dos rondas', async () => {
    const r1 = { proyecto_id: 'insumex', ronda: 1, respuestas: TODAS, actualizado_at: '' } as unknown as Voto
    const r2 = { proyecto_id: 'insumex', ronda: 2, respuestas: { ...TODAS, regulacion: 9 }, actualizado_at: '' } as unknown as Voto
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.sala.estado = 'r2_cerrada'
          y.sala.ronda_actual = 2
          y.mis_votos = [r2]
          y.mis_votos_anteriores = [r1]
          y.resultados = clonar(tablero) as unknown as Resultados
        }),
      ),
    )
    conToken()
    montar()
    const tabla = (await screen.findAllByRole('table'))[0]
    const fila = [...tabla.querySelectorAll('tr')].find((tr) => tr.querySelector('th')?.textContent?.startsWith('Regulación'))!
    expect([...fila.querySelectorAll('.hzp-tabla__mia')].map((s) => s.textContent)).toEqual(['Tu calificación: Tú 3', 'Tu calificación: Tú 9'])
    expect(screen.getAllByText('Debajo de cada promedio va tu calificación (Tú). Solo la ves en tu celular.').length).toBeGreaterThan(0)
  })

  it('el resumen pone la respuesta a todo el ancho, debajo del criterio y su botón', () => {
    const c = css()
    expect(c).toMatch(/\.hzp-resumen__dato \{ display: contents; \}/)
    expect(c).toMatch(/\.hzp-resumen__valor \{ grid-column: 1 \/ -1; grid-row: 2; \}/)
  })
})

describe('modo guiado', () => {
  it('en el caso con la ronda abierta, el aviso manda a la pregunta del facilitador y no a «califica los 2 proyectos»', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.config.modo_preguntas = 'guiado'
          y.sala.pregunta_guiada = { proyecto_id: 'insumex', criterio_id: 'regulacion' }
        }),
      ),
    )
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'lectura')
    montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    expect(screen.getByText(/Cuando termines de leer, ve a la pregunta que marca el facilitador\./)).toBeTruthy()
    expect(screen.queryByText(/califica los 2 proyectos/)).toBeNull()
    // Desde el caso, la hoja; desde la hoja, la pregunta (QA por roles del 20-oct).
    expect(screen.queryByRole('button', { name: 'Ir a la pregunta' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Leer mi hoja' }))
    expect(screen.getByRole('tab', { name: 'Tu hoja' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('button', { name: 'Ir a la pregunta' })).toBeTruthy()
  })

  it('esperando la pregunta, lo que está en la cola cuenta como hecho', async () => {
    servidor((url) =>
      url === '/api/yo'
        ? {
            status: 200,
            body: yoCon((y) => {
              y.config.modo_preguntas = 'guiado'
              y.sala.pregunta_guiada = null
            }),
          }
        : 'sin-red',
    )
    conToken()
    localStorage.setItem(`hz_cola:${CODIGO}`, JSON.stringify([{ id: 'v1', participante_id: 'p_8f2a', proyecto_id: 'nutriwhat', nombre: 'NUTRIWHAT', ronda: 1, respuestas: TODAS }]))
    montar()
    await screen.findByRole('heading', { name: 'Espera la pregunta del facilitador' })
    await waitFor(() => expect(screen.getAllByRole('progressbar')[0].getAttribute('aria-valuetext')).toMatch(/Llevas 2 de 2/))
  })
})
