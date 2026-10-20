// @vitest-environment jsdom
// Correcciones de la QA del panel (QA-A-01 a QA-A-32), de la auditoría del frontend (F-5 a F-16) y decisiones D1 y D2
// del 20-oct, contra el simulador del panel. Las mismas rutas contra la API real están en admin.real.test.tsx.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { type Transporte, usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { recordarSala, salaRecordada, olvidarSala } from './memoria'
import { useSala } from './useSala'
import { moverProgramacion } from './paginas/Configuracion'
import { semaforo } from './paginas/Salud'
import { conPunto, confirmacionCierreRonda, nombreEnsayo, numeroPregunta, urlVistaPrevia, accionesParaCorregir, PASO_SIGUIENTE } from './textos'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario = 'paola', clave = 'demo1234') {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: clave } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
}

const nav = () => within(screen.getByRole('navigation', { name: 'Secciones del panel' }))
const boton = (n: string | RegExp) => screen.getByRole('button', { name: n }) as HTMLButtonElement

/** La sala demo del simulador: ronda 1 abierta, modo guiado, Mesa 1 completa y las demás con gente pendiente. */
async function abrirDemo(usuario = 'paola') {
  montar('/admin/login')
  await entrar(usuario)
  fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
  await screen.findByRole('heading', { name: 'Sala en vivo' })
}

async function salaNueva(nombre: string, mesas = 1) {
  montar('/admin/login')
  await entrar()
  fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: nombre } })
  fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: String(mesas) } })
  fireEvent.click(boton('Crear sala'))
  await screen.findByRole('heading', { name: 'Sala en vivo' })
  await screen.findByText('Preparada', { selector: '.estado' })
}

