// @vitest-environment jsdom
// Correcciones de la QA del celular (QA-P-…), de la auditoría del frontend (F-…) y de las decisiones D1 y D2 del 20-oct.
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate, type Location, type NavigateFunction } from 'react-router-dom'
import yoBase from '../../../mocks/GET_api_yo.json'
import tablero from '../../../mocks/GET_api_tablero.json'
import PaginaMesa from '../PaginaMesa'
import { usarYo } from '../usarYo'
import type { PreguntaGuiada, Resultados, Yo } from '../api'

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
const guiado = (pregunta: PreguntaGuiada | null, cambios: (y: Yo) => void = () => {}) =>
  yoCon((y) => {
    y.config.modo_preguntas = 'guiado'
    y.sala.pregunta_guiada = pregunta
    cambios(y)
  })
const resultadosCon = (votos: (ronda: number) => number) => {
  const r = clonar(tablero) as unknown as Resultados
  for (const p of r.proyectos_vivos) for (const x of p.rondas) x.n_votos = votos(x.ronda)
  return r
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
/** /api/yo con ETag de su versión: cada cambio de `yo` llega como versión nueva. */
const conYo = (y: () => Yo, resto: Manejador = () => ({ status: 404 })): Manejador => (url, init) =>
  url === '/api/yo' ? { status: 200, body: y(), headers: { ETag: y().version } } : resto(url, init)

let ubicacion: Location
let navegar: NavigateFunction
function Sonda() {
  ubicacion = useLocation()
  navegar = useNavigate()
  return null
}
const montar = (ruta = `/m/${CODIGO}`) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Sonda />
      <Routes>
        <Route path="/m/:codigo/*" element={<PaginaMesa />} />
      </Routes>
    </MemoryRouter>,
  )
