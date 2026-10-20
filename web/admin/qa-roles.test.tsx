// @vitest-environment jsdom
// QA por roles del 20-oct (inversionista, Nicolai, Paula, empresa cliente, jurado y Paola CTO), en el panel y contra el
// simulador: métricas y tipo de sala, modo demo, Sala en vivo, Exportar, el panel sin la semilla y los textos.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { CRITERIOS_BASE, contenidoDe } from './contenido'
import { svgDescargable } from './paginas/Exportar'
import tableroEjemplo from '../../mocks/GET_api_tablero.json'
import type { SalaDetalle } from './tipos'

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario = 'paola') {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: 'demo1234' } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
}

const nav = () => within(screen.getByRole('navigation', { name: 'Secciones del panel' }))

/** La sala demo del simulador: ronda 1 abierta, modo guiado, Mesa 1 completa y las demás con gente pendiente. */
async function abrirDemo(usuario = 'paola') {
  montar('/admin/login')
  await entrar(usuario)
  fireEvent.click(screen.getAllByRole('link', { name: 'Abrir' })[0])
  await screen.findByRole('heading', { name: 'Sala en vivo' })
}

beforeEach(() => {
  reiniciarMock({ simularVotos: false })
  localStorage.removeItem('hz_admin_sala')
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
  usarTransporte(responderMock)
})
afterEach(cleanup)

/** Archivos del panel que viajan al navegador (sin pruebas ni el simulador, que solo existe en desarrollo). */
function archivosDelPanel(dir = __dirname): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = join(dir, f)
    if (statSync(ruta).isDirectory()) return f === 'mock' ? [] : archivosDelPanel(ruta)
    return /\.(ts|tsx)$/.test(f) && !/\.test\.tsx?$/.test(f) ? [ruta] : []
  })
}