/** Transporte del simulador que cuenta las llamadas y deja interceptar algunas. */
function espiar(interceptar?: (metodo: string, ruta: string) => ReturnType<Transporte> | undefined) {
  const llamadas: string[] = []
  usarTransporte(async (metodo, ruta, cuerpo, etag) => {
    llamadas.push(`${metodo} ${ruta}`)
    return (interceptar?.(metodo, ruta) ?? responderMock(metodo, ruta, cuerpo, etag)) as ReturnType<Transporte>
  })
  return llamadas
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  usarTransporte(responderMock)
  document.title = ''
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('textos y utilidades de las correcciones', () => {
  it('QA-A-01: el paso que sigue nunca es una acción que deshace', () => {
    for (const paso of Object.values(PASO_SIGUIENTE)) expect(paso ?? '').not.toMatch(/^reabrir|reiniciar/)
    expect(PASO_SIGUIENTE.r2_cerrada).toBe('cerrar_sala')
    expect(PASO_SIGUIENTE.cerrada).toBeNull()
    // QA-A-05: lo que se puede corregir excluye el paso que sigue.
    expect(accionesParaCorregir('r2_cerrada')).toEqual(['reabrir_ronda', 'reiniciar_ronda'])
    expect(accionesParaCorregir('preparada')).toEqual(['cerrar_sala'])
  })

  it('QA-A-06: cerrar la ronda con personas pendientes pide confirmación', () => {
    expect(confirmacionCierreRonda(1, 0, 6)).toBeNull()
    expect(confirmacionCierreRonda(2, 2, 6)).toEqual({
      titulo: '¿Cerrar la ronda 2 con 2 personas sin terminar?',
      texto: '2 personas de 6 no han terminado de votar. Si cierras ahora, ya no pueden responder la ronda 2 y la comparación R1 y R2 mezcla grupos de distinto tamaño. Si te equivocas, puedes reabrir la ronda.',
      boton: 'Sí, cerrar la ronda 2',
    })
    expect(confirmacionCierreRonda(1, 1, 3)?.texto).toMatch(/^1 persona de 3 no ha terminado de votar\. Si cierras ahora, ya no puede responder la ronda 1\./)
  })

  it('QA-A-08: «Pregunta N de 6», como el tablero', () => {
    expect(numeroPregunta({ proyecto_id: 'nutriwhat', criterio_id: 'inversion_requerida' }).texto).toBe('Pregunta 6 de 6')
    expect(numeroPregunta({ proyecto_id: 'insumex', criterio_id: 'alistamiento_tecnico' }).texto).toBe('Pregunta 1 de 6')
  })

  it('QA-A-11 y QA-A-29: la copia de ensayo cabe en 120 caracteres y no acumula «(ensayo)»', () => {
    const largo = 'x'.repeat(120)
    expect(nombreEnsayo(largo)).toHaveLength(120)
    expect(nombreEnsayo(largo).endsWith(' (ensayo)')).toBe(true)
    expect(nombreEnsayo('Taller (ensayo)')).toBe('Taller (ensayo)')
    expect(nombreEnsayo('Taller (ensayo) (ensayo)')).toBe('Taller (ensayo)')
    expect(nombreEnsayo('Taller (copia)')).toBe('Taller (ensayo)')
  })

  it('QA-A-16: el punto final no se duplica después de «p. m.»', () => {
    expect(conPunto('La inscripción se abrirá el 19/10/2026, 11:39 p. m.')).toBe('La inscripción se abrirá el 19/10/2026, 11:39 p. m.')
    expect(conPunto('La sala se cerrará el 20/10/2026, 18:00')).toBe('La sala se cerrará el 20/10/2026, 18:00.')
  })

  it('QA-A-04: la vista previa del celular abre en este servidor y en solo lectura', () => {
    expect(urlVistaPrevia('https://horizontes.estratek.com.co/m/HZ7K2-1')).toBe('/m/HZ7K2-1?vista=previa')
    expect(urlVistaPrevia('/m/HZ7K2-1?x=1')).toBe('/m/HZ7K2-1?x=1&vista=previa')
    expect(urlVistaPrevia(undefined)).toBeNull()
  })

  it('F-7 y QA-A-10: al cambiar la zona, lo programado conserva la hora del reloj', () => {
    const c = { apertura_programada_sala_at: '2030-01-10T23:39:00-05:00', cierre_programado_r1_at: null }
    expect(moverProgramacion(c, 'America/Bogota', 'America/Guatemala')).toEqual({
      cambio: { apertura_programada_sala_at: '2030-01-10T23:39:00-06:00' },
      horas: ['23:39'],
    })
    expect(moverProgramacion(c, 'America/Bogota', 'America/Lima').horas).toEqual(['23:39'])
    expect(moverProgramacion(c, 'America/Bogota', 'America/Bogota')).toEqual({ cambio: {}, horas: [] })
  })

  it('QA-A-27: semáforo de salud en lenguaje llano', () => {
    expect(semaforo({ ok: true }, null, 39)).toMatchObject({ tono: 'exito', titulo: 'Todo bien', texto: 'El servidor responde en 39 ms.' })
    expect(semaforo({ ok: true }, null, 900)).toMatchObject({ tono: 'aviso', titulo: 'Lento' })
    expect(semaforo(null, 'No hay conexión.', null)).toMatchObject({ tono: 'error', titulo: 'No responde' })
  })

  it('deuda: el almacenamiento del navegador puede fallar sin tumbar el panel', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(() => recordarSala('s_x')).not.toThrow()
    expect(salaRecordada()).toBeNull()
    expect(() => olvidarSala('s_x')).not.toThrow()
  })

  it('deuda: el simulador entrega la ETag entre comillas y responde 304 con ella', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    const r = await responderMock('GET', '/api/admin/salas/s_demo')
    expect(r.etag).toMatch(/^"v-\d+"$/)
    expect((await responderMock('GET', '/api/admin/salas/s_demo', undefined, r.etag)).status).toBe(304)
  })

  it('QA-A-12, QA-A-31, QA-A-32 y F-15: Montserrat en botones y URL, nota con aire y la hoja impresa sin avisos', () => {
    const css = readFileSync(join(__dirname, 'admin.css'), 'utf8')
    expect(css).toMatch(/\.hz-admin button \{ font-family: inherit; \}/)
    expect(css).toMatch(/\.hz-admin code \{[^}]*font-family: inherit/)
    expect(css).toMatch(/\.hz-admin \.tabla-envoltura \+ \.pista,\s*\.hz-admin \.nota-tabla \{ margin-top/)
    const impresion = css.slice(css.indexOf('@media print'))
    expect(impresion).toMatch(/\.aviso-dominio/)
  })

  it('F-12, F-16 y la guía: concordancia, sin claves de prueba y un solo nombre para cada acceso', () => {
    const archivos = (dir: string): string[] =>
      readdirSync(dir).flatMap((f) => {
        const p = join(dir, f)
        return statSync(p).isDirectory() ? archivos(p) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : []
      })
    for (const f of archivos(__dirname)) {
      const texto = readFileSync(f, 'utf8')
      expect(texto, f).not.toMatch(/Hace falta al menos/)
      expect(texto, f).not.toMatch(/paola o jorge|clave demo1234/)
      expect(texto, f).not.toMatch(/Ver como participante|Tablero de toda la sala|Abrir tablero de la sala/)
    }
    const guia = readFileSync(join(__dirname, '../../docs/GUIA_FACILITADOR.md'), 'utf8')
    for (const t of ['Tablero de la sala', 'Vista previa del celular', 'Dar acceso de nuevo', 'Quitar la pregunta', 'Hacen falta al menos 3 votos', 'cada 3 votos nuevos']) expect(guia).toContain(t)
    expect(guia).not.toMatch(/Abrir tablero de la sala|recuperar mi sesión|Hace falta al menos/)
  })
})

