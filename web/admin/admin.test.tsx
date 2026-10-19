// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import {
  ACCIONES_POR_ESTADO,
  ORDEN_PREGUNTAS,
  dominioDistinto,
  estadoMesa,
  faltan,
  horaLocalAIso,
  isoAHoraLocal,
  programaciones,
  rutaApiTablero,
  textoEvento,
  urlTableroSala,
  zonaSala,
} from './textos'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario: string) {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  // Cada prueba empieza como un navegador que nunca abrió una sala.
  localStorage.removeItem('hz_admin_sala')
  usarTransporte(responderMock)
})
afterEach(cleanup)

describe('textos del panel', () => {
  it('convierte la hora de la zona de la sala ida y vuelta', () => {
    expect(horaLocalAIso('2026-10-20T18:00')).toBe('2026-10-20T18:00:00-05:00')
    expect(isoAHoraLocal('2026-10-20T18:00:00-05:00')).toBe('2026-10-20T18:00')
    expect(isoAHoraLocal('2026-10-20T23:00:00Z')).toBe('2026-10-20T18:00')
    expect(horaLocalAIso('2026-10-20')).toBeNull()
    expect(horaLocalAIso('2026-10-20T18:00', 'America/Guatemala')).toBe('2026-10-20T18:00:00-06:00')
    expect(isoAHoraLocal('2026-10-20T23:00:00Z', 'America/Guatemala')).toBe('2026-10-20T17:00')
  })

  it('la zona de la sala sale de la configuración o del país', () => {
    expect(zonaSala({})).toBe('America/Bogota')
    expect(zonaSala({ pais: 'GT' })).toBe('America/Guatemala')
    expect(zonaSala({ pais: 'PE', zona_horaria: 'America/Bogota' })).toBe('America/Bogota')
  })

  it('cuenta regresiva legible', () => {
    expect(faltan(65 * 60 * 1000)).toBe('1 h 05 min')
    expect(faltan(249 * 1000)).toBe('4 min 09 s')
    expect(faltan(-1)).toBe('ya')
  })

  it('deriva el tablero de sala y la ruta de la API del tablero', () => {
    const mesa = 'https://horizontes.estratek.com.co/tablero/HZ7K2?mesa=m1&t=TOK'
    expect(urlTableroSala(undefined, mesa)).toBe('https://horizontes.estratek.com.co/tablero/HZ7K2?t=TOK')
    expect(urlTableroSala('/x', mesa)).toBe('/x')
    expect(rutaApiTablero('s_demo', mesa, 'm1')).toBe('/api/tablero/s_demo?alcance=mesa&mesa=m1&t=TOK')
    expect(rutaApiTablero('s_demo', mesa)).toBe('/api/tablero/s_demo?alcance=sala&t=TOK')
  })

  it('describe los eventos de la bitácora en lenguaje claro', () => {
    expect(textoEvento({ tipo: 'ronda_cerrada', detalle: { ronda: 1 }, por: 'admin:paola' })).toBe('Ronda 1 cerrada · paola')
    expect(textoEvento({ tipo: 'inscripcion_abierta', detalle: {}, por: 'admin:paola' })).toBe('Inscripción abierta · paola')
    expect(textoEvento({ tipo: 'cierre_programado', detalle: {}, por: 'programado' })).toBe('Cierre programado aplicado · automático')
    expect(textoEvento({ tipo: 'precierre', detalle: { mensaje: 'Todos votaron en Mesa 1. Puedes cerrar la ronda.' }, por: 'sistema' })).toBe('Todos votaron en Mesa 1. Puedes cerrar la ronda.')
  })

  it('el estado de cada mesa sigue al de la sala: no dice Votando sin ronda abierta', () => {
    const m = { inscritos: 3, precierre: false }
    expect(estadoMesa('r1_abierta', m).texto).toBe('Votando')
    expect(estadoMesa('r2_abierta', { ...m, precierre: true }).texto).toBe('Precierre')
    expect(estadoMesa('r1_cerrada', m).texto).toBe('Ronda 1 cerrada')
    expect(estadoMesa('cerrada', m).texto).toBe('Sala cerrada')
    expect(estadoMesa('inscripcion', m).texto).toBe('Esperando la ronda')
    expect(estadoMesa('cerrada', { inscritos: 0 }).texto).toBe('Sin inscritos')
  })

  it('abrir R2 exige R1 cerrada y la sala cerrada solo se reabre', () => {
    expect(ACCIONES_POR_ESTADO.r1_abierta).not.toContain('abrir_ronda_2')
    expect(ACCIONES_POR_ESTADO.r1_cerrada).toContain('abrir_ronda_2')
    expect(ACCIONES_POR_ESTADO.cerrada).toEqual(['reabrir_sala'])
  })
})

