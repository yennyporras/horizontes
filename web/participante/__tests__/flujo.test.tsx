// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import yoBase from '../../../mocks/GET_api_yo.json'
import tablero from '../../../mocks/GET_api_tablero.json'
import PaginaMesa from '../PaginaMesa'
import type { Yo } from '../api'

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

  it('con la inscripción cerrada permite recuperar la sesión por correo', async () => {
    servidor((url) => {
      if (url.startsWith('/api/mesas/')) return { status: 200, body: { ...MESA, inscripcion_abierta: false, sala: { ...MESA.sala, estado: 'r2_cerrada' } } }
      if (url === '/api/inscripcion') return { status: 409, body: { error: { codigo: 'INSCRIPCION_CERRADA', mensaje: 'Cerrada' } } }
      return { status: 404 }
    })
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'Ya me inscribí: recuperar mi sesión' }))
    expect(await screen.findByRole('heading', { name: 'Recupera tu sesión' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: 'otro@empresa.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar mi sesión' }))
    expect(await screen.findByText('No encontramos ese correo en esta sala. Escríbelo igual que cuando te inscribiste.')).toBeTruthy()
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

  it('correo repetido (409) recupera la sesión sin error', async () => {
    servidor((url) => {
      if (url.startsWith('/api/mesas/')) return { status: 200, body: MESA }
      if (url === '/api/inscripcion')
        return { status: 409, body: { error: { codigo: 'CORREO_YA_INSCRITO', mensaje: 'Ya inscrito' }, token: 'tok-viejo', participante: yoBase.participante } }
      return { status: 200, body: yoBase, headers: { ETag: 'v1' } }
    })
    montar()
    await screen.findByRole('heading', { name: 'Te damos la bienvenida al taller Horizontes' })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } })
    fireEvent.change(screen.getByLabelText('Tu correo'), { target: { value: 'ana@empresa.com' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Inscribirme' }))
    expect(await screen.findByText('Este correo ya estaba en la mesa. Retomas donde ibas.')).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /Tu perfil es/ })).toBeNull()
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBe('tok-viejo')
  })
})

describe('votación', () => {
  it('pide los 6 criterios, guarda con PUT y muestra voto registrado', async () => {
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
      fireEvent.click(await screen.findByRole('button', { name: `Calificar ${nombre}` }))
      await screen.findByRole('heading', { name: nombre })
      fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
      expect(await screen.findByText('Te faltan 6 criterios. Elige una opción en cada uno.')).toBeTruthy()
      for (const grupo of screen.getAllByRole('radiogroup')) fireEvent.click(within(grupo).getAllByRole('radio')[0])
      fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
      expect(await screen.findByText(`Calificación de ${nombre} guardada.`)).toBeTruthy()
    }

    expect(puts).toHaveLength(2)
    expect(puts[0]).toMatchObject({ proyecto_id: 'insumex', ronda: 1 })
    expect(Object.values(puts[0].respuestas as object)).toEqual([9, 9, 9, 9, 9, 9])
    expect(await screen.findByRole('heading', { name: 'Voto registrado' })).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('6 de 7 completaron en Mesa 1')
    // 12 clics de rúbrica y 2 guardados: con la suite completa en paralelo pasa de 5 s.
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
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(6)
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
    // INSUMEX ya tenía voto: las 6 respuestas vienen marcadas.
    expect(screen.getAllByRole('radio', { checked: true })).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Guardar calificación' }))
    expect(await screen.findByText('1 calificación por enviar')).toBeTruthy()
    expect(screen.getByText('Por enviar')).toBeTruthy()
    const cola = JSON.parse(localStorage.getItem(`hz_cola:${CODIGO}`) ?? '[]')
    expect(cola).toHaveLength(1)
    expect(cola[0]).toMatchObject({ proyecto_id: 'insumex', ronda: 1 })
    conSenal = true
    window.dispatchEvent(new Event('online'))
    expect(await screen.findByText('Volvió la señal: enviamos tu calificación de INSUMEX.')).toBeTruthy()
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
  })

  it('en ronda 2 con revelar_hojas muestra las 6 hojas con la propia primero', async () => {
    const yo = yoCon((y) => {
      y.config.revelar_hojas = true
      y.contenido.hojas = ['cliente', 'regulacion', 'financiero'].map((perfil_id) => ({
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

  it('token vencido: recupera la sesión con el correo ya escrito y vuelve a donde iba', async () => {
    let inscrito = false
    servidor((url) => {
      if (url === '/api/yo') return inscrito ? { status: 200, body: yoBase } : { status: 401, body: { error: { codigo: 'TOKEN_INVALIDO', mensaje: 'x' } } }
      if (url === '/api/inscripcion') {
        inscrito = true
        return { status: 409, body: { error: { codigo: 'CORREO_YA_INSCRITO', mensaje: 'Ya' }, token: 'tok-2', participante: yoBase.participante } }
      }
      return { status: 200, body: MESA }
    })
    conToken()
    localStorage.setItem(`hz_datos:${CODIGO}`, JSON.stringify({ nombre: 'Ana Pérez', correo: 'ana@empresa.com' }))
    sessionStorage.setItem(`hz_vista:${CODIGO}`, 'calificar:nutriwhat')
    montar()
    expect(await screen.findByRole('heading', { name: 'Tu sesión ya no está activa' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar mi sesión' }))
    expect(await screen.findByRole('heading', { name: 'Recupera tu sesión' })).toBeTruthy()
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBeNull()
    expect((screen.getByLabelText(/Tu correo/) as HTMLInputElement).value).toBe('ana@empresa.com')
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Recuperar mi sesión' }))
    // Vuelve a la pantalla en la que iba (calificar NUTRIWHAT), sin la bienvenida.
    expect(await screen.findByRole('heading', { name: 'NUTRIWHAT' })).toBeTruthy()
    expect(localStorage.getItem(`hz_token:${CODIGO}`)).toBe('tok-2')
  })

  it('ningún texto de las pantallas lleva rayas', async () => {
    servidor(() => ({ status: 200, body: yoBase }))
    conToken()
    const { container } = montar()
    await screen.findByRole('heading', { name: /Ronda 1/ })
    expect(container.textContent).not.toContain('—')
  })
})