describe('Sala en vivo', () => {
  it('QA-A-02: los diálogos destructivos abren con el foco en Cancelar, y Esc cancela', async () => {
    await abrirDemo()
    const corregir = within(screen.getByRole('group', { name: 'Corregir' }))
    const cerrarSala = corregir.getByRole('button', { name: 'Cerrar sala' })
    cerrarSala.focus()
    fireEvent.click(cerrarSala)
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar la sala?' })
    expect(document.activeElement?.textContent).toBe('Cancelar')
    // Cancelar va antes que el botón que confirma: un Enter accidental no cierra la sala.
    expect(within(dialogo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancelar', 'Sí, cerrar la sala'])
    fireEvent(dialogo, new Event('cancel'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
    // El foco vuelve al botón que abrió el diálogo.
    expect(document.activeElement).toBe(corregir.getByRole('button', { name: 'Cerrar sala' }))
  })

  it('QA-A-05: control limpio: un paso que sigue con su explicación y, aparte, solo lo posible para corregir', async () => {
    await abrirDemo()
    const control = within(screen.getByRole('region', { name: 'Control de la sala' }))
    expect([...document.querySelectorAll('.hz-boton--primario')].map((b) => b.textContent)).toEqual(['Cerrar ronda 1'])
    expect(document.getElementById(boton('Cerrar ronda 1').getAttribute('aria-describedby')!)?.textContent).toMatch(/Nadie más responde la ronda 1/)
    const corregir = within(control.getByRole('group', { name: 'Corregir' }))
    expect(corregir.getAllByRole('button').map((b) => [b.textContent, b.className.includes('hz-boton--peligro')])).toEqual([
      ['Reiniciar votos de la ronda', true],
      ['Cerrar sala', true],
    ])
    for (const n of ['Abrir inscripción', 'Abrir ronda 2', 'Reabrir ronda', 'Reabrir sala']) expect(screen.queryByRole('button', { name: n })).toBeNull()
  })

  it('QA-A-06: cerrar la ronda con personas sin votar avisa cuántas y Cancelar no cierra', async () => {
    await abrirDemo()
    fireEvent.click(boton('Cerrar ronda 1'))
    // Simulador: 12 personas en 3 mesas, solo 4 completaron la ronda.
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar la ronda 1 con 8 personas sin terminar?' })
    expect(within(dialogo).getByText(/8 personas de 12 no han terminado de votar/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
    fireEvent.click(boton('Cerrar ronda 1'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la ronda 1' }))
    await screen.findByText('Ronda 1 cerrada', { selector: '.estado' })
    expect([...document.querySelectorAll('.hz-boton--primario')].map((b) => b.textContent)).toEqual(['Abrir ronda 2'])
  })

  it('QA-A-03, QA-A-04 y QA-A-25: «Ver en vivo» es el único lugar con los accesos, y la vista previa no inscribe', async () => {
    await abrirDemo()
    const enVivo = screen.getByRole('region', { name: 'Ver en vivo' })
    const enlacesTablero = [...document.querySelectorAll<HTMLAnchorElement>('a[href^="/tablero/"], a[href^="/m/"]')]
    expect(enlacesTablero.length).toBe(3)
    for (const a of enlacesTablero) expect(enVivo.contains(a)).toBe(true)
    const previa = within(enVivo).getByRole('link', { name: 'Vista previa del celular' })
    expect(previa.getAttribute('href')).toBe('/m/HZ7K2-1?vista=previa')
    expect(document.getElementById(previa.getAttribute('aria-describedby')!)?.textContent).toMatch(/No te inscribas ni votes ahí/)
    fireEvent.change(within(enVivo).getByLabelText('Mesa'), { target: { value: 'm2' } })
    expect(within(enVivo).getByRole('link', { name: 'Vista previa del celular' }).getAttribute('href')).toBe('/m/HZ7K2-2?vista=previa')
    expect(within(enVivo).getByRole('link', { name: 'Tablero de Mesa 2' })).toBeTruthy()
    // La tabla de mesas ya no repite enlaces (eran de 21 px en el celular).
    expect(within(screen.getByRole('region', { name: 'Mesas' })).queryAllByRole('link')).toHaveLength(0)
  })

  it('F-8 y D2: el resultado preliminar no parpadea al renovarse y explica que se renueva de 3 en 3', async () => {
    let lento = false
    espiar((metodo, ruta) => (lento && ruta.startsWith('/api/tablero/') ? new Promise((r) => setTimeout(() => r(responderMock(metodo, ruta)), 300)) : undefined))
    await abrirDemo()
    fireEvent.click(boton('Ver resultado de Mesa 1'))
    const region = await screen.findByRole('region', { name: /Resultado preliminar · Mesa 1/ })
    expect(within(region).getByText(/Se renueva cada 3 votos nuevos/)).toBeTruthy()
    expect(screen.getByText(/El resultado preliminar se renueva cada 3 votos nuevos; al cerrar la ronda queda el exacto/)).toBeTruthy()
    lento = true
    // Siguiente (modo guiado) cambia la versión de la sala: el resultado se vuelve a pedir y tarda.
    fireEvent.click(within(screen.getByRole('region', { name: 'Pregunta en pantalla' })).getByRole('button', { name: 'Siguiente' }))
    await screen.findByText(/^Pregunta 4 de 6/)
    expect(screen.queryByText('Cargando resultado…')).toBeNull()
    expect(within(screen.getByRole('region', { name: /Resultado preliminar · Mesa 1/ })).getByRole('table', { name: 'INSUMEX' })).toBeTruthy()
  })

  it('QA-A-15: la bitácora es una lista sin numerar, lo más reciente arriba, y deja ver todo', async () => {
    // 20 cambios de pregunta (alternan entre dos): más de las 15 líneas que se ven de entrada.
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    for (let i = 0; i < 20; i++) await responderMock('PUT', '/api/admin/salas/s_demo/pregunta-guiada', { proyecto_id: 'insumex', criterio_id: i % 2 ? 'regulacion' : 'alineacion_core' })
    // La sesión ya quedó abierta en el simulador: se entra directo a la sala.
    montar('/admin/salas/s_demo/vivo')
    await screen.findByRole('heading', { name: 'Bitácora de la sala' })
    const seccion = within(screen.getByRole('region', { name: 'Bitácora de la sala' }))
    expect(seccion.getByRole('list', { name: 'Eventos de la sala' }).tagName).toBe('UL')
    expect(seccion.getByText(/Lo más reciente arriba/)).toBeTruthy()
    expect(seccion.getAllByRole('listitem')).toHaveLength(15)
    expect(seccion.getAllByRole('listitem')[0].textContent).toMatch(/Pregunta en pantalla: INSUMEX · Pregunta 3 de 6 · paola$/)
    fireEvent.click(seccion.getByRole('button', { name: /^Ver los \d+ eventos$/ }))
    expect(seccion.getAllByRole('listitem').length).toBeGreaterThan(20)
    expect(seccion.getByRole('button', { name: 'Ver menos' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('F-5: si la sesión vence en medio del taller, el panel lleva al login y lo explica', async () => {
    let vencida = false
    espiar((_m, ruta) => (vencida && ruta.startsWith('/api/admin/') ? Promise.resolve({ status: 401, body: { error: { codigo: 'SESION_REQUERIDA', mensaje: 'Inicia sesión para continuar.' } } }) : undefined))
    await abrirDemo()
    vencida = true
    fireEvent.click(nav().getByText('Participantes'))
    expect(await screen.findByRole('heading', { name: 'Panel de administración' })).toBeTruthy()
    expect(screen.getByText('Tu sesión terminó. Vuelve a entrar para seguir donde ibas.')).toBeTruthy()
    expect(screen.queryByText(/Se perdió la conexión/)).toBeNull()
  })

  it('F-9: sin red o con una respuesta que no es JSON, el mensaje es claro', async () => {
    espiar((_m, ruta) => {
      if (ruta === '/api/admin/salas') return Promise.resolve({ status: 200, body: null, invalida: true })
      if (ruta === '/api/admin/salas/s_demo/hojas') return Promise.reject(new TypeError('Failed to fetch'))
      return undefined
    })
    montar('/admin/login')
    fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'paola' } })
    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
    fireEvent.click(boton('Entrar'))
    expect(await screen.findByText(/^No pudimos cargar las salas\. El servidor respondió algo que el panel no entiende/)).toBeTruthy()
    cleanup()
    montar('/admin/salas/s_demo/hojas')
    expect(await screen.findByText('No pudimos cargar las hojas. No hay conexión con el servidor. Revisa tu red e intenta de nuevo.')).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Failed to fetch|Unexpected token/)
  })
})

describe('useSala', () => {
  it('F-10: una respuesta tardía de la sala anterior no pisa a la sala nueva', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    await responderMock('POST', '/api/admin/salas', { nombre: 'Otra', mesas: 1 })
    const otra = ((await responderMock('GET', '/api/admin/salas')).body as { id: string; nombre: string }[]).find((s) => s.nombre === 'Otra')!.id
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      ruta === '/api/admin/salas/s_demo' ? new Promise((r) => setTimeout(() => r(responderMock(metodo, ruta, cuerpo, etag)), 200)) : responderMock(metodo, ruta, cuerpo, etag),
    )
    const { result, rerender } = renderHook(({ id }) => useSala(id), { initialProps: { id: 's_demo' } })
    rerender({ id: otra })
    await waitFor(() => expect(result.current.datos?.sala.id).toBe(otra))
    await act(() => new Promise((r) => setTimeout(r, 300)))
    expect(result.current.datos?.sala.id).toBe(otra)
  })
})

describe('Participantes', () => {
  it('QA-A-09: mover o desactivar a quien ya votó pide confirmación; a quien no, no', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Participantes'))
    // Ana Pérez completó la ronda 1 en el simulador; Luis Gómez no.
    const mesaAna = (await screen.findByLabelText('Mesa de Ana Pérez')) as HTMLSelectElement
    await waitFor(() => expect(mesaAna.disabled).toBe(false))
    fireEvent.change(mesaAna, { target: { value: 'm2' } })
    const dialogo = await screen.findByRole('dialog', { name: '¿Mover a Ana Pérez a Mesa 2?' })
    expect(within(dialogo).getByText(/Ana Pérez ya votó\. Sus votos se mueven con la persona: dejan de contar en Mesa 1 y pasan a contar en Mesa 2/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((screen.getByLabelText('Mesa de Ana Pérez') as HTMLSelectElement).value).toBe('m1')
    fireEvent.change(screen.getByLabelText('Mesa de Ana Pérez'), { target: { value: 'm2' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, mover' }))
    expect(await screen.findByText('Ana Pérez pasó a Mesa 2.')).toBeTruthy()

    fireEvent.click(boton('Desactivar a Ana Pérez'))
    const desactivar = await screen.findByRole('dialog', { name: '¿Desactivar a Ana Pérez?' })
    fireEvent.click(within(desactivar).getByRole('button', { name: 'Sí, desactivar' }))
    expect(await screen.findByText(/Ana Pérez quedó inactivo/)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Mesa de Luis Gómez'), { target: { value: 'm3' } })
    expect(await screen.findByText('Luis Gómez pasó a Mesa 3.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('D1: «Dar acceso de nuevo» muestra un QR grande, el enlace y la hora en que vence', async () => {
    const llamadas = espiar()
    await abrirDemo()
    fireEvent.click(nav().getByText('Participantes'))
    expect(await screen.findByText(/genera un QR personal que sirve una vez y vence en 15 minutos/)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: 'Dar acceso de nuevo a Ana Pérez' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Acceso de nuevo para Ana Pérez' })
    expect(llamadas).toContain('POST /api/admin/participantes/p_1/acceso')
    expect(within(dialogo).getByText(/cambió de celular o borró la sesión/)).toBeTruthy()
    const qr = (await within(dialogo).findByRole('img', { name: 'Código QR del acceso de Ana Pérez' })) as HTMLImageElement
    expect(qr.src).toMatch(/^data:image\/svg\+xml/)
    expect(within(dialogo).getByText(/\/m\/HZ7K2-1\?acceso=/)).toBeTruthy()
    expect(within(dialogo).getByText(/^Sirve una sola vez y vence a las .+ \(en 1[45] min \d\d s\)\.$/)).toBeTruthy()
    expect(within(dialogo).getByText(/se cierra la sesión que tenga abierta en otro celular/)).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Listo')
    const escribir = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: escribir }, configurable: true })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Copiar enlace' }))
    expect(await within(dialogo).findByRole('button', { name: 'Enlace copiado' })).toBeTruthy()
    expect(escribir.mock.calls[0][0]).toMatch(/\/m\/HZ7K2-1\?acceso=/)
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Listo' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    // Queda en la bitácora de la sala.
    fireEvent.click(nav().getByText('Sala en vivo'))
    expect(await screen.findByText(/Acceso de nuevo para Ana Pérez · paola/)).toBeTruthy()
  })

  it('D1: el rechazo del servidor sale tal cual y con la sala cerrada no se ofrece', async () => {
    espiar((metodo, ruta) =>
      metodo === 'POST' && ruta.endsWith('/acceso') ? Promise.resolve({ status: 409, body: { error: { codigo: 'PARTICIPANTE_INACTIVO', mensaje: 'Esa persona está inactiva.' } } }) : undefined,
    )
    await abrirDemo()
    fireEvent.click(nav().getByText('Participantes'))
    fireEvent.click(await screen.findByRole('button', { name: 'Dar acceso de nuevo a Ana Pérez' }))
    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos dar acceso a Ana Pérez. Esa persona está inactiva.')
    fireEvent.click(nav().getByText('Sala en vivo'))
    fireEvent.click(within(await screen.findByRole('group', { name: 'Corregir' })).getByRole('button', { name: 'Cerrar sala' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la sala' }))
    await screen.findByText('Sala cerrada', { selector: '.estado' })
    fireEvent.click(nav().getByText('Participantes'))
    expect(await screen.findByText('Con la sala cerrada ya no se puede dar acceso de nuevo.')).toBeTruthy()
    expect(boton('Dar acceso de nuevo a Ana Pérez').disabled).toBe(true)
  })
})

describe('Configuración', () => {
  it('QA-A-13 y D2: el aviso sale junto al control y la opción queda marcada de inmediato', async () => {
    await salaNueva('Avisos')
    fireEvent.click(nav().getByText('Configuración'))
    const despues = within(await screen.findByRole('group', { name: 'Después de votar' }))
    expect(despues.getByText(/Se renueva cada 3 votos nuevos/)).toBeTruthy()
    const registrado = despues.getByLabelText(/Voto registrado/) as HTMLInputElement
    fireEvent.click(registrado)
    expect(registrado.checked).toBe(true)
    expect((await despues.findByRole('status')).textContent).toBe('Tras votar, el participante ve «Voto registrado».')
  })

  it('F-7, QA-A-10 y QA-A-17: cambiar el país conserva la hora programada y avisa si la zona no es la del país', async () => {
    await salaNueva('Guatemala')
    fireEvent.click(nav().getByText('Configuración'))
    const campo = (await screen.findByRole('group', { name: 'Sala' })).querySelector<HTMLInputElement>('#apertura_programada_sala_at')!
    fireEvent.change(campo, { target: { value: '2030-01-10T23:39' } })
    fireEvent.click(within(campo.closest('.campo-hora') as HTMLElement).getByRole('button', { name: 'Programar' }))
    // QA-A-16: sin doble punto tras «p. m.».
    const hecho = await within(campo.closest('.campo-hora') as HTMLElement).findByRole('status')
    expect(hecho.textContent).toMatch(/^La inscripción se abrirá el .*2030.*\.$/)
    expect(hecho.textContent).not.toMatch(/\.\.$/)
    const pais = within(screen.getByRole('region', { name: 'País y hora' }))
    fireEvent.change(pais.getByLabelText('País de la sala'), { target: { value: 'GT' } })
    expect((await pais.findByRole('status')).textContent).toBe(
      'La sala quedó en Guatemala, con hora de Guatemala (UTC-6). Las horas programadas siguen en el mismo reloj, ahora en hora de Guatemala: 23:39. Revísalas en Apertura y cierre programados.',
    )
    await waitFor(() => expect((document.getElementById('apertura_programada_sala_at') as HTMLInputElement).value).toBe('2030-01-10T23:39'))
    expect(pais.queryByText(/La zona no es la de/)).toBeNull()
    fireEvent.change(pais.getByLabelText('Zona horaria'), { target: { value: 'America/Bogota' } })
    expect(await pais.findByText(/^La zona no es la de Guatemala \(Guatemala \(UTC-6\)\)/)).toBeTruthy()
  })

  it('QA-A-14: con cambios sin guardar en la rúbrica, salir de la sección pregunta antes', async () => {
    await salaNueva('Pendientes')
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.change(await screen.findByLabelText('Nivel 7'), { target: { value: 'Texto nuevo sin guardar' } })
    fireEvent.click(nav().getByText('Sala en vivo'))
    const dialogo = await screen.findByRole('dialog', { name: '¿Salir sin guardar?' })
    expect(within(dialogo).getByText(/Tienes cambios sin guardar en la rúbrica de Inversión Requerida para Probar/)).toBeTruthy()
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((screen.getByLabelText('Nivel 7') as HTMLTextAreaElement).value).toBe('Texto nuevo sin guardar')
    fireEvent.click(nav().getByText('Sala en vivo'))
    fireEvent.click(await screen.findByRole('button', { name: 'Salir sin guardar' }))
    expect(await screen.findByRole('heading', { name: 'Control de la sala' })).toBeTruthy()
  })
})

describe('Login, cuenta y navegación', () => {
  it('QA-A-19 y F-16: tras un error el foco vuelve a la clave; sin claves de prueba en pantalla', async () => {
    montar('/admin/login')
    expect(document.body.textContent).not.toMatch(/demo1234|paola o jorge/)
    fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'paola' } })
    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'mala' } })
    fireEvent.click(boton('Entrar'))
    expect((await screen.findByRole('alert')).textContent).toBe('Usuario o clave incorrectos.')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Clave')))
    expect(screen.getByLabelText('Clave').getAttribute('aria-invalid')).toBe('true')
  })

  it('QA-A-20: con demasiados intentos el botón espera y dice cuánto falta', async () => {
    espiar((_m, ruta) =>
      ruta === '/api/admin/login'
        ? Promise.resolve({ status: 429, body: { error: { codigo: 'DEMASIADAS_PETICIONES', mensaje: 'Hay demasiados intentos desde esta red. Espera un minuto.' } } })
        : undefined,
    )
    montar('/admin/login')
    fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: 'paola' } })
    fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'x' } })
    fireEvent.click(boton('Entrar'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/^Hay demasiados intentos desde esta red\. Espera un minuto\. Podrás intentar de nuevo en \d+ min \d\d s\.$/)
    expect(boton('Espera un momento').disabled).toBe(true)
  })

  it('QA-A-21: la regla del usuario se ve y un usuario inválido se explica en español', async () => {
    montar('/admin/login')
    await entrar()
    fireEvent.click(nav().getByText('Administradores'))
    const usuario = await screen.findByLabelText('Usuario')
    expect(document.getElementById('regla-usuario')?.textContent).toBe('Entre 3 y 30 caracteres: minúsculas, números, punto o guion. Sin espacios ni tildes.')
    fireEvent.change(usuario, { target: { value: 'Admin Con Espacio' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Admin' } })
    fireEvent.click(boton('Crear administrador'))
    expect((await screen.findByRole('alert')).textContent).toBe('Ese usuario no sirve. Entre 3 y 30 caracteres: minúsculas, números, punto o guion. Sin espacios ni tildes.')
    expect(usuario.getAttribute('aria-invalid')).toBe('true')
    expect(screen.queryByRole('rowheader', { name: 'Admin' })).toBeNull()
  })

  it('QA-A-22: cada admin cambia su clave cuando quiera y puede volver sin cambiarla', async () => {
    montar('/admin/login')
    await entrar('jorge')
    fireEvent.click(screen.getByRole('link', { name: 'Cambiar mi clave' }))
    expect(await screen.findByRole('heading', { name: 'Cambiar mi clave' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Volver sin cambiarla' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Clave actual'), { target: { value: 'demo1234' } })
    fireEvent.change(screen.getByLabelText('Clave nueva'), { target: { value: 'otra-clave-123' } })
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'otra-clave-123' } })
    fireEvent.click(boton('Guardar clave'))
    expect(await screen.findByText('Tu clave quedó cambiada.')).toBeTruthy()
  })

  it('QA-A-23 y QA-A-24: menú plegable en el celular, título por sección y foco en el título al navegar', async () => {
    await abrirDemo()
    await waitFor(() => expect(document.title).toBe('Sala en vivo · Taller Horizontes demo · Horizontes'))
    const menu = screen.getByRole('button', { name: /^Menú · Sala en vivo$/ })
    expect(menu.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(menu)
    expect(menu.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('navigation', { name: 'Secciones del panel' }).className).toContain('nav--abierto')
    fireEvent.click(nav().getByText('Participantes'))
    await screen.findByRole('heading', { level: 1, name: 'Participantes' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: 'Participantes' })))
    expect(document.title).toBe('Participantes · Taller Horizontes demo · Horizontes')
    expect(screen.getByRole('button', { name: /^Menú · Participantes$/ }).getAttribute('aria-expanded')).toBe('false')
  })
})

describe('Mesas y QR, Respuestas, Exportar', () => {
  it('QA-A-26, QA-A-31 y F-6: imprimir es lo principal, cada QR invita a escanear y un doble clic agrega una sola vez', async () => {
    const llamadas = espiar()
    await abrirDemo()
    fireEvent.click(nav().getByText('Mesas y QR'))
    await screen.findByRole('heading', { name: 'Hoja de QR' })
    expect([...document.querySelectorAll('.hz-boton--primario')].map((b) => b.textContent)).toEqual(['Imprimir hoja de QR'])
    expect(boton('Agregar').className).toContain('hz-boton--secundario')
    expect(screen.getAllByText('Escanea para entrar')).toHaveLength(3)
    expect(document.querySelector('.qr-tarjeta code')).toBeNull()
    fireEvent.click(boton('Agregar'))
    fireEvent.click(boton(/^Agrega/))
    expect(await screen.findByText('Agregamos 1 mesa.')).toBeTruthy()
    expect(llamadas.filter((l) => l === 'POST /api/admin/salas/s_demo/mesas')).toHaveLength(1)
  })

  it('F-14: el QR proyectado atrapa el foco y al cerrar vuelve al botón', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Mesas y QR'))
    const proyectar = (await screen.findAllByRole('button', { name: 'Proyectar QR' }))[0]
    proyectar.focus()
    fireEvent.click(proyectar)
    const dialogo = await screen.findByRole('dialog', { name: 'Mesa 1' })
    const cerrar = within(dialogo).getByRole('button', { name: 'Cerrar' })
    expect(document.activeElement).toBe(cerrar)
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(cerrar)
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(proyectar)
  })

  it('QA-A-28: el conteo va fuera de la tabla y se filtra también por proyecto', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Respuestas'))
    const tabla = await screen.findByRole('table')
    expect(tabla.querySelector('caption')).toBeNull()
    expect(screen.getByText('8 votos. Cada fila es una persona, una ronda y un proyecto.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Proyecto'), { target: { value: 'nutriwhat' } })
    expect(screen.getByText('4 votos. Cada fila es una persona, una ronda y un proyecto.')).toBeTruthy()
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + 4)
  })

  it('QA-A-32: la nota de Participantes va aparte de la tabla', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Participantes'))
    const nota = await screen.findByText(/^Qué calificó cada persona está en Respuestas/)
    expect(nota.className).toContain('nota-tabla')
  })
})
