// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import yoBase from '../../../mocks/GET_api_yo.json'
import tablero from '../../../mocks/GET_api_tablero.json'
import PaginaMesa from '../PaginaMesa'
import { AVANCE_MS } from '../pantallas/Votacion'
import { PIDE_ACCESO } from '../PaginaMesa'
import { TEXTO_CORREO_INSCRITO } from '../pantallas/Inscripcion'
import type { PreguntaGuiada, Yo } from '../api'

const CODIGO = 'HZ7K2-1'
const MESA = {
  sala: { id: 's_demo', nombre: 'Taller Horizontes demo', estado: 'inscripcion' },
  mesa: { id: 'm1', nombre: 'Mesa 1' },
  inscripcion_abierta: true,
  consentimiento: { version: 'estratek-v1', texto_autorizacion: 'Autorizo a Estratek a tratar mis datos.', politica_url: 'https://estratek.com.co/politica' },
}

const clonar = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const yoCon = (cambios: (y: Yo) => void): Yo => {
  const y = clonar(yoBase) as unknown as Yo
  cambios(y)
  return y
}

type Manejador = (url: string, init: RequestInit) => { status: number; body?: unknown; headers?: Record<string, string> }
let llamadas: { url: string; init: RequestInit }[] = []

function servidor(manejar: Manejador) {
  llamadas = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      llamadas.push({ url, init })
      const r = manejar(url, init)
      return new Response(r.status === 304 || r.body === undefined ? null : JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': 'application/json', ...(r.headers ?? {}) },
      })
    }),
  )
}

