// @vitest-environment jsdom
// Panel admin contra la API real de T1 (Fastify en memoria con BD SQLite :memory: y reloj simulado).
// El transporte del panel se conecta a app.inject y guarda la cookie de sesión como lo haría el navegador.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { type Transporte, usarTransporte } from './api'
import { type Entorno, crearEntorno, inscribir, votar } from '../../tests/server/ayuda'

let e: Entorno
let cookie = ''

const transporteInject: Transporte = async (metodo, ruta, cuerpo, etag) => {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  if (etag) headers['if-none-match'] = etag
  const r = await e.app.inject({ method: metodo as 'GET', url: ruta, payload: cuerpo as object | undefined, headers })
  const c = r.cookies.find((x) => x.name === 'hz_admin')
  if (c) cookie = c.value ? `hz_admin=${c.value}` : ''
  const tipo = String(r.headers['content-type'] ?? '')
  const body = r.statusCode === 304 || !r.body ? null : tipo.includes('json') ? r.json() : r.body
  const et = r.headers.etag
  return { status: r.statusCode, body, etag: typeof et === 'string' ? et : undefined }
}

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <Routes>
        <Route path="/admin/*" element={<PaginaAdmin />} />
      </Routes>
    </MemoryRouter>,
  )
}

async function entrar(usuario: string, clave: string) {
  fireEvent.change(await screen.findByLabelText('Usuario'), { target: { value: usuario } })
  fireEvent.change(screen.getByLabelText('Clave'), { target: { value: clave } })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

const nav = () => within(screen.getByRole('navigation', { name: 'Secciones del panel' }))
const boton = (n: string) => screen.getByRole('button', { name: n }) as HTMLButtonElement

async function crearSalaDesdePanel(nombre: string, mesas: number) {
  await screen.findByRole('heading', { level: 1, name: 'Salas' })
  fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: nombre } })
  fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: String(mesas) } })
  fireEvent.click(boton('Crear sala'))
  await screen.findByRole('heading', { name: 'Sala en vivo' })
  await screen.findByText('Preparada', { selector: '.estado' })
  const fila = e.db.prepare('SELECT id FROM salas WHERE nombre = ?').get(nombre) as { id: string }
  const mesasBd = e.db.prepare('SELECT id, codigo FROM mesas WHERE sala_id = ? ORDER BY numero').all(fila.id) as { id: string; codigo: string }[]
  return { salaId: fila.id, mesas: mesasBd }
}

async function pasar(accion: string, estado: string) {
  await waitFor(() => expect(boton(accion).disabled).toBe(false))
  fireEvent.click(boton(accion))
  await screen.findByText(estado, { selector: '.estado' }, { timeout: 3000 })
}

beforeEach(async () => {
  e = await crearEntorno()
  cookie = ''
  usarTransporte(transporteInject)
})
afterEach(async () => {
  cleanup()
  await e.app.close()
})

