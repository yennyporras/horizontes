// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { ACCIONES_POR_ESTADO, estadoMesa, faltan, horaLocalAIso, isoAHoraLocal, rutaApiTablero, textoEvento, urlTableroSala, zonaSala } from './textos'

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