const montar = (ruta = `/m/${CODIGO}`) =>
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/m/:codigo/*" element={<PaginaMesa />} />
      </Routes>
    </MemoryRouter>,
  )

const conToken = () => localStorage.setItem(`hz_token:${CODIGO}`, 'tok-1')

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('antes de inscribirse', () => {
  it('mesa inexistente muestra el mensaje con el código', async () => {
    servidor(() => ({ status: 404, body: { error: { codigo: 'MESA_NO_EXISTE', mensaje: 'No existe' } } }))
    montar('/m/NOEXISTE')
    expect(await screen.findByRole('heading', { name: 'No encontramos esta mesa' })).toBeTruthy()
    expect(screen.getByText(/El código NOEXISTE no corresponde/)).toBeTruthy()
  })

  it('inscripción cerrada antes de empezar y sala terminada', async () => {
    servidor(() => ({ status: 200, body: { ...MESA, inscripcion_abierta: false, sala: { ...MESA.sala, estado: 'preparada' } } }))
    montar()
    expect(await screen.findByRole('heading', { name: 'Aún no abrimos la inscripción' })).toBeTruthy()
    cleanup()
    servidor(() => ({ status: 200, body: { ...MESA, inscripcion_abierta: false, sala: { ...MESA.sala, estado: 'cerrada' } } }))
    montar()
    expect(await screen.findByRole('heading', { name: 'El taller ya terminó' })).toBeTruthy()
  })

  it('con la inscripción cerrada pide al facilitador «Dar acceso de nuevo» en vez de recuperar por correo (D1)', async () => {
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: { ...MESA, inscripcion_abierta: false, sala: { ...MESA.sala, estado: 'r2_cerrada' } } } : { status: 404 }))
    montar()
    expect(await screen.findByRole('heading', { name: 'El taller ya terminó' })).toBeTruthy()
    expect(screen.getByText('¿Ya te inscribiste y perdiste la sesión?')).toBeTruthy()
    expect(screen.getByText(PIDE_ACCESO)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /recuperar/i })).toBeNull()
    expect(screen.queryByLabelText('Tu correo')).toBeNull()
    // Con la sala cerrada no hay acceso nuevo: no se ofrece.
    cleanup()
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: { ...MESA, inscripcion_abierta: false, sala: { ...MESA.sala, estado: 'cerrada' } } } : { status: 404 }))
    montar()
    await screen.findByRole('heading', { name: 'El taller ya terminó' })
    expect(screen.queryByText('¿Ya te inscribiste y perdiste la sesión?')).toBeNull()
  })

  it('aviso de datos con la norma del país de la sala y el texto de autorización del servidor (acta P4)', async () => {
    const casos = [
      { pais: undefined, norma: 'Ley 1581 de 2012', autoridad: /Superintendencia de Industria y Comercio/ },
      { pais: 'PE', norma: 'Ley 29733', autoridad: /Autoridad Nacional de Protección de Datos Personales/ },
      { pais: 'GT', norma: 'Política de Tratamiento de Datos Personales de Estratek', autoridad: null },
    ]
    for (const c of casos) {
      const texto = `Autorizo a Estratek S.A.S. (${c.pais ?? 'CO'}).`
      const mesa = { ...MESA, sala: { ...MESA.sala, pais: c.pais }, consentimiento: { ...MESA.consentimiento, version: 'hz-1.1', texto_autorizacion: texto } }
      servidor(() => ({ status: 200, body: mesa }))
      montar()
      await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
      const norma = screen.getByText('Qué norma aplica').nextElementSibling!.textContent!
      expect(norma).toContain(c.norma)
      const derechos = screen.getByText('Tus derechos').nextElementSibling!.textContent!
      if (c.autoridad) expect(derechos).toMatch(c.autoridad)
      else expect(derechos).not.toMatch(/Superintendencia|Autoridad Nacional/)
      expect(screen.getByText(texto, { exact: false })).toBeTruthy()
      cleanup()
    }
  })

  it('inscripción: consentimiento obligatorio, validación y bienvenida con el perfil', async () => {
    let cuerpo: Record<string, unknown> | null = null
    servidor((url, init) => {
      if (url.startsWith('/api/mesas/')) return { status: 200, body: MESA }
      if (url === '/api/inscripcion') {
        cuerpo = JSON.parse(String(init.body))
        return { status: 201, body: { token: 'tok-nuevo', participante: yoBase.participante } }
      }
      if (url === '/api/yo') return { status: 200, body: yoCon((y) => (y.sala.estado = 'inscripcion')), headers: { ETag: 'v1' } }
      return { status: 404 }
    })
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    const boton = screen.getByRole('button', { name: 'Inscribirme' })
    expect(boton.getAttribute('aria-disabled')).toBe('true')
    expect(screen.getByText('Para inscribirte necesitamos tu autorización de tratamiento de datos.')).toBeTruthy()
    const enlace = screen.getByRole('link', { name: /Política de Tratamiento de Datos Personales de Estratek/ })
    expect(enlace.getAttribute('href')).toBe('https://estratek.com.co/politica')
    expect(enlace.getAttribute('target')).toBe('_blank')

    const casilla = screen.getByRole('checkbox') as HTMLInputElement
    expect(casilla.checked).toBe(false)
    fireEvent.click(casilla)
    expect(boton.getAttribute('aria-disabled')).toBeNull()

    fireEvent.click(boton)
    expect(await screen.findByText('Escribe tu nombre.')).toBeTruthy()
    expect(screen.getByText(/Escribe un correo válido/)).toBeTruthy()
    expect(llamadas.some((l) => l.url === '/api/inscripcion')).toBe(false)

    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Pérez' } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: 'Ana@Empresa.com' } })
    fireEvent.click(boton)

    expect(await screen.findByRole('heading', { name: 'Tu perfil es Conocimiento del cliente' })).toBeTruthy()
    expect(cuerpo).toEqual({ codigoMesa: CODIGO, nombre: 'Ana Pérez', correo: 'ana@empresa.com', consentimiento: { aceptado: true, version: 'estratek-v1' } })
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBe('tok-nuevo')

    fireEvent.click(screen.getByRole('button', { name: 'Leer el caso' }))
    expect(await screen.findByRole('heading', { name: 'El caso y tu hoja' })).toBeTruthy()
    expect(screen.getByText(/La ronda 1 aún no está abierta/)).toBeTruthy()
    expect(screen.getAllByText('Se califica')).toHaveLength(2)
    fireEvent.click(screen.getByRole('tab', { name: 'Tu hoja' }))
    expect(screen.getByRole('heading', { name: 'Tu hoja como Conocimiento del cliente' })).toBeTruthy()
  })

  it('correo repetido (409 CORREO_YA_INSCRITO): muestra el mensaje y no entra (D1)', async () => {
    servidor((url) => {
      if (url.startsWith('/api/mesas/')) return { status: 200, body: MESA }
      if (url === '/api/inscripcion') return { status: 409, body: { error: { codigo: 'CORREO_YA_INSCRITO', mensaje: 'Ese correo ya está inscrito. Pídele al facilitador que te dé acceso de nuevo.' } } }
      return { status: 200, body: yoBase, headers: { ETag: 'v1' } }
    })
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: 'ana@empresa.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }))
    expect(await screen.findByText('Ese correo ya está inscrito. Pídele al facilitador que te dé acceso de nuevo.')).toBeTruthy()
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBeNull()
    expect(llamadas.some((l) => l.url === '/api/yo')).toBe(false)
    // Sin mensaje del servidor, el del celular.
    cleanup()
    servidor((url) => (url.startsWith('/api/mesas/') ? { status: 200, body: MESA } : { status: 409, body: { error: { codigo: 'CORREO_YA_INSCRITO' } } }))
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: 'ana@empresa.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }))
    expect(await screen.findByText(TEXTO_CORREO_INSCRITO)).toBeTruthy()
  })
})

const progreso = () => screen.getAllByRole('progressbar')[0].getAttribute('aria-valuetext')
/** Elige la opción `i` (0 = 9 puntos) de la única pregunta en pantalla. */
const elegir = (i = 0) => fireEvent.click(within(screen.getByRole('radiogroup')).getAllByRole('radio')[i])
/** Responde la pregunta y espera a que la pantalla pase sola a la siguiente (o al resumen). */
async function responder(i = 0) {
  const antes = progreso()
  elegir(i)
  await waitFor(() => expect(screen.queryByRole('radiogroup') ? progreso() : 'resumen').not.toBe(antes))
}
const TODAS = { alistamiento_tecnico: 3, conocimiento_cliente: 3, regulacion: 3, capacidades_organizacionales: 3, alineacion_core: 3, inversion_requerida: 3 }