describe('panel admin contra el simulador', () => {
  it('sin sesión manda al login', async () => {
    montar('/admin/salas')
    expect(await screen.findByRole('heading', { name: 'Panel de administración' })).toBeTruthy()
  })

  it('el admin normal no ve Administradores y la ruta le muestra sin permiso', async () => {
    montar('/admin/login')
    await entrar('jorge')
    const nav = screen.getByRole('navigation', { name: 'Secciones del panel' })
    expect(within(nav).queryByText('Administradores')).toBeNull()
    cleanup()
    montar('/admin/administradores')
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeTruthy()
  })

  it('el superadmin crea un admin con clave temporal', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Administradores'))
    await screen.findByRole('heading', { name: 'Nuevo administrador' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'nicolai' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nicolai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear administrador' }))
    expect(await screen.findByText(/Creamos la cuenta de Nicolai/)).toBeTruthy()
    expect(await screen.findByRole('rowheader', { name: 'Nicolai' })).toBeTruthy()
  })

  it('crea una sala y recorre el ciclo de estados con botones inválidos deshabilitados', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Ensayo' } })
    fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    await screen.findByText('Preparada')

    const boton = (n: string) => screen.getByRole('button', { name: n }) as HTMLButtonElement
    expect(boton('Abrir ronda 1').disabled).toBe(true)
    const pasos: [string, string][] = [
      ['Abrir inscripción', 'Inscripción abierta'],
      ['Abrir ronda 1', 'Ronda 1 abierta'],
      ['Cerrar ronda 1', 'Ronda 1 cerrada'],
      ['Abrir ronda 2', 'Ronda 2 abierta'],
      ['Cerrar ronda 2', 'Ronda 2 cerrada'],
    ]
    for (const [accion, estado] of pasos) {
      await waitFor(() => expect(boton(accion).disabled).toBe(false))
      fireEvent.click(boton(accion))
      await screen.findByText(estado, { selector: '.estado' })
    }
    // Cerrar sala pide confirmación.
    fireEvent.click(boton('Cerrar sala'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la sala' }))
    await screen.findByText('Sala cerrada', { selector: '.estado' })
    expect(boton('Reabrir sala').disabled).toBe(false)
  })

  it('duplica una sala para ensayo: copia vacía y abre su vista en vivo', async () => {
    montar('/admin/login')
    await entrar('paola')
    const botones = await screen.findAllByRole('button', { name: /^Duplicar .* para ensayo$/ })
    const nombre = botones[0].getAttribute('aria-label')!.replace(/^Duplicar | para ensayo$/g, '')
    fireEvent.click(botones[0])
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    expect(await screen.findByText(`${nombre} (ensayo)`)).toBeTruthy()
    await screen.findByText('Preparada')
  })

  it('el monitor de salud muestra el servidor y la latencia', async () => {
    montar('/admin/login')
    await entrar('jorge')
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Salud'))
    expect(await screen.findByText('En línea')).toBeTruthy()
    expect(screen.getByText('Versión desplegada: simulador')).toBeTruthy()
    expect(screen.getByText('p95')).toBeTruthy()
  })

  it('avisa el precierre de una mesa sin cerrar la ronda y muestra el resultado preliminar', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    // En el simulador inicial la Mesa 1 tiene a todos sus inscritos completos.
    expect(await screen.findByText(/Todos votaron en Mesa 1/, { selector: 'strong' })).toBeTruthy()
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Ver resultado de Mesa 1' }))
    expect(await screen.findByRole('heading', { name: /Resultado preliminar · Mesa 1/ })).toBeTruthy()
    // Acta A3, A4 y P2: los 6 criterios y la fila Total del servidor; sin T2M, ejes ni votos.
    const tabla = screen.getByRole('table', { name: 'INSUMEX' })
    expect(within(tabla).getAllByRole('rowheader').map((th) => th.textContent)).toEqual([
      'Nivel de Alistamiento Técnico',
      'Nivel de Conocimiento del Cliente/Mercado',
      'Regulación',
      'Capacidades Organizacionales',
      'Alineación y Cercanía Estratégica con el Core',
      'Inversión Requerida para Probar',
      'Total',
    ])
    expect(within(tabla).getByRole('columnheader', { name: 'R1' }).querySelector('.ronda--1')).toBeTruthy()
    expect(within(tabla).queryByText(/eje|votos|time to market/i)).toBeNull()
    const total = within(tabla).getByRole('rowheader', { name: 'Total' }).parentElement
    expect(total?.textContent).toBe('Total9,65') // `total` 9,653 del mock del servidor, con 2 decimales
  })

  it('una sala nueva muestra la sala completa tras votar y el país cambia la zona de los cierres', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Lima' } })
    fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Configuración'))
    expect(((await screen.findByLabelText(/Todos ven la sala completa/)) as HTMLInputElement).checked).toBe(true)
    expect((screen.getByLabelText(/Tablero en vivo/) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(/^Hora de Bogotá \(UTC-5\)/)).toBeTruthy()
    fireEvent.change(screen.getByLabelText('País de la sala'), { target: { value: 'GT' } })
    expect(await screen.findByText('La sala quedó en Guatemala, con hora de Guatemala (UTC-6).')).toBeTruthy()
    expect((screen.getByLabelText('Zona horaria') as HTMLSelectElement).value).toBe('America/Guatemala')
    expect(screen.getByText(/^Hora de Guatemala \(UTC-6\)/)).toBeTruthy()
  })

  it('explica que el export es registro interno y que las vistas públicas siguen anónimas', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Exportar'))
    const ayuda = await screen.findByText('Registro interno, solo para gestión.')
    expect(ayuda.parentElement?.textContent).toMatch(/país e IP.*siguen anónimos/)
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Participantes'))
    expect(await screen.findByText('CO 181.50.12.10')).toBeTruthy()
  })

  it('Sala en vivo muestra «Cómo votó la sala» con el conteo 1-3-5-7-9 y cambia a una mesa', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    expect(await screen.findByRole('heading', { name: 'Cómo votó la sala' })).toBeTruthy()
    // Ronda 1 en curso: solo R1, 6 criterios por cada proyecto vivo, cada barra con su conteo accesible.
    const barras = screen.getAllByRole('img', { name: /, ronda 1: / })
    expect(barras).toHaveLength(12)
    expect(screen.queryAllByRole('img', { name: /, ronda 2: / })).toHaveLength(0)
    expect(barras[0].getAttribute('aria-label')).toMatch(/^INSUMEX, Alistamiento técnico, ronda 1: \d+ votos? en 1, .* en 9$/)
    fireEvent.change(screen.getByLabelText('Alcance'), { target: { value: 'm1' } })
    expect(await screen.findByRole('heading', { name: 'Cómo votó la mesa' })).toBeTruthy()
  })

  it('Hojas muestra las 6 hojas de cada proyecto vivo, de solo lectura', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Hojas'))
    const insumex = await screen.findByRole('region', { name: 'INSUMEX' })
    expect(within(insumex).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Conocimiento del cliente',
      'Regulación',
      'Financiero',
      'Técnica y Operaciones',
      'Estratégica',
      'Producción',
    ])
    expect(within(screen.getByRole('region', { name: 'NUTRIWHAT' })).getAllByRole('article')).toHaveLength(6)
    expect(screen.getByText(/solo la hoja de su perfil/)).toBeTruthy()
    expect(document.querySelector('textarea, input:not([type=hidden])')).toBeNull()
    expect(document.body.textContent).not.toContain('\u2014')
  })
})