const conToken = () => localStorage.setItem(`hz_token:${CODIGO}`, 'tok-1')
/** El evento `online` hace que el celular consulte /api/yo sin esperar el intervalo. */
const consultarYa = () => act(() => void window.dispatchEvent(new Event('online')))
const elegir = (i = 0) => fireEvent.click(within(screen.getByRole('radiogroup')).getAllByRole('radio')[i])
const progreso = () => screen.getAllByRole('progressbar')[0].getAttribute('aria-valuetext')
const tonoDe = (texto: RegExp | string) => screen.getByText(texto).closest('.hz-aviso')?.className ?? ''

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('D1: acceso nuevo que da el facilitador', () => {
  it('/m/{codigo}?acceso=… canjea con POST /api/acceso, guarda la sesión, limpia la URL y retoma donde iba', async () => {
    let cuerpo: unknown = null
    servidor(
      conYo(
        () => yoBase as unknown as Yo,
        (url, init) => {
          if (url !== '/api/acceso') return { status: 404 }
          cuerpo = JSON.parse(String(init.body))
          return { status: 200, body: { token: 'tok-acceso', participante: yoBase.participante } }
        },
      ),
    )
    localStorage.setItem(`hz_token:${CODIGO}`, 'tok-viejo')
    localStorage.setItem(`hz_datos:${CODIGO}`, JSON.stringify({ nombre: 'Ana', correo: 'ana@empresa.com' }))
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:nutriwhat')
    montar(`/m/${CODIGO}?acceso=abc123`)
    expect(await screen.findByRole('heading', { name: 'NUTRIWHAT', level: 1 })).toBeTruthy()
    expect(cuerpo).toEqual({ acceso: 'abc123' })
    expect(llamadas.filter((l) => l.url === '/api/acceso')).toHaveLength(1)
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBe('tok-acceso')
    expect((llamadas.find((l) => l.url === '/api/yo')!.init.headers as Record<string, string>)['X-Participante-Token']).toBe('tok-acceso')
    // El enlace es de un solo uso: sale de la URL. Nombre y correo ya no se guardan en el celular.
    expect(ubicacion.search).toBe('')
    expect(localStorage.getItem(`hz_datos:${CODIGO}`)).toBeNull()
    expect(screen.getByText('Listo, entraste de nuevo. Retomas donde ibas.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Tu perfil es/ })).toBeNull()
  })

  it.each([
    [410, 'ACCESO_VENCIDO', 'Este enlace ya venció', /duran 15 minutos/],
    [404, 'ACCESO_INVALIDO', 'Este enlace no sirve', /ya lo hayas usado/],
    [409, 'SALA_CERRADA', 'El taller ya terminó', /ya no da acceso nuevo/],
    [403, 'PARTICIPANTE_INACTIVO', 'El facilitador te retiró de esta mesa', /avísale en el salón/],
    [429, 'DEMASIADAS_PETICIONES', 'Demasiados intentos', /Espera un minuto/],
  ])('%s %s: error claro y sin sesión nueva', async (status, codigo, titulo, detalle) => {
    servidor((url) => (url === '/api/acceso' ? { status, body: { error: { codigo, mensaje: 'x' } } } : { status: 404 }))
    montar(`/m/${CODIGO}?acceso=malo-${status}`)
    expect(await screen.findByRole('heading', { name: titulo })).toBeTruthy()
    expect(screen.getByText(detalle)).toBeTruthy()
    if (status === 410 || status === 404) expect(screen.getByText(/«Dar acceso de nuevo»/)).toBeTruthy()
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBeNull()
  })

  it('sin señal deja reintentar el canje', async () => {
    let red = false
    servidor(
      conYo(
        () => yoBase as unknown as Yo,
        (url) => (url === '/api/acceso' ? (red ? { status: 200, body: { token: 'tok-r', participante: yoBase.participante } } : 'sin-red') : { status: 404 }),
      ),
    )
    montar(`/m/${CODIGO}?acceso=sin-red`)
    expect(await screen.findByRole('heading', { name: 'Sin conexión' })).toBeTruthy()
    red = true
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('Listo, entraste de nuevo. Retomas donde ibas.')).toBeTruthy()
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBe('tok-r')
  })
})

describe('QA-P-01 y F-3: modo guiado, la ronda se cierra con respuestas solo en el celular', () => {
  it('avisa que la calificación del proyecto incompleto no cuenta', async () => {
    let yo = guiado({ proyecto_id: 'nutriwhat', criterio_id: 'regulacion' })
    servidor(conYo(() => yo))
    sessionStorage.setItem(`hz_borrador_nutriwhat_r1:${CODIGO}`, JSON.stringify({ alistamiento_tecnico: 3, conocimiento_cliente: 3 }))
    conToken()
    montar()
    await screen.findByRole('radiogroup', { name: 'Regulación' })
    elegir(1)
    await screen.findByText(/llevas 3/)
    yo = guiado(null, (y) => {
      y.version = 'v-cerrada'
      y.sala.estado = 'r1_cerrada'
      y.resultados = resultadosCon(() => 2)
    })
    consultarYa()
    const texto = /La ronda 1 se cerró antes de que respondieras las 6 preguntas de NUTRIWHAT\. Tu calificación de NUTRIWHAT no cuenta en esta ronda\./
    expect(await screen.findByText(texto)).toBeTruthy()
    expect(tonoDe(texto)).toContain('hz-aviso--error')
    // INSUMEX ya tenía su voto en el servidor: nada que avisar de ese proyecto.
    expect(screen.queryByText(/INSUMEX no cuenta/)).toBeNull()
  })
})

describe('QA-P-02: el botón atrás vuelve a la pantalla anterior', () => {
  it('de la pregunta vuelve a los proyectos y adelante retoma la pregunta', async () => {
    servidor(conYo(() => yoBase as unknown as Yo))
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })
    fireEvent.click(screen.getByRole('button', { name: 'Calificar NUTRIWHAT' }))
    await screen.findByRole('heading', { name: 'NUTRIWHAT', level: 1 })
    expect(ubicacion.pathname).toBe(`/m/${CODIGO}`)
    act(() => navegar(-1))
    expect(await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })).toBeTruthy()
    expect(sessionStorage.getItem(`hz_vista:${CODIGO}`)).toBe('inicio')
    act(() => navegar(1))
    expect(await screen.findByRole('heading', { name: 'NUTRIWHAT', level: 1 })).toBeTruthy()
  })
})