describe('votación (modo automático, una pregunta por pantalla)', () => {
  it('pasa sola de pregunta, muestra el resumen, guarda con PUT y muestra voto registrado', async () => {
    let yo = yoCon((y) => {
      y.mis_votos = []
      y.pendientes = ['insumex', 'nutriwhat']
    })
    const puts: Record<string, unknown>[] = []
    servidor((url, init) => {
      if (url === '/api/yo') return { status: 200, body: yo }
      if (url === '/api/votos') {
        const b = JSON.parse(String(init.body))
        puts.push(b)
        const voto = { ...b, actualizado_at: '2026-10-20T15:00:00-05:00' }
        yo = { ...yo, mis_votos: [...yo.mis_votos, voto], completo_ronda: yo.mis_votos.length === 1, progreso_mesa: { inscritos: 7, completos: 6, precierre: false } }
        return { status: 200, body: { voto, completo_ronda: yo.completo_ronda, progreso_mesa: { inscritos: 7, completos: 6, precierre: false } } }
      }
      return { status: 404 }
    })
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Ronda 1: califica los 2 proyectos' })).toBeTruthy()
    // Acta A7: la ronda 1 es individual y en silencio, con su insignia R1.
    expect(screen.getByText('Individual y en silencio').previousElementSibling?.className).toContain('hz-insignia--r1')
    expect(screen.getAllByText('Pendiente')).toHaveLength(2)
    expect((llamadas[0].init.headers as Record<string, string>)['X-Participante-Token']).toBe('tok-1')

    for (const nombre of ['INSUMEX', 'NUTRIWHAT']) {
      const calificar = await screen.findByRole('button', { name: `Calificar ${nombre}` })
      // Una sola acción principal por vista: el primer proyecto pendiente.
      expect([...document.querySelectorAll('.hz-boton--primario')]).toEqual([calificar])
      fireEvent.click(calificar)
      await screen.findByRole('heading', { name: nombre, level: 1 })
      for (let n = 1; n <= 6; n++) {
        // Una sola pregunta, con su encabezado, su grupo de radios y la barra «Pregunta n de 6 · proyecto».
        expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
        expect(progreso()).toBe(`Pregunta ${n} de 6 · ${nombre}`)
        expect(screen.getByRole('heading', { level: 2, name: new RegExp(`^Pregunta ${n} de 6: `) })).toBeTruthy()
        await responder(0)
        // El foco pasa al encabezado de la pregunta nueva (lector de pantalla y teclado).
        if (n < 6) expect(document.activeElement?.textContent).toMatch(new RegExp(`^Pregunta ${n + 1} de 6: `))
      }
      expect(await screen.findByRole('heading', { name: 'Revisa tus respuestas' })).toBeTruthy()
      expect(screen.getAllByRole('button', { name: /^Cambiar / })).toHaveLength(6)
      expect(puts.filter((x) => x.proyecto_id === nombre.toLowerCase())).toHaveLength(0)
      fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
      expect(await screen.findByText(`Calificación de ${nombre} guardada.`)).toBeTruthy()
    }

    expect(puts).toHaveLength(2)
    expect(puts[0]).toMatchObject({ proyecto_id: 'insumex', ronda: 1 })
    expect(Object.values(puts[0].respuestas as object)).toEqual([9, 9, 9, 9, 9, 9])
    expect(await screen.findByRole('heading', { name: 'Voto registrado' })).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('6 de 7 completaron en Mesa 1')
    // 12 respuestas con su pausa de avance y 2 guardados: con la suite completa en paralelo pasa de 5 s.
  }, 20_000)

  it('Anterior y Siguiente, flechas sin saltar de pregunta, corrección desde el resumen y faltantes', async () => {
    const puts: Record<string, unknown>[] = []
    servidor((url, init) => {
      if (url === '/api/yo') return { status: 200, body: yoBase }
      if (url === '/api/votos') {
        const b = JSON.parse(String(init.body))
        puts.push(b)
        return { status: 200, body: { voto: b, completo_ronda: true, progreso_mesa: { inscritos: 7, completos: 3, precierre: false } } }
      }
      return { status: 404 }
    })
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:nutriwhat')
    montar()
    await screen.findByRole('heading', { name: 'NUTRIWHAT', level: 1 })
    expect(progreso()).toBe('Pregunta 1 de 6 · NUTRIWHAT')
    expect(screen.getByRole('button', { name: 'Anterior' }).getAttribute('aria-disabled')).toBe('true')
    // Con las flechas del teclado la persona recorre las opciones: elegir así no pasa de pregunta.
    const grupo = screen.getByRole('radiogroup')
    fireEvent.keyDown(grupo, { key: 'ArrowDown' })
    elegir(1)
    fireEvent.keyUp(grupo, { key: 'ArrowDown' })
    await new Promise((r) => setTimeout(r, AVANCE_MS + 150))
    expect(progreso()).toBe('Pregunta 1 de 6 · NUTRIWHAT')
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true)
    // Siguiente y Anterior a mano, sin responder la 2: lo marcado sigue.
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(progreso()).toBe('Pregunta 2 de 6 · NUTRIWHAT')
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }))
    expect(progreso()).toBe('Pregunta 1 de 6 · NUTRIWHAT')
    expect((screen.getAllByRole('radio')[1] as HTMLInputElement).checked).toBe(true)
    for (let n = 1; n < 6; n++) fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }))
    expect(progreso()).toBe('Pregunta 6 de 6 · NUTRIWHAT')
    fireEvent.click(screen.getByRole('button', { name: 'Ver resumen' }))
    // Resumen con 5 sin responder: Guardar no envía y lo dice.
    await screen.findByRole('heading', { name: 'Revisa tus respuestas' })
    expect(screen.getAllByText('Sin responder')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
    expect(await screen.findByText('Te faltan 5 preguntas. Respóndelas para guardar.')).toBeTruthy()
    expect(puts).toHaveLength(0)
    // Responder desde el resumen: pasa sola por las que faltan y vuelve al resumen.
    fireEvent.click(screen.getByRole('button', { name: 'Responder Nivel de Conocimiento del Cliente/Mercado' }))
    expect(progreso()).toBe('Pregunta 2 de 6 · NUTRIWHAT')
    for (let n = 2; n <= 6; n++) await responder(4)
    await screen.findByRole('heading', { name: 'Revisa tus respuestas' })
    // Corregir una ya respondida vuelve directo al resumen.
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar Regulación' }))
    expect(progreso()).toBe('Pregunta 3 de 6 · NUTRIWHAT')
    await responder(2)
    await screen.findByRole('heading', { name: 'Revisa tus respuestas' })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].respuestas).toEqual({ alistamiento_tecnico: 7, conocimiento_cliente: 1, regulacion: 5, capacidades_organizacionales: 1, alineacion_core: 1, inversion_requerida: 1 })
  }, 15_000)

  it('conserva lo marcado tras recargar y avisa si la ronda se cerró', async () => {
    servidor((url) => {
      if (url === '/api/yo') return { status: 200, body: yoBase }
      if (url === '/api/votos') return { status: 409, body: { error: { codigo: 'RONDA_CERRADA', mensaje: 'Cerrada' } } }
      return { status: 404 }
    })
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:nutriwhat')
    sessionStorage.setItem(
      `hz_borrador_nutriwhat_r1:${CODIGO}`,
      JSON.stringify({ alistamiento_tecnico: 3, conocimiento_cliente: 3, regulacion: 3, capacidades_organizacionales: 3, alineacion_core: 3, inversion_requerida: 3 }),
    )
    montar()
    await screen.findByRole('heading', { name: 'NUTRIWHAT' })
    // Con las 6 marcadas abre el resumen: cada una con su valor y su botón Cambiar.
    expect(screen.getByRole('heading', { name: 'Revisa tus respuestas' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: /^Cambiar / })).toHaveLength(6)
    expect(screen.queryByText('Sin responder')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
    expect(await screen.findByText('La ronda 1 ya se cerró. Tu última calificación guardada es la que cuenta.')).toBeTruthy()
  })

  it('sin red al guardar deja el voto en la cola y lo envía solo al volver la señal', async () => {
    let conSenal = false
    servidor((url, init) => {
      if (url === '/api/yo') return { status: 200, body: yoBase }
      if (url === '/api/votos') {
        const v = JSON.parse(String(init.body))
        return { status: 200, body: { voto: v, completo_ronda: false, progreso_mesa: { inscritos: 7, completos: 3, precierre: false } } }
      }
      return { status: 404 }
    })
    const f = globalThis.fetch as ReturnType<typeof vi.fn>
    const original = f.getMockImplementation()!
    f.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/votos' && !conSenal) throw new TypeError('Failed to fetch')
      return original(url, init)
    })
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:insumex')
    montar()
    await screen.findByRole('heading', { name: 'INSUMEX' })
    // INSUMEX ya tenía voto: abre el resumen con las 6 respuestas.
    expect(screen.getAllByRole('button', { name: /^Cambiar / })).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
    expect(await screen.findByText('1 calificación por enviar')).toBeTruthy()
    expect(screen.getByText('Por enviar')).toBeTruthy()
    const cola = JSON.parse(localStorage.getItem(`hz_cola:${CODIGO}`) ?? '[]')
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({ proyecto_id: 'insumex', ronda: 1 })
    conSenal = true
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByText('Enviamos tu calificación de INSUMEX.')).toBeTruthy()
    expect(localStorage.getItem(`hz_cola:${CODIGO}`)).toBeNull()
    expect(screen.queryByText('1 calificación por enviar')).toBeNull()
  })

  it('si la ronda se cerró antes de enviar la cola, avisa y conserva lo marcado', async () => {
    servidor((url) => {
      if (url === '/api/yo') return { status: 200, body: yoBase }
      if (url === '/api/votos') return { status: 409, body: { error: { codigo: 'RONDA_CERRADA', mensaje: 'La ronda 1 ya se cerró.' } } }
      return { status: 404 }
    })
    const respuestas = { alistamiento_tecnico: 3, conocimiento_cliente: 3, regulacion: 3, capacidades_organizacionales: 3, alineacion_core: 3, inversion_requerida: 3 }
    localStorage.setItem(`hz_cola:${CODIGO}`, JSON.stringify([{ id: 'v1', participante_id: yoBase.participante.id, proyecto_id: 'nutriwhat', nombre: 'NUTRIWHAT', ronda: 1, respuestas }]))
    conToken()
    montar()
    expect(await screen.findByText(/La ronda 1 se cerró antes de que llegara tu calificación de NUTRIWHAT/)).toBeTruthy()
    expect(localStorage.getItem(`hz_cola:${CODIGO}`)).toBeNull()
    expect(JSON.parse(sessionStorage.getItem(`hz_borrador_nutriwhat_r1:${CODIGO}`) ?? 'null')).toEqual(respuestas)
  })

  it('la ronda se cierra mientras califica: mensaje claro y lo marcado se conserva', async () => {
    let yo: Yo = yoBase as unknown as Yo
    servidor((url) => (url === '/api/yo' ? { status: 200, body: yo, headers: { ETag: yo.version } } : { status: 404 }))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:nutriwhat')
    montar()
    await screen.findByRole('heading', { name: 'NUTRIWHAT' })
    fireEvent.click(within(screen.getByRole('radiogroup', { name: /Alistamiento/ })).getAllByRole('radio')[2])
    yo = yoCon((y) => {
      y.version = 'v-cerrada'
      y.sala.estado = 'r1_cerrada'
      y.resultados = null
    })
    await waitFor(() => expect(screen.getByText(/La ronda 1 se cerró mientras calificabas NUTRIWHAT/)).toBeTruthy(), { timeout: 6000 })
    expect(screen.getByText(/Esos cambios no alcanzaron a guardarse/)).toBeTruthy()
    expect(JSON.parse(sessionStorage.getItem(`hz_borrador_nutriwhat_r1:${CODIGO}`) ?? '{}')).toHaveProperty('alistamiento_tecnico')
  })
})