describe('rúbricas en la configuración de la sala', () => {
  const seccion = () => within(screen.getByRole('region', { name: 'Rúbricas' }))
  const nivel = (v: number) => seccion().getByLabelText(`Nivel ${v}`) as HTMLTextAreaElement
  const botonR = (n: string) => seccion().getByRole('button', { name: n }) as HTMLButtonElement

  async function configuracionDeSalaNueva() {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Rúbricas' } })
    fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Configuración'))
    await screen.findByLabelText('Nivel 9')
  }

  it('abre en Inversión Requerida para Probar, guarda los textos y descarta cambios', async () => {
    await configuracionDeSalaNueva()
    expect((seccion().getByLabelText('Criterio') as HTMLSelectElement).value).toBe('inversion_requerida')
    expect(nivel(9).value).toMatch(/^Inversión muy alta/)
    expect(botonR('Guardar').disabled).toBe(true)

    fireEvent.change(nivel(1), { target: { value: 'Algo que se descarta' } })
    expect((seccion().getByLabelText('Criterio') as HTMLSelectElement).disabled).toBe(true)
    fireEvent.click(botonR('Descartar cambios'))
    expect(nivel(1).value).toMatch(/^Inversión baja/)

    fireEvent.change(nivel(1), { target: { value: 'Inversión baja (< USD 20k)' } })
    fireEvent.click(seccion().getByLabelText(/Usar también en las salas nuevas/))
    fireEvent.click(botonR('Guardar'))
    expect(await seccion().findByText(/Guardamos la rúbrica de Inversión Requerida para Probar.*las salas nuevas también la usarán/)).toBeTruthy()
    expect(nivel(1).value).toBe('Inversión baja (< USD 20k)')
    expect(botonR('Guardar').disabled).toBe(true)
  })

  it('muestra tal cual el 409 del servidor', async () => {
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      metodo === 'PUT' && ruta.includes('/rubricas/')
        ? { status: 409, body: { error: { codigo: 'RUBRICA_CON_VOTOS', mensaje: 'La sala ya tiene votos. Mensaje del servidor.' } } }
        : responderMock(metodo, ruta, cuerpo, etag),
    )
    await configuracionDeSalaNueva()
    fireEvent.change(nivel(5), { target: { value: 'Inversión moderada' } })
    fireEvent.click(botonR('Guardar'))
    expect((await seccion().findByRole('alert')).textContent).toBe('La sala ya tiene votos. Mensaje del servidor.')
  })

  it('con votos deja todo deshabilitado y explica por qué', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(within(screen.getByRole('navigation', { name: 'Secciones del panel' })).getByText('Configuración'))
    await screen.findByLabelText('Nivel 9')
    expect(seccion().getByText(/La sala ya tiene votos/)).toBeTruthy()
    // Deshabilitados por el fieldset: la propiedad disabled de cada campo no cambia, :disabled sí.
    for (const v of [1, 3, 5, 7, 9]) expect(nivel(v).matches(':disabled')).toBe(true)
    expect(seccion().getByLabelText(/Usar también en las salas nuevas/).matches(':disabled')).toBe(true)
    expect(botonR('Guardar').disabled).toBe(true)
  })
})