describe('QA-P-03: aviso del cierre según lo que pasó, y se va con la ronda nueva', () => {
  it('sin cambios es informativo y desaparece al abrir la ronda 2', async () => {
    let yo = yoBase as unknown as Yo
    servidor(conYo(() => yo))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:insumex')
    montar()
    await screen.findByRole('heading', { name: 'Revisa tus respuestas' })
    yo = yoCon((y) => {
      y.version = 'v-r1c'
      y.sala.estado = 'r1_cerrada'
      y.resultados = clonar(tablero) as unknown as Resultados
    })
    consultarYa()
    const texto = 'La ronda 1 se cerró mientras calificabas INSUMEX. Cuenta tu última calificación guardada.'
    expect(await screen.findByText(texto)).toBeTruthy()
    expect(tonoDe(texto)).toContain('hz-aviso--info')
    expect(screen.getByRole('heading', { name: 'Ronda 1 cerrada' })).toBeTruthy()
    yo = yoCon((y) => {
      y.version = 'v-r2'
      y.sala.estado = 'r2_abierta'
      y.sala.ronda_actual = 2
    })
    consultarYa()
    await screen.findByRole('heading', { name: 'Ronda 2: califica los 2 proyectos' })
    expect(screen.queryByText(texto)).toBeNull()
  })
})

describe('QA-P-04: un nombre largo sin espacios no ensancha la página', () => {
  it('el saludo parte la palabra', async () => {
    const largo = 'A'.repeat(80)
    servidor(conYo(() => yoCon((y) => (y.participante.nombre = largo))))
    conToken()
    localStorage.setItem(`hz_bienvenida:${CODIGO}`, '1')
    montar()
    const saludo = await screen.findByText(`Hola, ${largo}`)
    expect(saludo.classList.contains('hzp-saludo')).toBe(true)
    expect(readFileSync('web/participante/participante.css', 'utf8')).toMatch(/\.hzp-contexto p, \.hzp-saludo \{ overflow-wrap: anywhere; \}/)
  })
})