describe('votación en modo guiado', () => {
  const guiado = (pregunta: PreguntaGuiada | null, cambios: (y: Yo) => void = () => {}) =>
    yoCon((y) => {
      y.config.modo_preguntas = 'guiado'
      y.sala.pregunta_guiada = pregunta
      cambios(y)
    })
  const SIN_INVERSION = { ...TODAS } as Partial<typeof TODAS>
  delete SIN_INVERSION.inversion_requerida

  it('sin pregunta elegida, espera al facilitador', async () => {
    servidor(() => ({ status: 200, body: guiado(null) }))
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Espera la pregunta del facilitador' })).toBeTruthy()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByRole('button', { name: /^Calificar / })).toBeNull()
  })

  it('muestra solo la pregunta del facilitador, la guarda en el celular y espera la siguiente', async () => {
    let yo = guiado({ proyecto_id: 'nutriwhat', criterio_id: 'regulacion' })
    servidor((url) => (url === '/api/yo' ? { status: 200, body: yo, headers: { ETag: yo.version } } : { status: 500 }))
    conToken()
    montar()
    await screen.findByRole('heading', { name: 'NUTRIWHAT', level: 1 })
    expect(screen.getAllByRole('radiogroup')).toHaveLength(1)
    expect(screen.getByRole('radiogroup', { name: 'Regulación' })).toBeTruthy()
    expect(progreso()).toBe('Pregunta 3 de 6 · NUTRIWHAT')
    // En guiado avanza el facilitador: sin Anterior ni Siguiente.
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Anterior' })).toBeNull()
    elegir(1)
    expect(await screen.findByText('Espera la siguiente pregunta del facilitador')).toBeTruthy()
    expect(screen.getByText(/Tu respuesta quedó en este celular.*\(llevas 1\)/)).toBeTruthy()
    expect(JSON.parse(sessionStorage.getItem(`hz_borrador_nutriwhat_r1:${CODIGO}`) ?? '{}')).toEqual({ regulacion: 7 })
    expect(llamadas.some((l) => l.url === '/api/votos')).toBe(false)
    // El facilitador pasa a la siguiente: aparece sola, sin respuesta marcada, y la anterior sigue guardada.
    yo = guiado({ proyecto_id: 'nutriwhat', criterio_id: 'capacidades_organizacionales' }, (y) => (y.version = 'v-2'))
    await waitFor(() => expect(progreso()).toBe('Pregunta 4 de 6 · NUTRIWHAT'), { timeout: 6000 })
    expect(screen.queryAllByRole('radio', { checked: true })).toHaveLength(0)
    expect(screen.queryByText('Espera la siguiente pregunta del facilitador')).toBeNull()
    elegir(0)
    expect(JSON.parse(sessionStorage.getItem(`hz_borrador_nutriwhat_r1:${CODIGO}`) ?? '{}')).toEqual({ regulacion: 7, capacidades_organizacionales: 9 })
  }, 10_000)

  it('envía el voto al completar las 6 del proyecto y reenvía una corrección', async () => {
    const yo = guiado({ proyecto_id: 'nutriwhat', criterio_id: 'inversion_requerida' })
    const puts: Record<string, unknown>[] = []
    servidor((url, init) => {
      if (url === '/api/yo') return { status: 200, body: yo }
      if (url === '/api/votos') {
        const b = JSON.parse(String(init.body))
        puts.push(b)
        return { status: 200, body: { voto: b, completo_ronda: true, progreso_mesa: { inscritos: 7, completos: 4, precierre: false } } }
      }
      return { status: 404 }
    })
    sessionStorage.setItem(`hz_borrador_nutriwhat_r1:${CODIGO}`, JSON.stringify(SIN_INVERSION))
    conToken()
    montar()
    await screen.findByRole('radiogroup', { name: 'Inversión Requerida para Probar' })
    elegir(0)
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ proyecto_id: 'nutriwhat', ronda: 1, respuestas: { ...TODAS, inversion_requerida: 9 } })
    expect(await screen.findByText('Tus 6 respuestas de NUTRIWHAT quedaron guardadas. Puedes cambiar esta mientras la ronda siga abierta.')).toBeTruthy()
    expect(screen.getByText('Calificación de NUTRIWHAT guardada.')).toBeTruthy()
    expect(sessionStorage.getItem(`hz_borrador_nutriwhat_r1:${CODIGO}`)).toBeNull()
    // Corrección con la ronda abierta: el voto completo sale otra vez con el valor nuevo.
    elegir(4)
    await waitFor(() => expect(puts).toHaveLength(2))
    expect(puts[1]).toMatchObject({ respuestas: { ...TODAS, inversion_requerida: 1 } })
  })

  it('sin señal al completar, el voto pasa a la cola sin salir de la pregunta', async () => {
    servidor((url) => (url === '/api/yo' ? { status: 200, body: guiado({ proyecto_id: 'nutriwhat', criterio_id: 'inversion_requerida' }) } : { status: 404 }))
    const f = globalThis.fetch as ReturnType<typeof vi.fn>
    const original = f.getMockImplementation()!
    f.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === '/api/votos') throw new TypeError('Failed to fetch')
      return original(url, init)
    })
    sessionStorage.setItem(`hz_borrador_nutriwhat_r1:${CODIGO}`, JSON.stringify(SIN_INVERSION))
    conToken()
    montar()
    await screen.findByRole('radiogroup', { name: 'Inversión Requerida para Probar' })
    elegir(2)
    expect(await screen.findByText('1 calificación por enviar')).toBeTruthy()
    expect(screen.getByRole('radiogroup', { name: 'Inversión Requerida para Probar' })).toBeTruthy()
    expect(JSON.parse(localStorage.getItem(`hz_cola:${CODIGO}`) ?? '[]')[0]).toMatchObject({ proyecto_id: 'nutriwhat', respuestas: { ...TODAS, inversion_requerida: 5 } })
  })
})