describe('el panel sin la semilla (fuga de datos del caso)', () => {
  it('ningún archivo del panel importa data/seed_foodsume.json', () => {
    const conSemilla = archivosDelPanel().filter((f) => /(from|import)\s*\(?\s*['"][^'"]*seed_foodsume/.test(readFileSync(f, 'utf8')))
    expect(conSemilla).toEqual([])
  })

  it('los criterios salen en el orden del motor con los nombres cortos compartidos y el detalle manda si los trae', () => {
    expect(CRITERIOS_BASE.map((c) => c.corto)).toEqual([
      'Alistamiento técnico',
      'Conocimiento del cliente',
      'Regulación',
      'Capacidades organizacionales',
      'Alineación con el core',
      'Inversión para probar',
    ])
    const c = contenidoDe(
      { criterios: [{ id: 'regulacion', nombre: 'Regulación vigente', pregunta: '¿Qué tan regulado?' }], proyectos_vivos: [{ id: 'x', nombre: 'X' }], perfiles: [{ id: 'p', nombre: 'P' }] },
      { proyectosVivos: [{ id: 'y', nombre: 'Y' }] },
    )
    expect(c.criterios).toEqual([{ id: 'regulacion', nombre: 'Regulación vigente', corto: 'Regulación', pregunta: '¿Qué tan regulado?' }])
    expect(c.proyectosVivos).toEqual([{ id: 'x', nombre: 'X' }])
    expect(c.perfiles).toEqual([{ id: 'p', nombre: 'P' }])
  })

  it('sin criterios ni proyectos en el detalle, la pregunta guiada y Respuestas los toman de las rúbricas y las hojas de la sala', async () => {
    await abrirDemo()
    const guiada = screen.getByRole('region', { name: 'Pregunta en pantalla' })
    // La pregunta de la sala demo: INSUMEX · Regulación, con su texto de la rúbrica.
    expect(await within(guiada).findByText('INSUMEX · Regulación')).toBeTruthy()
    expect(within(guiada).getByText(/Pregunta 3 de 6 · INSUMEX · ronda 1/)).toBeTruthy()
    const proyecto = within(guiada).getByLabelText('Proyecto') as HTMLSelectElement
    expect([...proyecto.options].map((o) => o.textContent)).toEqual(['INSUMEX', 'NUTRIWHAT'])
    fireEvent.click(nav().getByText('Participantes'))
    const perfil = (await screen.findByLabelText('Perfil de Ana Pérez')) as HTMLSelectElement
    expect([...perfil.options].map((o) => o.textContent)).toContain('Estratégica')
  })
})

describe('Salas: cifras de los talleres, tipo de sala, empresa y sector (inversionista)', () => {
  const cifras = () =>
    Object.fromEntries(
      within(screen.getByRole('region', { name: 'Cifras de los talleres' }))
        .getAllByRole('listitem')
        .map((li) => [li.querySelector('.kpi__rotulo')!.textContent, li.querySelector('.cifra')!.textContent]),
    )

  it('la franja muestra talleres, personas, completaron la ronda 2 y países, sin contar ensayos ni talleres sin personas', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    await responderMock('POST', '/api/admin/salas', { nombre: 'Ensayo de Paola', mesas: 1, tipo: 'ensayo' })
    await responderMock('POST', '/api/admin/salas', { nombre: 'Taller Perú', mesas: 1 })
    const sala = ((await responderMock('GET', '/api/admin/salas')).body as { id: string; nombre: string }[]).find((s) => s.nombre === 'Taller Perú')!
    await responderMock('PATCH', `/api/admin/salas/${sala.id}/config`, { pais: 'PE', zona_horaria: 'America/Lima' })
    await responderMock('POST', '/api/admin/logout')
    montar('/admin/login')
    await entrar()
    await screen.findByRole('region', { name: 'Cifras de los talleres' })
    // Como el servidor: el ensayo y el taller de Perú sin inscritos no cuentan.
    expect(cifras()).toEqual({ Talleres: '1', Personas: '12', 'Completaron la ronda 2': '0', Países: '1' })
    expect(screen.getByText('Colombia')).toBeTruthy()
    expect(screen.getByText('Solo talleres con cliente: los ensayos y las demostraciones no cuentan.')).toBeTruthy()
  })

  it('cada sala dice cuántas personas tiene y los ensayos llevan su insignia', async () => {
    montar('/admin/login')
    await entrar()
    const tarjeta = (nombre: RegExp) => screen.getByRole('heading', { level: 2, name: nombre }).closest('li') as HTMLElement
    const demo = tarjeta(/^Taller Horizontes demo$/)
    expect(within(demo).getByText(/· 12 personas ·/)).toBeTruthy()
    expect(within(demo).queryByText('Ensayo')).toBeNull()
    expect(within(demo).getByText('Empresa ABC · Alimentos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar Taller Horizontes demo para ensayo' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    fireEvent.click(nav().getByRole('link', { name: 'Salas' }))
    await screen.findByRole('heading', { level: 2, name: /^Taller Horizontes demo \(ensayo\)/ })
    const copia = tarjeta(/^Taller Horizontes demo \(ensayo\)/)
    expect(within(copia).getByText('Ensayo').className).toContain('etiqueta--ensayo')
    expect(within(copia).getByText(/· 0 personas ·/)).toBeTruthy()
  })

  it('Nueva sala: placeholder sin marcas, tipo, empresa cliente y sector opcionales que llegan al servidor', async () => {
    montar('/admin/login')
    await entrar()
    const nombre = screen.getByLabelText('Nombre del taller') as HTMLInputElement
    expect(nombre.placeholder).toBe('Ej.: Taller Horizontes, Empresa ABC')
    expect([...(screen.getByLabelText('Tipo') as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(['Taller con cliente', 'Ensayo'])
    expect([...(screen.getByLabelText('Sector (opcional)') as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      '',
      'alimentos',
      'energia',
      'financiero',
      'comercio',
      'salud',
      'manufactura',
      'otro',
    ])
    fireEvent.change(nombre, { target: { value: 'Taller de prueba' } })
    fireEvent.change(screen.getByLabelText('Tipo'), { target: { value: 'ensayo' } })
    fireEvent.change(screen.getByLabelText('Empresa cliente (opcional)'), { target: { value: '  Compañía XYZ ' } })
    fireEvent.change(screen.getByLabelText('Sector (opcional)'), { target: { value: 'energia' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    const nueva = ((await responderMock('GET', '/api/admin/salas')).body as { nombre: string; tipo: string; empresa: string; sector: string }[]).find((s) => s.nombre === 'Taller de prueba')!
    expect([nueva.tipo, nueva.empresa, nueva.sector]).toEqual(['ensayo', 'Compañía XYZ', 'energia'])
  })

  it('Configuración cambia el tipo, la empresa y el sector, con el aviso junto a los campos', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByRole('link', { name: 'Configuración' }))
    const seccion = await screen.findByRole('region', { name: 'Tipo y cliente' })
    const tipo = within(seccion).getByLabelText('Tipo') as HTMLSelectElement
    expect(tipo.value).toBe('taller')
    fireEvent.change(tipo, { target: { value: 'ensayo' } })
    expect((await within(seccion).findByRole('status')).textContent).toBe('La sala quedó como ensayo: no cuenta en las cifras de Salas.')
    fireEvent.change(within(seccion).getByLabelText('Sector (opcional)'), { target: { value: 'salud' } })
    await within(seccion).findByText('El sector quedó como Salud.')
    const empresa = within(seccion).getByLabelText('Empresa cliente (opcional)') as HTMLInputElement
    expect(empresa.value).toBe('Empresa ABC')
    expect(empresa.getAttribute('maxlength')).toBe('80')
    expect((within(seccion).getByRole('button', { name: 'Guardar empresa' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(empresa, { target: { value: 'Otra Empresa' } })
    fireEvent.click(within(seccion).getByRole('button', { name: 'Guardar empresa' }))
    await within(seccion).findByText('La empresa cliente quedó como «Otra Empresa».')
    const lista = (await responderMock('GET', '/api/admin/salas')).body as { id: string; tipo: string; empresa: string; sector: string }[]
    expect(lista.find((s) => s.id === 's_demo')).toMatchObject({ tipo: 'ensayo', empresa: 'Otra Empresa', sector: 'salud' })
  })

  it('el simulador rechaza como el servidor una empresa de más de 80 caracteres, un sector fuera de la lista o un tipo desconocido', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    expect((await responderMock('PATCH', '/api/admin/salas/s_demo/config', { empresa: 'x'.repeat(81) })).status).toBe(422)
    expect((await responderMock('PATCH', '/api/admin/salas/s_demo/config', { sector: 'mineria' })).status).toBe(422)
    expect((await responderMock('POST', '/api/admin/salas', { nombre: 'X', mesas: 1, tipo: 'otro' })).status).toBe(422)
  })
})

describe('modo demo (jurado)', () => {
  it('solo el superadmin ve «Crear demostración», con la explicación en una línea, y abre Sala en vivo de la demostración', async () => {
    montar('/admin/login')
    await entrar()
    const demo = screen.getByRole('region', { name: 'Demostración' })
    expect(within(demo).getByText('Crea la sala «Demostración» con 24 personas simuladas y corre las dos rondas en un minuto. Es un ensayo: no cuenta en las cifras.')).toBeTruthy()
    const boton = within(demo).getByRole('button', { name: 'Crear demostración' })
    // Botón secundario: el principal de Salas sigue siendo «Crear sala».
    expect(boton.className).toContain('hz-boton--secundario')
    expect([...document.querySelectorAll('.hz-boton--primario')].map((b) => b.textContent)).toEqual(['Crear sala'])
    fireEvent.click(boton)
    await screen.findByRole('heading', { level: 1, name: 'Sala en vivo' })
    const meta = (await screen.findByText('Demostración', { selector: '.encabezado-sala__meta strong' })).parentElement as HTMLElement
    expect(within(meta).getByText('Ensayo').className).toContain('etiqueta--ensayo')
    expect(document.title).toBe('Sala en vivo · Demostración · Horizontes')
    const lista = (await responderMock('GET', '/api/admin/salas')).body as { id: string; nombre: string; tipo: string; mesas: number }[]
    const sala = lista.find((s) => s.nombre === 'Demostración')!
    expect([sala.tipo, sala.mesas]).toEqual(['ensayo', 4])
  })

  it('el admin no ve la demostración y el simulador le responde 403', async () => {
    montar('/admin/login')
    await entrar('jorge')
    expect(screen.queryByRole('region', { name: 'Demostración' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Crear demostración' })).toBeNull()
    expect((await responderMock('POST', '/api/admin/demo')).status).toBe(403)
  })

  it('una segunda demostración mientras corre la primera sale con el mensaje del servidor (409)', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    expect((await responderMock('POST', '/api/admin/demo')).status).toBe(201)
    await responderMock('POST', '/api/admin/logout')
    montar('/admin/login')
    await entrar()
    fireEvent.click(screen.getByRole('button', { name: 'Crear demostración' }))
    expect((await screen.findByRole('alert')).textContent).toBe(
      'No pudimos crear la demostración. Ya hay una demostración corriendo. Espera a que termine (dura un minuto) o ábrela desde Salas.',
    )
  })

  it('el simulador corre la demostración como el servidor: 24 personas, las dos rondas en un minuto y el resumen al final', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-20T15:00:00-05:00'))
      await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
      const { sala } = (await responderMock('POST', '/api/admin/demo')).body as { sala: { id: string } }
      const detalle = async () => (await responderMock('GET', `/api/admin/salas/${sala.id}`)).body as SalaDetalle
      vi.setSystemTime(new Date('2026-10-20T15:00:10-05:00'))
      let d = await detalle()
      expect([d.sala.estado, d.participantes.length, d.participantes.every((p) => p.correo.endsWith('@example.com'))]).toEqual(['r1_abierta', 24, true])
      vi.setSystemTime(new Date('2026-10-20T15:00:40-05:00'))
      d = await detalle()
      expect(d.sala.estado).toBe('r2_abierta')
      expect(d.resumen).toBeUndefined()
      vi.setSystemTime(new Date('2026-10-20T15:01:10-05:00'))
      d = await detalle()
      expect(d.sala.estado).toBe('r2_cerrada')
      expect(d.resumen).toMatchObject({ inscritos: 24, completaron_r1: 24, completaron_r2: 24, accesos_nuevos: 0 })
      // Terminada la primera, se puede crear otra.
      expect((await responderMock('POST', '/api/admin/demo')).status).toBe(201)
    } finally {
      vi.useRealTimers()
    }
  })
})

/** Títulos de las secciones de Sala en vivo, en el orden de la página. */
const secciones = () => [...document.querySelectorAll('#contenido section[aria-labelledby] > h2')].map((h) => h.textContent)

describe('Sala en vivo (Nicolai, inversionista y decisión de Paola sobre la ronda 1)', () => {
  it('con la ronda abierta, Mesas va justo después del control y cada mesa con gente pendiente tiene «Ver quién falta»', async () => {
    await abrirDemo()
    const orden = secciones()
    expect(orden.slice(0, 2)).toEqual(['Control de la sala', 'Mesas'])
    const mesas = screen.getByRole('region', { name: 'Mesas' })
    // Mesa 1 terminó (Todos votaron); en Mesa 2 y Mesa 3 falta gente.
    expect(within(mesas).queryByRole('link', { name: 'Ver quién falta en Mesa 1' })).toBeNull()
    expect(within(mesas).getAllByText('Todos votaron')).toHaveLength(1)
    const enlace = within(mesas).getByRole('link', { name: 'Ver quién falta en Mesa 2' })
    expect(enlace.getAttribute('href')).toBe('/admin/salas/s_demo/participantes?mesa=m2&pendientes=1')
    fireEvent.click(enlace)
    await screen.findByRole('heading', { level: 1, name: 'Participantes' })
    expect((screen.getByLabelText('Mesa') as HTMLSelectElement).value).toBe('m2')
    expect((screen.getByLabelText('Solo pendientes') as HTMLInputElement).checked).toBe(true)
    const filas = within(screen.getByRole('region', { name: 'Inscritos' })).getAllByRole('rowheader').map((th) => th.textContent)
    expect(filas).toEqual(['Camila Ortiz', 'Diego Castro', 'Luis Gómez', 'Sofía Mejía'])
    expect(within(screen.getByRole('region', { name: 'Inscritos' })).queryAllByText('Completo')).toHaveLength(0)
  })

  it('Participantes filtra «Solo pendientes» y, si ya terminaron todos, lo dice', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByRole('link', { name: 'Participantes' }))
    const inscritos = await screen.findByRole('region', { name: 'Inscritos' })
    expect(within(inscritos).getAllByRole('rowheader')).toHaveLength(12)
    const casilla = within(inscritos).getByLabelText('Solo pendientes') as HTMLInputElement
    expect(casilla.checked).toBe(false)
    expect(document.getElementById(casilla.getAttribute('aria-describedby')!)?.textContent).toBe('Quienes siguen activos y no han terminado la ronda 1.')
    fireEvent.click(casilla)
    expect(within(inscritos).getAllByRole('rowheader')).toHaveLength(8)
    fireEvent.change(within(inscritos).getByLabelText('Mesa'), { target: { value: 'm1' } })
    expect(within(inscritos).getByText('Nadie está pendiente con ese filtro: ya terminaron todos.')).toBeTruthy()
  })

  it('«Proyectar el tablero» lista las teclas con <kbd> y, con la ronda 1 abierta, explica que el tablero no muestra sus resultados', async () => {
    await abrirDemo()
    const proyectar = screen.getByRole('region', { name: 'Proyectar el tablero' })
    expect(screen.queryByRole('region', { name: 'Ver en vivo' })).toBeNull()
    const teclas = [...proyectar.querySelectorAll('.teclas__lista kbd')].map((k) => k.textContent)
    expect(teclas).toEqual(['F', 'G', 'D', 'M', 'V', '1', '2', 'C', '→', '←', '?'])
    expect(within(proyectar.querySelector('.teclas__lista') as HTMLElement).getByText('Comparación; otra vez, repite la animación')).toBeTruthy()
    expect(within(proyectar).getByText(/^Con la ronda 1 abierta, el tablero muestra cuántos votaron, pero no los resultados: aparecen cuando todos hayan votado o al cerrar la ronda\./)).toBeTruthy()
    // Las teclas ya no van en un párrafo.
    expect(document.getElementById('ayuda-tablero-sala')?.textContent).not.toMatch(/G y D cambian de modo/)
  })

  it('con la ronda 2 abierta no repite el aviso de la ronda 1', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    for (const accion of ['cerrar_ronda_1', 'abrir_ronda_2']) await responderMock('POST', '/api/admin/salas/s_demo/acciones', { accion })
    await responderMock('POST', '/api/admin/logout')
    await abrirDemo()
    await screen.findByText('Ronda 2 abierta', { selector: '.estado' })
    expect(screen.queryByText(/^Con la ronda 1 abierta/)).toBeNull()
  })

  it('con la ronda 2 cerrada, «Resumen del taller» va sobre la bitácora con los minutos, la completitud y los accesos de nuevo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-20T15:00:00-05:00'))
      await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
      const accion = (a: string) => responderMock('POST', '/api/admin/salas/s_demo/acciones', { accion: a })
      // La sala demo ya tiene la ronda 1 abierta: se reabre la cuenta desde aquí (el simulador mide desde ronda_abierta).
      await accion('cerrar_ronda_1')
      await accion('reabrir_ronda')
      await responderMock('POST', '/api/admin/participantes/p_2/acceso')
      vi.setSystemTime(new Date('2026-10-20T15:12:00-05:00'))
      await accion('cerrar_ronda_1')
      await accion('abrir_ronda_2')
      vi.setSystemTime(new Date('2026-10-20T15:30:30-05:00'))
      await accion('cerrar_ronda_2')
      await responderMock('POST', '/api/admin/logout')
    } finally {
      vi.useRealTimers()
    }
    await abrirDemo()
    const resumen = await screen.findByRole('region', { name: 'Resumen del taller' })
    const cifras = Object.fromEntries(within(resumen).getAllByRole('listitem').map((li) => [li.querySelector('.kpi__rotulo')!.textContent, li.querySelector('.cifra')!.textContent]))
    expect(cifras).toEqual({
      'Duración de la ronda 1': '12 min',
      'Duración de la ronda 2': '18,5 min',
      'Completaron la ronda 1': '12 de 12',
      'Completaron la ronda 2': '0 de 12',
      'Accesos de nuevo': '1',
    })
    const orden = secciones()
    expect(orden.indexOf('Resumen del taller')).toBe(orden.indexOf('Bitácora de la sala') - 1)
    // Sin ronda abierta, Mesas vuelve a su lugar después de Proyectar el tablero.
    expect(orden.indexOf('Mesas')).toBeGreaterThan(orden.indexOf('Proyectar el tablero'))
  })
})

describe('Exportar (empresa cliente y Nicolai)', () => {
  async function abrirExportar() {
    await abrirDemo()
    fireEvent.click(nav().getByRole('link', { name: 'Exportar' }))
    return screen.findByRole('region', { name: 'Resultados' })
  }

  it('«Resultados» es el archivo para el cliente; inscritos y votos dicen que no se entregan y que los votos son dato personal', async () => {
    const resultados = await abrirExportar()
    expect(within(resultados).getByText('Promedios por criterio y posición de cada proyecto, por sala y por mesa, en R1 y R2. Sin nombres ni IP: es el archivo para entregar al cliente.')).toBeTruthy()
    expect(within(resultados).getByRole('button', { name: 'Descargar resultados.csv' })).toBeTruthy()
    expect(within(resultados).getByRole('button', { name: 'Descargar matriz (SVG)' })).toBeTruthy()
    const inscritos = screen.getByRole('region', { name: 'Inscritos' })
    expect(within(inscritos).getByText(/No se entregan al cliente\.$/)).toBeTruthy()
    const votos = screen.getByRole('region', { name: 'Votos' })
    expect(within(votos).getByText(/No se entregan al cliente\. Seudonimizado, no anónimo: con mesa, perfil e IP se sabe quién es\. Trátalo como dato personal\.$/)).toBeTruthy()
    // Lo del cliente va antes que el registro interno.
    expect([...document.querySelectorAll('.titulo-grupo')].map((h) => h.textContent)).toEqual(['Para entregar al cliente', 'Registro interno'])
  })

  it('el simulador entrega resultados.csv sin datos personales', async () => {
    await responderMock('POST', '/api/admin/login', { usuario: 'paola', clave: 'demo1234' })
    const csv = String((await responderMock('GET', '/api/admin/salas/s_demo/export/resultados.csv')).body)
    const [encabezado] = csv.replace(/^﻿/, '').split('\n')
    expect(encabezado.split(',')).toEqual([
      'alcance',
      'ronda',
      'proyecto',
      'n_votos',
      'alistamiento_tecnico',
      'conocimiento_cliente',
      'regulacion',
      'capacidades_organizacionales',
      'alineacion_core',
      'inversion_requerida',
      't2m',
      'eje_x',
      'eje_y',
    ])
    expect(csv).not.toMatch(/@|181\.50/)
  })

  it('«Descargar matriz (SVG)» descarga la matriz del tablero de la sala con fondo', async () => {
    const blobs: Blob[] = []
    const crear = URL.createObjectURL
    const revocar = URL.revokeObjectURL
    URL.createObjectURL = (b: Blob) => {
      blobs.push(b)
      return 'blob:x'
    }
    URL.revokeObjectURL = () => undefined
    const descargas: string[] = []
    const clic = HTMLAnchorElement.prototype.click
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      descargas.push(this.download)
    }
    try {
      const resultados = await abrirExportar()
      fireEvent.click(within(resultados).getByRole('button', { name: 'Descargar matriz (SVG)' }))
      await waitFor(() => expect(descargas).toEqual(['HZ7K2-matriz.svg']))
      expect(blobs[0].type).toContain('image/svg+xml')
      const svg = await new Promise<string>((ok) => {
        const r = new FileReader()
        r.onload = () => ok(String(r.result))
        r.readAsText(blobs[0])
      })
      expect(svg).toMatch(/^<svg[^>]*><rect width="100%" height="100%" fill="/)
      expect(svg).toContain('INSUMEX')
    } finally {
      URL.createObjectURL = crear
      URL.revokeObjectURL = revocar
      HTMLAnchorElement.prototype.click = clic
    }
  })

  it('el SVG descargado cambia los tokens de color por sus valores del tema', () => {
    const valores: Record<string, string> = { '--hz-r1': '#1B7F3A', '--hz-r2': '#C62828', '--hz-fondo': '#FFFFFF' }
    const estilo = { getPropertyValue: (n: string) => valores[n] ?? '' } as unknown as CSSStyleDeclaration
    const svg = svgDescargable(tableroEjemplo, 'r2_cerrada', 2, estilo)
    expect(svg).toContain('#C62828')
    expect(svg).toContain('<rect width="100%" height="100%" fill="#FFFFFF"/>')
  })
})