describe('cambios del 19-oct en el panel', () => {
  const nav = () => within(screen.getByRole('navigation', { name: 'Secciones del panel' }))
  const boton = (n: string) => screen.getByRole('button', { name: n }) as HTMLButtonElement
  const campo = (etiqueta: string) => screen.getByLabelText(etiqueta) as HTMLInputElement

  async function abrirDemo(usuario = 'paola') {
    montar('/admin/login')
    await entrar(usuario)
    fireEvent.click(screen.getByRole('link', { name: 'Abrir' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
  }

  async function salaNueva(nombre: string) {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: nombre } })
    fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
  }

  it('textos: orden de las preguntas guiadas, programación y dominio', () => {
    expect(ORDEN_PREGUNTAS).toHaveLength(12)
    expect(ORDEN_PREGUNTAS[0]).toEqual({ proyecto_id: 'insumex', criterio_id: 'alistamiento_tecnico' })
    expect(ORDEN_PREGUNTAS[6]).toEqual({ proyecto_id: 'nutriwhat', criterio_id: 'alistamiento_tecnico' })
    expect(ORDEN_PREGUNTAS[11]).toEqual({ proyecto_id: 'nutriwhat', criterio_id: 'inversion_requerida' })
    // Servidor anterior a C19-4: los dos cierres de siempre, aunque estén vacíos.
    expect(programaciones({ cierre_programado_ronda_at: null, cierre_programado_sala_at: null }).map((p) => p.texto)).toEqual([
      'Cierre programado de la ronda',
      'Cierre programado de la sala',
    ])
    // Con C19-4: solo lo programado, en el orden del taller.
    const conRondas = programaciones({
      cierre_programado_ronda_at: null,
      cierre_programado_sala_at: '2030-01-10T18:00:00-05:00',
      cierre_programado_r1_at: null,
      apertura_programada_r1_at: '2030-01-10T09:00:00-05:00',
    })
    expect(conRondas.map((p) => p.texto)).toEqual(['Abre la ronda 1', 'Cierra la sala'])
    expect(dominioDistinto('https://horizontes.estratek.com.co/', 'https://horizontes.estratek.com.co')).toBe(false)
    expect(dominioDistinto('https://staging-horizontes.estratek.com.co', 'https://horizontes.estratek.com.co')).toBe(true)
    expect(dominioDistinto('no es una url', 'https://horizontes.estratek.com.co')).toBe(true)
  })

  // A6 (C19-2): el rol admin ve todo lo de una sala igual que el superadmin; solo le falta Administradores.
  it.each([
    ['paola', true],
    ['jorge', false],
  ])('%s recorre cada sección de la sala sin bloqueos', async (usuario, esSuper) => {
    montar('/admin/login')
    await entrar(usuario)
    const secciones = ['Salas', 'Sala en vivo', 'Mesas y QR', 'Participantes', 'Respuestas', 'Hojas', 'Configuración', 'Exportar', 'Salud']
    expect(nav().getAllByRole('link').map((a) => a.textContent)).toEqual(esSuper ? [...secciones, 'Administradores'] : secciones)

    // Primera vez en este navegador: la sección pide la sala y la deja elegir ahí mismo.
    fireEvent.click(nav().getByText('Sala en vivo'))
    await screen.findByRole('heading', { name: 'Elige una sala' })
    fireEvent.click(await screen.findByRole('link', { name: 'Taller Horizontes demo' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    await waitFor(() => expect(boton('Cerrar ronda 1').disabled).toBe(false))

    const esperado: [string, () => Promise<unknown>][] = [
      ['Mesas y QR', () => screen.findByRole('heading', { name: 'Agregar mesas' })],
      ['Participantes', () => screen.findByRole('rowheader', { name: 'Ana Pérez' })],
      ['Respuestas', () => screen.findAllByRole('rowheader', { name: 'Ana Pérez' })],
      ['Hojas', () => screen.findByRole('region', { name: 'INSUMEX' })],
      ['Configuración', () => screen.findByRole('heading', { name: 'Apertura y cierre programados' })],
      ['Exportar', () => screen.findByRole('heading', { name: 'Inscritos' })],
      ['Salud', () => screen.findByText('En línea')],
    ]
    for (const [seccion, ver] of esperado) {
      fireEvent.click(nav().getByText(seccion))
      await ver()
      expect(screen.queryByRole('heading', { name: 'Sin permiso' })).toBeNull()
      expect(screen.queryByText(/No pudimos cargar/)).toBeNull()
    }
    // Configuración completa también para el admin: rúbricas y modo de preguntas.
    fireEvent.click(nav().getByText('Configuración'))
    expect(await screen.findByRole('region', { name: 'Rúbricas' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Preguntas en el celular' })).toBeTruthy()
  })

  it('una sala recordada que ya no existe vuelve a pedir sala', async () => {
    localStorage.setItem('hz_admin_sala', 's_borrada')
    montar('/admin/login')
    await entrar('jorge')
    fireEvent.click(nav().getByText('Participantes'))
    expect(await screen.findByText(/No pudimos cargar la sala\. Esa sala no existe/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Elegir otra sala' })).toBeTruthy()
    await waitFor(() => expect(localStorage.getItem('hz_admin_sala')).toBeNull())
  })

  // A3 (C19-3)
  it('Respuestas muestra lo que calificó cada persona, con filtros por mesa y ronda', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Respuestas'))
    expect(await screen.findByText('Solo administradores. No se proyecta.')).toBeTruthy()
    // En el simulador, 4 personas de la Mesa 1 completaron la ronda 1: una fila por persona y proyecto.
    const tabla = await screen.findByRole('table')
    expect(within(tabla).getAllByRole('row')).toHaveLength(1 + 8)
    expect(within(tabla).getAllByRole('columnheader').map((th) => th.textContent)).toEqual([
      'Nombre',
      'Mesa',
      'Perfil',
      'Ronda',
      'Proyecto',
      'Alistamiento técnico',
      'Conocimiento del cliente',
      'Regulación',
      'Capacidades organizacionales',
      'Alineación con el core',
      'Inversión requerida',
      'Fecha',
    ])
    const ana = within(tabla).getAllByRole('rowheader', { name: 'Ana Pérez' })[0].parentElement!
    expect([...ana.children].slice(0, 11).map((c) => c.textContent)).toEqual(['Ana Pérez', 'Mesa 1', 'Conocimiento del cliente', 'R1', 'INSUMEX', '3', '5', '7', '9', '1', '3'])

    fireEvent.change(screen.getByLabelText('Mesa'), { target: { value: 'm2' } })
    expect(screen.getByText('No hay respuestas con ese filtro.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Mesa'), { target: { value: 'm1' } })
    fireEvent.change(screen.getByLabelText('Ronda'), { target: { value: '2' } })
    expect(screen.getByText('No hay respuestas con ese filtro.')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Ronda'), { target: { value: '1' } })
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + 8)
  })

  it('Respuestas: error del servidor tal cual', async () => {
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      ruta === '/api/admin/salas/s_demo/respuestas'
        ? { status: 403, body: { error: { codigo: 'CAMBIO_CLAVE_REQUERIDO', mensaje: 'Antes de continuar cambia tu clave temporal.' } } }
        : responderMock(metodo, ruta, cuerpo, etag),
    )
    await abrirDemo()
    fireEvent.click(nav().getByText('Respuestas'))
    expect((await screen.findByRole('alert')).textContent).toBe('No pudimos cargar las respuestas. Antes de continuar cambia tu clave temporal.')
  })

  it('Respuestas: sala sin votos', async () => {
    await salaNueva('Sin votos')
    fireEvent.click(nav().getByText('Respuestas'))
    expect(await screen.findByText('Aún nadie ha votado en esta sala.')).toBeTruthy()
  })

  // A2 (C19-4)
  it('programa apertura y cierre por ronda en la hora de la sala, y muestra los rechazos del servidor tal cual', async () => {
    await salaNueva('Programada')
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByRole('heading', { name: 'Apertura y cierre programados' })
    expect(screen.getByText(/^Hora del servidor:/)).toBeTruthy()
    for (const g of ['Sala', 'Ronda 1', 'Ronda 2']) expect(screen.getByRole('group', { name: g })).toBeTruthy()
    const fila = (etiqueta: string) => within(campo(etiqueta).closest('.campo-hora') as HTMLElement)
    const programar = (etiqueta: string, valor: string) => {
      fireEvent.change(campo(etiqueta), { target: { value: valor } })
      fireEvent.click(fila(etiqueta).getByRole('button', { name: 'Programar' }))
    }

    programar('Abrir la ronda 1 el', '2030-01-10T09:00')
    expect((await fila('Abrir la ronda 1 el').findByRole('status')).textContent).toMatch(/^La ronda 1 se abrirá el .*2030/)

    programar('Cerrar la ronda 1 el', '2030-01-10T08:00')
    expect((await fila('Cerrar la ronda 1 el').findByRole('alert')).textContent).toBe('La apertura debe quedar antes del cierre.')
    expect(campo('Cerrar la ronda 1 el').getAttribute('aria-invalid')).toBe('true')

    programar('Cerrar la sala el', '2020-01-10T08:00')
    expect((await fila('Cerrar la sala el').findByRole('alert')).textContent).toBe('Esa hora ya pasó. Elige una hora futura.')

    programar('Abrir la ronda 2 el', '2030-01-10')
    expect((await fila('Abrir la ronda 2 el').findByRole('alert')).textContent).toBe('Elige fecha y hora completas.')

    // Sala en vivo lista lo programado con su cuenta regresiva.
    fireEvent.click(nav().getByText('Sala en vivo'))
    const lista = await screen.findByRole('list', { name: 'Programado' })
    expect(lista.textContent).toMatch(/^Abre la ronda 1: .*2030.* · faltan /)

    fireEvent.click(nav().getByText('Configuración'))
    await waitFor(() => expect(campo('Abrir la ronda 1 el').value).toBe('2030-01-10T09:00'))
    fireEvent.click(fila('Abrir la ronda 1 el').getByRole('button', { name: 'Quitar' }))
    expect((await fila('Abrir la ronda 1 el').findByRole('status')).textContent).toBe('Quitamos la apertura programada de la ronda 1.')
    await waitFor(() => expect(campo('Abrir la ronda 1 el').value).toBe(''))
  })

  it('bloquea lo que ya pasó en la sala y explica por qué', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByLabelText('Abrir la inscripción el')
    // Demo en ronda 1 abierta: la inscripción y la ronda 1 ya se abrieron; lo demás sigue programable.
    expect(campo('Abrir la inscripción el').disabled).toBe(true)
    expect(screen.getByText('La inscripción ya se abrió.')).toBeTruthy()
    expect(campo('Abrir la ronda 1 el').disabled).toBe(true)
    expect(screen.getByText('La ronda 1 ya se abrió.')).toBeTruthy()
    for (const e of ['Cerrar la ronda 1 el', 'Abrir la ronda 2 el', 'Cerrar la ronda 2 el', 'Cerrar la sala el']) expect(campo(e).disabled).toBe(false)
    // El cierre de sala que trae el demo se muestra en la hora de la sala.
    expect(campo('Cerrar la sala el').value).toBe('2026-10-20T18:00')
  })

  // A4 (C19-5)
  it('modo guiado: Anterior, Siguiente y salto a cualquier pregunta desde Sala en vivo', async () => {
    await abrirDemo('jorge')
    expect(screen.queryByRole('heading', { name: 'Pregunta en pantalla' })).toBeNull()
    fireEvent.click(nav().getByText('Configuración'))
    expect(((await screen.findByLabelText(/^Automático/)) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText(/^Guiado/))
    expect(await screen.findByText('Modo guiado: todos ven la pregunta que elijas en Sala en vivo.')).toBeTruthy()

    fireEvent.click(nav().getByText('Sala en vivo'))
    const seccion = within(await screen.findByRole('region', { name: 'Pregunta en pantalla' }))
    expect(seccion.getByText(/Aún no hay pregunta en pantalla/)).toBeTruthy()
    const b = (n: string) => seccion.getByRole('button', { name: n }) as HTMLButtonElement
    expect(b('Anterior').disabled).toBe(true)
    fireEvent.click(b('Siguiente'))
    expect(await seccion.findByText('Pregunta 1 de 12 · ronda 1')).toBeTruthy()
    expect(seccion.getByText('INSUMEX · Nivel de Alistamiento Técnico')).toBeTruthy()
    await waitFor(() => expect(b('Siguiente').disabled).toBe(false))
    fireEvent.click(b('Siguiente'))
    expect(await seccion.findByText('Pregunta 2 de 12 · ronda 1')).toBeTruthy()
    await waitFor(() => expect(b('Anterior').disabled).toBe(false))
    fireEvent.click(b('Anterior'))
    expect(await seccion.findByText('Pregunta 1 de 12 · ronda 1')).toBeTruthy()

    fireEvent.change(seccion.getByLabelText('Proyecto'), { target: { value: 'nutriwhat' } })
    fireEvent.change(seccion.getByLabelText('Pregunta'), { target: { value: 'inversion_requerida' } })
    fireEvent.click(b('Mostrar esta pregunta'))
    expect(await seccion.findByText('Pregunta 12 de 12 · ronda 1')).toBeTruthy()
    expect(seccion.getByText('NUTRIWHAT · Inversión Requerida para Probar')).toBeTruthy()
    await waitFor(() => expect(b('Siguiente').disabled).toBe(true))
    expect(b('Mostrar esta pregunta').disabled).toBe(true)
    // Queda en la bitácora.
    expect(screen.getAllByText(/Pregunta guiada cambiada · jorge/).length).toBeGreaterThan(0)
  })

  it('modo guiado: sin ronda abierta lo explica y un rechazo del servidor sale tal cual', async () => {
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      metodo === 'PUT' && ruta.endsWith('/pregunta-guiada')
        ? { status: 409, body: { error: { codigo: 'RONDA_CERRADA', mensaje: 'La ronda se cerró. Mensaje del servidor.' } } }
        : responderMock(metodo, ruta, cuerpo, etag),
    )
    await salaNueva('Guiada')
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.click(await screen.findByLabelText(/^Guiado/))
    await screen.findByText(/^Modo guiado: todos ven/)
    fireEvent.click(nav().getByText('Sala en vivo'))
    const seccion = within(await screen.findByRole('region', { name: 'Pregunta en pantalla' }))
    expect(seccion.getByText(/Al abrir una ronda, aquí eliges qué pregunta ven todos los celulares/)).toBeTruthy()
    for (const [a, e] of [
      ['Abrir inscripción', 'Inscripción abierta'],
      ['Abrir ronda 1', 'Ronda 1 abierta'],
    ]) {
      await waitFor(() => expect(boton(a).disabled).toBe(false))
      fireEvent.click(boton(a))
      await screen.findByText(e, { selector: '.estado' })
    }
    fireEvent.click(seccion.getByRole('button', { name: 'Siguiente' }))
    expect((await seccion.findByRole('alert')).textContent).toBe('La ronda se cerró. Mensaje del servidor.')
  })

  // A5 (C19-1)
  it('avisa en rojo si BASE_URL no es el dominio desde el que se abre el panel', async () => {
    await abrirDemo()
    expect(screen.queryByText(/Los QR apuntan a/)).toBeNull()
    cleanup()
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      ruta === '/api/admin/salud'
        ? { status: 200, body: { ok: true, base_url: 'https://staging-horizontes.estratek.com.co' } }
        : responderMock(metodo, ruta, cuerpo, etag),
    )
    montar('/admin/salas')
    const aviso = await screen.findByText(/^Los QR apuntan a/)
    expect(aviso.getAttribute('role')).toBe('alert')
    expect(aviso.textContent).toBe(
      `Los QR apuntan a https://staging-horizontes.estratek.com.co, pero estás en ${window.location.origin}. Corrige BASE_URL en Coolify.`,
    )
  })

  it('sin /api/admin/salud toma base_url del detalle de la sala', async () => {
    usarTransporte(async (metodo, ruta, cuerpo, etag) => {
      if (ruta === '/api/admin/salud') return { status: 404, body: { error: { codigo: 'RUTA_NO_EXISTE', mensaje: 'No existe.' } } }
      const r = await responderMock(metodo, ruta, cuerpo, etag)
      return ruta === '/api/admin/salas/s_demo' && r.status === 200 ? { ...r, body: { ...(r.body as object), base_url: 'https://horizontes.com.co' } } : r
    })
    await abrirDemo()
    expect((await screen.findByText(/^Los QR apuntan a/)).textContent).toMatch(/^Los QR apuntan a https:\/\/horizontes\.com\.co, pero estás en /)
  })
})