describe('panel admin contra la API real', () => {
  it('crea una sala y recorre el ciclo completo con votos reales y precierre', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId, mesas } = await crearSalaDesdePanel('Ensayo real', 2)

    await pasar('Abrir inscripción', 'Inscripción abierta')
    const tokens: string[] = []
    for (const [i, correo] of ['ana@x.co', 'beto@x.co'].entries()) {
      const r = await inscribir(e, mesas[0].codigo, correo, `Persona ${i + 1}`)
      expect(r.statusCode).toBe(201)
      tokens.push(r.json().token)
    }
    // Alguien en la Mesa 2 que no vota: el precierre es solo de la Mesa 1.
    expect((await inscribir(e, mesas[1].codigo, 'caro@x.co', 'Persona 3')).statusCode).toBe(201)
    await pasar('Abrir ronda 1', 'Ronda 1 abierta')
    for (const t of tokens) {
      for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, t, p, 1)).statusCode).toBe(200)
    }
    // Precierre de la Mesa 1: avisa sin cerrar la ronda y muestra el resultado preliminar.
    expect(await screen.findByText(/Todos votaron en Mesa 1/, undefined, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
    fireEvent.click(boton('Ver resultado de Mesa 1'))
    expect(await screen.findByRole('heading', { name: /Resultado preliminar · Mesa 1/ })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'INSUMEX' })).toBeTruthy()

    await pasar('Cerrar ronda 1', 'Ronda 1 cerrada')
    await pasar('Abrir ronda 2', 'Ronda 2 abierta')
    await pasar('Cerrar ronda 2', 'Ronda 2 cerrada')
    fireEvent.click(boton('Cerrar sala'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la sala' }))
    await screen.findByText('Sala cerrada', { selector: '.estado' })
    expect((e.db.prepare('SELECT estado FROM salas WHERE id = ?').get(salaId) as { estado: string }).estado).toBe('cerrada')
  }, 20_000)

  it('configura visibilidad y cierres, agrega mesas y reasigna participantes', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId, mesas } = await crearSalaDesdePanel('Config real', 2)
    // Configuración
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.click(await screen.findByLabelText(/Todos ven la sala completa/))
    await screen.findByText('Ahora todos ven el resultado de toda la sala.')
    fireEvent.click(screen.getByLabelText(/Tablero en vivo/))
    await screen.findByText('Tras votar, el participante ve el tablero en vivo.')
    const r = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(r.json().sala.config).toMatchObject({ alcance_resultados: 'sala', vista_participante: 'en_vivo' })

    // Cierre programado de la ronda en hora Bogotá: el servidor lo aplica al llegar la hora.
    fireEvent.change(screen.getByLabelText('Cerrar la ronda abierta el'), { target: { value: '2026-10-20T14:30' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Programar' })[0])
    await screen.findByText(/La ronda se cerrará el/)
    const r2 = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(Date.parse(r2.json().sala.config.cierre_programado_ronda_at)).toBe(Date.parse('2026-10-20T14:30:00-05:00'))

    // Mesas y QR
    fireEvent.click(nav().getByText('Mesas y QR'))
    await screen.findByRole('heading', { name: 'Agregar mesas' })
    expect(screen.getAllByRole('img', { name: /QR/ }).length).toBe(2)
    fireEvent.click(boton('Agregar'))
    await waitFor(() => expect(screen.getAllByRole('img', { name: /QR/ }).length).toBe(3))

    // Participantes: reasignar mesa y perfil, desactivar
    await e.app.inject({ method: 'POST', url: `/api/admin/salas/${salaId}/acciones`, headers: { cookie }, payload: { accion: 'abrir_inscripcion' } })
    const ins = await inscribir(e, mesas[0].codigo, 'carla@x.co', 'Carla Ruiz')
    expect(ins.statusCode).toBe(201)
    await e.app.inject({ method: 'POST', url: `/api/admin/salas/${salaId}/acciones`, headers: { cookie }, payload: { accion: 'abrir_ronda_1' } })
    e.reloj.ms = Date.parse('2026-10-20T14:31:00-05:00')
    await e.app.inject({ method: 'GET', url: '/api/health' })
    const r3 = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(r3.json().sala.estado).toBe('r1_cerrada')
    fireEvent.click(nav().getByText('Participantes'))
    const selMesa = (await screen.findByLabelText('Mesa de Carla Ruiz')) as HTMLSelectElement
    fireEvent.change(selMesa, { target: { value: mesas[1].id } })
    await screen.findByText('Carla Ruiz pasó a Mesa 2.')
    fireEvent.change(screen.getByLabelText('Perfil de Carla Ruiz'), { target: { value: 'regulacion' } })
    await screen.findByText(/Carla Ruiz ahora tiene el perfil/)
    fireEvent.click(boton('Desactivar'))
    await screen.findByText(/Carla Ruiz quedó inactivo/)
    const p = e.db.prepare('SELECT mesa_id, perfil_id, activo FROM participantes WHERE correo = ?').get('carla@x.co') as Record<string, unknown>
    expect(p).toMatchObject({ mesa_id: mesas[1].id, perfil_id: 'regulacion', activo: 0 })
  }, 20_000)

  it('el superadmin crea un admin y ese admin cambia la clave en su primer ingreso', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    fireEvent.click(nav().getByText('Administradores'))
    await screen.findByRole('heading', { name: 'Nuevo administrador' })
    fireEvent.change(screen.getByLabelText('Usuario'), { target: { value: 'nicolai' } })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Nicolai' } })
    fireEvent.change(screen.getByLabelText('Clave temporal'), { target: { value: 'temporal-12345' } })
    fireEvent.click(boton('Crear administrador'))
    expect(await screen.findByText(/Creamos la cuenta de Nicolai/)).toBeTruthy()
    expect(await screen.findByRole('rowheader', { name: 'Nicolai' })).toBeTruthy()

    // Sale y entra el admin nuevo: primero debe cambiar la clave.
    cleanup()
    cookie = ''
    montar('/admin/login')
    await entrar('nicolai', 'temporal-12345')
    await screen.findByRole('heading', { name: 'Cambia tu clave' })
    fireEvent.change(screen.getByLabelText('Clave temporal'), { target: { value: 'temporal-12345' } })
    fireEvent.change(screen.getByLabelText('Clave nueva'), { target: { value: 'definitiva-6789' } })
    fireEvent.change(screen.getByLabelText('Repite la clave nueva'), { target: { value: 'definitiva-6789' } })
    fireEvent.click(boton('Guardar clave'))
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    // Admin normal: sin menú de administradores y la API responde 403.
    expect(nav().queryByText('Administradores')).toBeNull()
    cleanup()
    montar('/admin/administradores')
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeTruthy()
  }, 20_000)

  it('exporta inscritos.csv desde la API real', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId } = await crearSalaDesdePanel('Export real', 1)
    const r = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}/export/inscritos.csv`, headers: { cookie } })
    expect(r.statusCode).toBe(200)
    expect(String(r.headers['content-type'])).toContain('text/csv')
    fireEvent.click(nav().getByText('Export'))
    expect(await screen.findByRole('heading', { name: /inscritos/i })).toBeTruthy()
  }, 20_000)
})