describe('inscripción: foco, errores y validación (QA-P-05, QA-P-09, QA-P-10, QA-P-17)', () => {
  const llenar = (nombre: string, correo = 'ana@empresa.com') => {
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: nombre } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: correo } })
  }
  const inscribirme = () => fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }))

  it('el primer envío con errores lleva el foco al primer campo inválido', async () => {
    servidor(() => ({ status: 200, body: MESA }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    fireEvent.click(screen.getByRole('checkbox'))
    inscribirme()
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Tu nombre')))
  })

  it('un error nuevo reemplaza al anterior', async () => {
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: MESA } : { status: 500 }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    fireEvent.click(screen.getByRole('checkbox'))
    llenar('Ana Pérez')
    inscribirme()
    expect(await screen.findByText('Algo falló de nuestro lado. Vuelve a intentarlo en unos segundos.')).toBeTruthy()
    llenar('')
    inscribirme()
    expect(await screen.findByText('Escribe tu nombre.')).toBeTruthy()
    expect(screen.queryByText('Algo falló de nuestro lado. Vuelve a intentarlo en unos segundos.')).toBeNull()
  })

  it('el nombre se valida como en el servidor (2 a 120) y un 422 del servidor va en su campo', async () => {
    servidor((url) =>
      url.startsWith('/api/mesas/')
        ? { status: 200, body: MESA }
        : { status: 422, body: { error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Tu nombre solo puede tener letras, números y signos comunes.' } } },
    )
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    expect(screen.getByLabelText('Tu nombre').getAttribute('maxlength')).toBe('120')
    fireEvent.click(screen.getByRole('checkbox'))
    llenar('M')
    inscribirme()
    expect(await screen.findByText('Escribe tu nombre (entre 2 y 120 caracteres).')).toBeTruthy()
    expect(llamadas.some((l) => l.url === '/api/inscripcion')).toBe(false)
    llenar('Ana <b>')
    inscribirme()
    expect(await screen.findByText('Tu nombre solo puede tener letras, números y signos comunes.')).toBeTruthy()
    expect(screen.getByLabelText('Tu nombre').getAttribute('aria-invalid')).toBe('true')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Tu nombre')))
  })

  it('Perú: los derechos se nombran como en la Ley 29733 (ARCO)', async () => {
    servidor(() => ({ status: 200, body: { ...MESA, sala: { ...MESA.sala, pais: 'PE' } } }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    const derechos = screen.getByText('Tus derechos').nextElementSibling!.textContent!
    expect(derechos).toContain('Acceso, rectificación, cancelación y oposición')
    expect(derechos).not.toContain('Conocer, actualizar')
  })
})

describe('QA-P-08: lo que llega solo no empuja lo que se está leyendo', () => {
  it('la calificación por enviar flota sobre la barra, fuera del contenido', async () => {
    servidor(conYo(() => yoBase as unknown as Yo, (url) => (url === '/api/votos' ? 'sin-red' : { status: 404 })))
    localStorage.setItem(
      `hz_cola:${CODIGO}`,
      JSON.stringify([{ id: 'v1', participante_id: yoBase.participante.id, proyecto_id: 'nutriwhat', nombre: 'NUTRIWHAT', ronda: 1, respuestas: TODAS }]),
    )
    conToken()
    montar()
    const titulo = await screen.findByText('1 calificación por enviar')
    expect(titulo.closest('.hzp-flotantes')).toBeTruthy()
    expect(titulo.closest('main')).toBeNull()
  })

  it('el precierre va al final de la pantalla, no arriba', async () => {
    const yo = yoCon((y) => {
      y.completo_ronda = true
      y.mis_votos.push({ ...y.mis_votos[0], proyecto_id: 'nutriwhat' })
      y.progreso_mesa = { inscritos: 7, completos: 7, precierre: true }
      y.resultados = { ...(clonar(tablero) as unknown as Resultados), preliminar: true }
    })
    servidor(conYo(() => yo))
    conToken()
    montar()
    const aviso = (await screen.findByText('Todos votaron en Mesa 1')).closest('.hz-aviso')!
    expect(aviso.closest('section.hzp-seccion')).toBeTruthy()
    const h1 = screen.getByRole('heading', { name: 'Voto registrado' })
    expect(h1.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('al abrir la ronda mientras lee, el aviso cambia de texto en su lugar y la barra ya tenía su botón', async () => {
    let yo = yoCon((y) => {
      y.sala.estado = 'inscripcion'
      y.sala.ronda_actual = 0
      y.mis_votos = []
    })
    servidor(conYo(() => yo))
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    const boton = screen.getByRole('button', { name: 'Calificar proyectos' })
    expect(boton.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('La votación se abre cuando el facilitador lo indique.').classList.contains('hzp-nota-barra')).toBe(true)
    const antes = screen.getByRole('tablist').closest('main')!.querySelectorAll('.hz-aviso').length
    yo = yoCon((y) => {
      y.version = 'v-abierta'
      y.mis_votos = []
    })
    consultarYa()
    expect(await screen.findByText(/La ronda 1 ya está abierta\. Cuando termines de leer, califica los 2 proyectos\./)).toBeTruthy()
    expect(screen.queryByText(/La ronda 1 aún no está abierta/)).toBeNull()
    expect(screen.getByRole('tablist').closest('main')!.querySelectorAll('.hz-aviso').length).toBe(antes)
    expect(screen.getByRole('button', { name: 'Calificar proyectos' }).getAttribute('aria-disabled')).toBeNull()
    expect(screen.getByText('La ronda 1 está abierta.').classList.contains('hzp-nota-barra')).toBe(true)
    // Leía el caso: sigue en el caso (no salta al título ni a otra pantalla).
    expect(screen.getByRole('heading', { name: 'El caso y tu hoja' })).toBeTruthy()
  })
})

describe('QA-P-12: celular girado', () => {
  it('con poca altura el encabezado se compacta y la barra va al final del contenido', () => {
    const css = readFileSync('web/participante/participante.css', 'utf8')
    const bloque = css.slice(css.indexOf('@media (max-height: 30rem) and (orientation: landscape)'))
    expect(bloque).toMatch(/\.hzp-pie \{ position: static;/)
    expect(bloque).toMatch(/\.hz-contenido \{ gap: var\(--hz-sp-3\); \}/)
  })
})

describe('QA-P-13: los textos solo prometen lo que se muestra', () => {
  it('precierre bajo el mínimo: sin «resultado preliminar»', async () => {
    const yo = yoCon((y) => {
      y.completo_ronda = true
      y.mis_votos.push({ ...y.mis_votos[0], proyecto_id: 'nutriwhat' })
      y.progreso_mesa = { inscritos: 2, completos: 2, precierre: true }
      y.resultados = resultadosCon(() => 2)
    })
    servidor(conYo(() => yo))
    conToken()
    const { container } = montar()
    expect(await screen.findByRole('heading', { name: 'Todos votaron en Mesa 1' })).toBeTruthy()
    expect(container.textContent).not.toMatch(/resultado preliminar/i)
    expect(screen.getByText(/El resultado se muestra cuando hay al menos 3 votos/)).toBeTruthy()
  })

  it('ronda 2 cerrada sin R1 que comparar: no dice «Así se movieron»', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.sala.estado = 'r2_cerrada'
          y.sala.ronda_actual = 2
          y.resultados = resultadosCon((r) => (r === 1 ? 0 : 3))
        }),
      ),
    )
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: 'Ronda 2 cerrada' })
    expect(container.textContent).not.toContain('Así se movieron')
    expect(screen.getByText('Este es el resultado de tu mesa.')).toBeTruthy()
  })

  it('ronda 2 cerrada bajo el mínimo: ni comparación ni resultado prometido', async () => {
    servidor(
      conYo(() =>
        yoCon((y) => {
          y.sala.estado = 'r2_cerrada'
          y.sala.ronda_actual = 2
          y.resultados = resultadosCon(() => 2)
        }),
      ),
    )
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: 'Ronda 2 cerrada' })
    expect(container.textContent).not.toMatch(/Así se movieron|Este es el resultado/)
    expect(screen.getByText(/Hacen falta al menos 3 votos/)).toBeTruthy()
  })
})