describe('estados de la sala', () => {
  it('precierre muestra el aviso y el resultado preliminar', async () => {
    const yo = yoCon((y) => {
      y.completo_ronda = true
      y.mis_votos.push({ ...y.mis_votos[0], proyecto_id: 'nutriwhat' })
      y.progreso_mesa = { inscritos: 7, completos: 7, precierre: true }
      y.resultados = { ...(clonar(tablero) as unknown as Yo['resultados'] & object), preliminar: true }
    })
    servidor(() => ({ status: 200, body: yo }))
    conToken()
    montar()
    expect(await screen.findByText('Todos votaron en Mesa 1')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Voto registrado' })).toBeTruthy()
    expect(screen.getAllByText('Preliminar').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Resultado preliminar de tu mesa' })).toBeTruthy()
  })

  it('ronda 2 cerrada muestra la comparación R1 y R2', async () => {
    const yo = yoCon((y) => {
      y.sala.estado = 'r2_cerrada'
      y.sala.ronda_actual = 2
      y.resultados = clonar(tablero) as unknown as Yo['resultados']
    })
    servidor(() => ({ status: 200, body: yo }))
    conToken()
    montar()
    expect(await screen.findByRole('heading', { name: 'Ronda 2 cerrada' })).toBeTruthy()
    expect(screen.getByText(/Así se movieron INSUMEX y NUTRIWHAT de la ronda 1 a la ronda 2 en tu mesa/)).toBeTruthy()
    expect(screen.getAllByRole('columnheader', { name: 'R2' }).length).toBeGreaterThan(0)
    expect(screen.queryByText('Preliminar')).toBeNull()
    // P3: tu calificación de INSUMEX en R1 (mis_votos) junto al promedio; en NUTRIWHAT no votaste.
    const [insumex, nutriwhat] = screen.getAllByRole('table')
    expect(within(insumex).getByRole('rowheader', { name: /^Regulación/ }).closest('tr')!.textContent).toContain('Tu calificación: Tú 7')
    expect(within(nutriwhat).queryByText(/Tu calificación/)).toBeNull()
  })

  it('en ronda 2 con revelar_hojas muestra las 6 hojas con la propia primero', async () => {
    const yo = yoCon((y) => {
      y.config.revelar_hojas = true
      y.contenido.hojas = (['cliente', 'regulacion', 'financiero'] as const).map((perfil_id) => ({
        proyecto_id: 'insumex',
        proyecto: 'INSUMEX',
        perfil_id,
        texto: `Hoja ${perfil_id}`,
      }))
      y.participante.perfil = { id: 'regulacion', nombre: 'Regulación' }
    })
    servidor(() => ({ status: 200, body: yo }))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'lectura')
    montar()
    fireEvent.click(await screen.findByRole('tab', { name: 'Hojas' }))
    expect(screen.getByText('Ya puedes ver la información de los 6 perfiles.')).toBeTruthy()
    const titulos = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(titulos[0]).toContain('Regulación')
    expect(titulos[0]).toContain('Tu hoja')
  })

  it('token vencido o reemplazado: pide al facilitador «Dar acceso de nuevo», sin formulario de correo (D1)', async () => {
    servidor((url) => (url === '/api/yo' ? { status: 401, body: { error: { codigo: 'TOKEN_INVALIDO', mensaje: 'x' } } } : { status: 200, body: MESA }))
    conToken()
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:nutriwhat')
    montar()
    expect(await screen.findByRole('heading', { name: 'Tu sesión ya no está activa' })).toBeTruthy()
    expect(screen.getByText(/«Dar acceso de nuevo»/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Recuperar/ })).toBeNull()
    expect(screen.queryByLabelText('Tu correo')).toBeNull()
    expect(llamadas.some((l) => l.url === '/api/inscripcion')).toBe(false)
  })

  it('ningún texto de las pantallas lleva rayas', async () => {
    servidor(() => ({ status: 200, body: yoBase }))
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: /Ronda 1/ })
    expect(container.textContent).not.toContain('—')
  })
})