describe('QA-P-14: sin señal, la barra de la mesa cuenta el voto propio por enviar', () => {
  it('«Voto guardado en este celular» con 1 de 1', async () => {
    servidor(
      conYo(
        () => yoCon((y) => (y.progreso_mesa = { inscritos: 1, completos: 0, precierre: false })),
        (url) => (url === '/api/votos' ? 'sin-red' : { status: 404 }),
      ),
    )
    localStorage.setItem(
      `hz_cola:${CODIGO}`,
      JSON.stringify([{ id: 'v1', participante_id: yoBase.participante.id, proyecto_id: 'nutriwhat', nombre: 'NUTRIWHAT', ronda: 1, respuestas: TODAS }]),
    )
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Voto guardado en este celular' })).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('1 de 1 completaron en Mesa 1')
  })
})

describe('QA-P-16: modo guiado, el lector anuncia la pregunta nueva', () => {
  it('al cambiar de pregunta el foco va a «Pregunta N de 6: …»', async () => {
    let yo = guiado({ proyecto_id: 'nutriwhat', criterio_id: 'regulacion' })
    servidor(conYo(() => yo))
    conToken()
    montar()
    await screen.findByRole('radiogroup', { name: 'Regulación' })
    yo = guiado({ proyecto_id: 'nutriwhat', criterio_id: 'capacidades_organizacionales' }, (y) => (y.version = 'v-2'))
    consultarYa()
    await waitFor(() => expect(progreso()).toBe('Pregunta 4 de 6 · NUTRIWHAT'))
    await waitFor(() => expect(document.activeElement?.textContent).toMatch(/^Pregunta 4 de 6: /))
  })
})

describe('F-1: un 500 o un 429 al enviar no pierde el voto', () => {
  const SIN_INVERSION: Partial<typeof TODAS> = { ...TODAS }
  delete SIN_INVERSION.inversion_requerida

  it('guiado: con 500 el voto pasa a la cola y el aviso dice que aún no llega', async () => {
    servidor(conYo(() => guiado({ proyecto_id: 'nutriwhat', criterio_id: 'inversion_requerida' }), (url) => (url === '/api/votos' ? { status: 500 } : { status: 404 })))
    sessionStorage.setItem(`hz_borrador_nutriwhat_r1:${CODIGO}`, JSON.stringify(SIN_INVERSION))
    conToken()
    montar()
    await screen.findByRole('radiogroup', { name: 'Inversión Requerida para Probar' })
    elegir(0)
    expect(await screen.findByText('1 calificación por enviar')).toBeTruthy()
    expect(screen.getByText(/Tus 6 respuestas de NUTRIWHAT están guardadas en este celular y todavía no llegan/)).toBeTruthy()
    expect(screen.queryByText(/quedaron guardadas/)).toBeNull()
    expect(JSON.parse(localStorage.getItem(`hz_cola:${CODIGO}`) ?? '[]')[0]).toMatchObject({ proyecto_id: 'nutriwhat', respuestas: { ...TODAS, inversion_requerida: 9 } })
  })

  it('automático: con 429 también queda en la cola', async () => {
    servidor(conYo(() => yoBase as unknown as Yo, (url) => (url === '/api/votos' ? { status: 429, body: { error: { codigo: 'DEMASIADAS', mensaje: 'x' } } } : { status: 404 })))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:insumex')
    montar()
    await screen.findByRole('heading', { name: 'Revisa tus respuestas' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
    expect(await screen.findByText('1 calificación por enviar')).toBeTruthy()
  })
})

describe('F-2: la cola de otra persona en el mismo celular no cuenta', () => {
  it('un voto de otro participante no marca el proyecto como «Por enviar»', async () => {
    servidor(conYo(() => yoBase as unknown as Yo))
    localStorage.setItem(
      `hz_cola:${CODIGO}`,
      JSON.stringify([{ id: 'v1', participante_id: 'p_otra', proyecto_id: 'nutriwhat', nombre: 'NUTRIWHAT', ronda: 1, respuestas: TODAS }]),
    )
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })
    expect(screen.queryByText('Por enviar')).toBeNull()
    expect(screen.queryByText('1 calificación por enviar')).toBeNull()
    expect(screen.getByRole('button', { name: 'Calificar NUTRIWHAT' })).toBeTruthy()
  })
})

describe('F-11: una respuesta vieja de /api/yo no pisa a una más nueva', () => {
  it('la consulta que llega tarde se descarta', async () => {
    const pendientes: ((r: Response) => void)[] = []
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((ok) => pendientes.push(ok))))
    const respuesta = (version: string) =>
      new Response(JSON.stringify({ ...yoBase, version }), { status: 200, headers: { 'Content-Type': 'application/json', ETag: version } })
    const { result } = renderHook(() => usarYo('tok-1'))
    await waitFor(() => expect(pendientes).toHaveLength(1))
    act(() => void result.current.refrescar())
    await waitFor(() => expect(pendientes).toHaveLength(2))
    await act(async () => pendientes[1](respuesta('v-nueva')))
    await waitFor(() => expect(result.current.yo?.version).toBe('v-nueva'))
    await act(async () => pendientes[0](respuesta('v-vieja')))
    await new Promise((r) => setTimeout(r, 50))
    expect(result.current.yo?.version).toBe('v-nueva')
  })
})

describe('D2: el consolidado se renueva de 3 en 3, no con cada voto', () => {
  it('la vista tras votar no promete resultados en vivo', async () => {
    const yo = yoCon((y) => {
      y.config.vista_participante = 'en_vivo'
      y.completo_ronda = true
      y.mis_votos.push({ ...y.mis_votos[0], proyecto_id: 'nutriwhat' })
      y.resultados = { ...(clonar(tablero) as unknown as Resultados), votos_por_actualizacion: 4 }
    })
    servidor(conYo(() => yo))
    conToken()
    const { container } = montar()
    expect(await screen.findByRole('heading', { name: 'Resultado parcial de tu mesa' })).toBeTruthy()
    // Manda el número del servidor (votos_por_actualizacion).
    expect(screen.getByText(/se renueva cada vez que llegan 4 votos nuevos/)).toBeTruthy()
    expect(container.textContent).not.toMatch(/en vivo/i)
  })
})

describe('QA-P-11 y QA-P-19: sistema de diseño', () => {
  const css = readFileSync('web/shared/ui/componentes.css', 'utf8')
  it('casilla, pestañas y acción de un aviso con área táctil de 48 px', () => {
    expect(readFileSync('web/shared/ui/tokens.css', 'utf8')).toMatch(/--hz-tactil: 3rem;/)
    expect(css).toMatch(/\.hz-casilla__toque \{[^}]*width: var\(--hz-tactil\); height: var\(--hz-tactil\);/)
    expect(css).toMatch(/\.hz-pestanas__tab \{[^}]*min-height: var\(--hz-tactil\);/)
    expect(css).toMatch(/\.hz-aviso \.hz-boton--fantasma \{ min-height: var\(--hz-tactil\);/)
    expect(css).not.toMatch(/min-height: 4[04]px/)
  })
  it('la barra de progreso no hereda el borde del tablero', () => {
    expect(css).toMatch(/\.hz \.hz-progreso \{[^}]*border: 0;/)
  })
})

describe('ancho de página estándar: encabezado, contenido y pie con el mismo contenedor', () => {
  it('la página del celular usa .hz-pagina en todas sus franjas', async () => {
    servidor(conYo(() => yoCon((y) => (y.sala.estado = 'inscripcion'))))
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: 'El caso y tu hoja' })
    const raiz = container.querySelector('.hz')!
    expect(raiz.classList.contains('hz-vista')).toBe(true)
    expect(raiz.classList.contains('hz-pagina')).toBe(false)
    for (const sel of ['.hz-producto__fila', '.hzp-contexto', 'main', '.hz-barra-accion__interior'])
      expect(container.querySelector(sel)!.classList.contains('hz-pagina'), sel).toBe(true)
  })
})
