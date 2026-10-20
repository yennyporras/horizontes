// @vitest-environment jsdom
// Panel admin contra la API real (Fastify en memoria con BD SQLite :memory: y reloj simulado).
// El transporte del panel se conecta a app.inject y guarda la cookie de sesión como lo haría el navegador.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { type Transporte, usarTransporte } from './api'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, loginCookie, votar } from '../../tests/server/ayuda'

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
/** Campos de la programación (C19-4) dentro de su grupo: «Ronda 1» → «Cerrar el». */
const enGrupo = (grupo: string) => within(screen.getByRole('group', { name: grupo }))
const programar = (grupo: string, etiqueta: string, valor: string) => {
  const campo = enGrupo(grupo).getByLabelText(etiqueta)
  fireEvent.change(campo, { target: { value: valor } })
  fireEvent.click(within(campo.closest('.campo-hora') as HTMLElement).getByRole('button', { name: 'Programar' }))
}

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
  localStorage.removeItem('hz_admin_sala')
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
    expect(await screen.findByText(/Todos votaron en Mesa 1/, { selector: 'strong' }, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByText('Ronda 1 abierta', { selector: '.estado' })).toBeTruthy()
    fireEvent.click(boton('Ver resultado de Mesa 1'))
    expect(await screen.findByRole('heading', { name: /Resultado preliminar · Mesa 1/ })).toBeTruthy()
    const tabla = screen.getByRole('table', { name: 'INSUMEX' })
    // Preentrega 19-oct: los 6 criterios, sin fila «Total».
    expect(within(tabla).queryByRole('rowheader', { name: 'Total' })).toBeNull()
    expect(within(tabla).getAllByRole('rowheader')).toHaveLength(6)

    // QA-A-06: la persona de la Mesa 2 no votó: cerrar la ronda lo advierte y pide confirmación.
    fireEvent.click(boton('Cerrar ronda 1'))
    const aviso = await screen.findByRole('dialog', { name: '¿Cerrar la ronda 1 con 1 persona sin terminar?' })
    expect(within(aviso).getByText(/1 persona de 3 no ha terminado de votar/)).toBeTruthy()
    expect(document.activeElement?.textContent).toBe('Cancelar')
    fireEvent.click(within(aviso).getByRole('button', { name: 'Sí, cerrar la ronda 1' }))
    await screen.findByText('Ronda 1 cerrada', { selector: '.estado' }, { timeout: 3000 })
    await pasar('Abrir ronda 2', 'Ronda 2 abierta')
    fireEvent.click(boton('Cerrar ronda 2'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la ronda 2' }))
    await screen.findByText('Ronda 2 cerrada', { selector: '.estado' }, { timeout: 3000 })
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
    // Acta A2 (C5): la sala nace mostrando toda la sala, en vivo tras votar. Se cambia a mesa y registrado, y se vuelve a sala.
    const sala = (await screen.findByLabelText(/Todos ven la sala completa/)) as HTMLInputElement
    expect(sala.checked).toBe(true)
    expect((screen.getByLabelText(/Resultado en vivo/) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText(/Cada mesa ve su resultado/))
    await screen.findByText('Ahora cada mesa ve solo su resultado.')
    fireEvent.click(screen.getByLabelText(/Voto registrado/))
    await screen.findByText('Tras votar, el participante ve «Voto registrado».')
    const r0 = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(r0.json().sala.config).toMatchObject({ alcance_resultados: 'mesa', vista_participante: 'registrado' })
    await waitFor(() => expect(sala.checked).toBe(false))
    fireEvent.click(sala)
    await screen.findByText('Ahora todos ven el resultado de toda la sala.')
    const r = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(r.json().sala.config).toMatchObject({ alcance_resultados: 'sala', vista_participante: 'registrado' })

    // Cierre programado de la ronda 1 en hora Bogotá: el servidor lo aplica al llegar la hora.
    programar('Ronda 1', 'Cerrar el', '2026-10-20T14:30')
    await screen.findByText(/La ronda 1 se cerrará el/)
    const r2 = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(Date.parse(r2.json().sala.config.cierre_programado_r1_at)).toBe(Date.parse('2026-10-20T14:30:00-05:00'))
    // El alias de antes sigue leyendo el cierre de la próxima ronda.
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
    fireEvent.click(boton('Desactivar a Carla Ruiz'))
    await screen.findByText(/Carla Ruiz quedó inactivo/)
    const p = e.db.prepare('SELECT mesa_id, perfil_id, activo FROM participantes WHERE correo = ?').get('carla@x.co') as Record<string, unknown>
    expect(p).toMatchObject({ mesa_id: mesas[1].id, perfil_id: 'regulacion', activo: 0 })
  }, 20_000)

  it('una sala de Guatemala programa el cierre en hora de Guatemala (UTC-6)', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId } = await crearSalaDesdePanel('Sala GT', 1)
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.change(await screen.findByLabelText('País de la sala'), { target: { value: 'GT' } })
    await screen.findByText('La sala quedó en Guatemala, con hora de Guatemala (UTC-6).')
    const r = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(r.json().sala.config).toMatchObject({ pais: 'GT', zona_horaria: 'America/Guatemala' })

    // 16:00 en Guatemala son las 17:00 en Bogotá: el servidor guarda ese instante y el panel lo muestra como 16:00 (4:00 p. m.).
    await screen.findByText(/^Hora de Guatemala \(UTC-6\)/)
    programar('Ronda 1', 'Cerrar el', '2026-10-20T16:00')
    await screen.findByText(/La ronda 1 se cerrará el .*4:00/)
    const r2 = await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })
    expect(Date.parse(r2.json().sala.config.cierre_programado_r1_at)).toBe(Date.parse('2026-10-20T16:00:00-06:00'))
    await waitFor(() => expect((enGrupo('Ronda 1').getByLabelText('Cerrar el') as HTMLInputElement).value).toBe('2026-10-20T16:00'))
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
    fireEvent.click(nav().getByText('Exportar'))
    expect(await screen.findByRole('heading', { name: /inscritos/i })).toBeTruthy()
  }, 20_000)

  it('duplica una sala para ensayo contra la API real: mismas mesas, sin inscritos', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    await crearSalaDesdePanel('Original real', 3)
    fireEvent.click(nav().getByText('Salas'))
    fireEvent.click(await screen.findByRole('button', { name: 'Duplicar Original real para ensayo' }))
    await screen.findByText('Original real (ensayo)')
    await screen.findByText('Preparada', { selector: '.estado' })
    const copia = e.db.prepare('SELECT id FROM salas WHERE nombre = ?').get('Original real (ensayo)') as { id: string }
    expect((e.db.prepare('SELECT COUNT(*) AS n FROM mesas WHERE sala_id = ?').get(copia.id) as { n: number }).n).toBe(3)
    expect((e.db.prepare('SELECT COUNT(*) AS n FROM participantes WHERE sala_id = ?').get(copia.id) as { n: number }).n).toBe(0)
  }, 20_000)

  it('edita la rúbrica de inversión contra la API real y el celular la recibe', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId, mesas } = await crearSalaDesdePanel('Rúbrica real', 1)
    fireEvent.click(nav().getByText('Configuración'))
    const rubricas = within(await screen.findByRole('region', { name: 'Rúbricas' }))
    fireEvent.change(await rubricas.findByLabelText('Nivel 9'), { target: { value: 'Inversión muy alta (> USD 2MM)' } })
    fireEvent.click(rubricas.getByRole('button', { name: 'Guardar' }))
    expect(await rubricas.findByText(/Guardamos la rúbrica de Inversión Requerida para Probar/)).toBeTruthy()

    expect((await accion(e, salaId, 'abrir_inscripcion')).statusCode).toBe(200)
    const token = (await inscribir(e, mesas[0].codigo, 'ana@x.co')).json().token as string
    const yo = await e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': token } })
    const inversion = (yo.json().criterios as { id: string; rubrica: { valor: number; texto: string }[] }[]).find((c) => c.id === 'inversion_requerida')!
    expect(inversion.rubrica[0]).toEqual({ valor: 9, texto: 'Inversión muy alta (> USD 2MM)' })
  })

  it('«Cómo votó la sala» con los conteos reales (mínimo de 3 votos) y las 6 hojas de cada proyecto', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId, mesas } = await crearSalaDesdePanel('Dispersión real', 1)
    await pasar('Abrir inscripción', 'Inscripción abierta')
    const tokens: string[] = []
    for (const correo of ['ana@x.co', 'beto@x.co', 'caro@x.co']) tokens.push((await inscribir(e, mesas[0].codigo, correo)).json().token)
    await pasar('Abrir ronda 1', 'Ronda 1 abierta')
    const resp = (v: number) => ({ alistamiento_tecnico: v, conocimiento_cliente: v, regulacion: v, capacidades_organizacionales: v, alineacion_core: v, inversion_requerida: v })
    // Con 2 votos por proyecto la sala está bajo el mínimo: aviso, sin barras.
    for (const [i, v] of [1, 9].entries()) for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, tokens[i], p, 1, resp(v))).statusCode).toBe(200)
    // El texto viene del componente del tablero; la concordancia («Hacen falta», F-12) la corrige esa área.
    expect(await screen.findByText(/^Hacen? falta al menos 3 votos para mostrar estos resultados en la ronda 1\.$/, {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryAllByRole('img', { name: /ronda 1:/ })).toHaveLength(0)
    for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, tokens[2], p, 1, resp(9))).statusCode).toBe(200)
    const barra = await screen.findByRole('img', { name: /^NUTRIWHAT, Regulación, ronda 1:/ }, { timeout: 5000 })
    expect(barra.getAttribute('aria-label')).toBe('NUTRIWHAT, Regulación, ronda 1: 1 voto en 1, 0 votos en 3, 0 votos en 5, 0 votos en 7, 2 votos en 9')
    expect(screen.getAllByRole('img', { name: /ronda 1:/ })).toHaveLength(12)

    fireEvent.click(nav().getByText('Hojas'))
    const nutriwhat = await screen.findByRole('region', { name: 'NUTRIWHAT' })
    expect(within(nutriwhat).getAllByRole('article')).toHaveLength(6)
    const api = (await e.app.inject({ url: `/api/admin/salas/${salaId}/hojas`, headers: { cookie } })).json().hojas as { proyecto_id: string; perfil: string; texto: string }[]
    const reg = api.find((h) => h.proyecto_id === 'nutriwhat' && h.perfil === 'Regulación')!
    expect(within(nutriwhat).getByRole('article', { name: 'Regulación' }).textContent).toContain(reg.texto)
  })
})

describe('cambios del 19-oct contra la API real', () => {
  // A6 (C19-2): un admin de rol admin ve y usa todo lo de la sala de otra persona; solo le falta Administradores.
  it('un admin recorre cada sección de una sala creada por el superadmin', async () => {
    const creado = await e.app.inject({
      method: 'POST',
      url: '/api/admin/admins',
      headers: { cookie: e.cookie },
      payload: { usuario: 'jorge', nombre: 'Jorge Puentes', clave_temporal: 'temporal-12345' },
    })
    expect(creado.statusCode).toBe(201)
    const cj = await loginCookie(e.app, 'jorge', 'temporal-12345')
    const cambio = await e.app.inject({ method: 'POST', url: '/api/admin/cambiar-clave', headers: { cookie: cj }, payload: { actual: 'temporal-12345', nueva: 'definitiva-6789' } })
    expect(cambio.statusCode).toBe(200)
    const sala = await crearSala(e, 1, 'Sala de Paola')
    expect((await accion(e, sala.id, 'abrir_inscripcion')).statusCode).toBe(200)
    const tokens: string[] = []
    for (const i of [1, 2, 3]) tokens.push((await inscribir(e, sala.mesas[0].codigo, `p${i}@x.co`, `Persona ${i}`)).json().token)
    expect((await accion(e, sala.id, 'abrir_ronda_1')).statusCode).toBe(200)
    for (const t of tokens) expect((await votar(e, t, 'insumex', 1)).statusCode).toBe(200)

    montar('/admin/login')
    await entrar('jorge', 'definitiva-6789')
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    expect(nav().getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Salas',
      'Sala en vivo',
      'Mesas y QR',
      'Participantes',
      'Respuestas',
      'Hojas',
      'Configuración',
      'Exportar',
      'Salud',
    ])
    fireEvent.click(nav().getByText('Sala en vivo'))
    fireEvent.click(await screen.findByRole('link', { name: 'Sala de Paola' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    await waitFor(() => expect(boton('Cerrar ronda 1').disabled).toBe(false))

    const esperado: [string, () => Promise<unknown>][] = [
      ['Mesas y QR', () => screen.findByRole('heading', { name: 'Agregar mesas' })],
      ['Participantes', () => screen.findByRole('rowheader', { name: 'Persona 1' })],
      ['Respuestas', () => screen.findByRole('rowheader', { name: 'Persona 1' })],
      ['Hojas', () => screen.findByRole('region', { name: 'INSUMEX' })],
      ['Configuración', () => screen.findByRole('region', { name: 'Rúbricas' })],
      ['Exportar', () => screen.findByRole('heading', { name: 'Inscritos' })],
      ['Salud', () => screen.findByText('Todo bien')],
    ]
    for (const [seccion, ver] of esperado) {
      fireEvent.click(nav().getByText(seccion))
      await ver()
      expect(screen.queryByRole('heading', { name: 'Sin permiso' })).toBeNull()
      expect(screen.queryByText(/No pudimos cargar/)).toBeNull()
    }
    // Respuestas con los votos reales: una fila por persona en INSUMEX, con sus 6 valores.
    fireEvent.click(nav().getByText('Respuestas'))
    const fila = (await screen.findByRole('rowheader', { name: 'Persona 1' })).parentElement!
    expect([...fila.children].slice(1, 11).map((c) => c.textContent)).toEqual(['Mesa 1', expect.any(String), 'R1', 'INSUMEX', '5', '5', '5', '5', '5', '5'])
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(1 + 3)
    cleanup()
    montar('/admin/administradores')
    expect(await screen.findByRole('heading', { name: 'Sin permiso' })).toBeTruthy()
  }, 20_000)

  // A2 (C19-4)
  it('programa aperturas y cierres; el servidor rechaza tal cual y abre la ronda 1 a su hora', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId } = await crearSalaDesdePanel('Programada real', 1)
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByRole('heading', { name: 'Apertura y cierre programados' })
    // El reloj del servidor de prueba está en el 20-oct a las 2:00 p. m. de Bogotá.
    expect(screen.getByText(/^Hora del servidor:/).textContent).toMatch(/2026.*2:00/)

    programar('Sala', 'Abrir inscripción el', '2026-10-20T14:10')
    await screen.findByText(/^La inscripción se abrirá el/)
    programar('Ronda 1', 'Abrir el', '2026-10-20T14:20')
    await screen.findByText(/^La ronda 1 se abrirá el/)
    programar('Ronda 1', 'Cerrar el', '2026-10-20T14:15')
    expect((await enGrupo('Ronda 1').findByRole('alert')).textContent).toBe('La apertura de la ronda 1 debe ser antes que el cierre de la ronda 1.')
    programar('Sala', 'Cerrar la sala el', '2026-10-20T13:00')
    expect((await enGrupo('Sala').findByRole('alert')).textContent).toBe('Esa hora ya pasó. En el servidor son las 14:00:00; elige una hora posterior.')

    const config = (await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })).json().sala.config
    expect(Date.parse(config.apertura_programada_sala_at)).toBe(Date.parse('2026-10-20T14:10:00-05:00'))
    expect(Date.parse(config.apertura_programada_r1_at)).toBe(Date.parse('2026-10-20T14:20:00-05:00'))
    expect(config.cierre_programado_r1_at).toBeNull()

    // A las 2:21 p. m. el servidor ya abrió la inscripción y la ronda 1.
    e.reloj.ms = Date.parse('2026-10-20T14:21:00-05:00')
    await e.app.inject({ method: 'GET', url: '/api/health' })
    fireEvent.click(nav().getByText('Sala en vivo'))
    await screen.findByText('Ronda 1 abierta', { selector: '.estado' }, { timeout: 5000 })
    // QA-A-15: la bitácora dice qué se abrió a la hora programada, sin repetirlo con «Apertura programada aplicada».
    expect(await screen.findByText('Ronda 1 abierta · a la hora programada')).toBeTruthy()
    expect(screen.getByText('Inscripción abierta · a la hora programada')).toBeTruthy()
    expect(screen.queryByText(/Apertura programada aplicada/)).toBeNull()
  }, 20_000)

  // A4 (C19-5)
  it('modo guiado: Siguiente fija la pregunta que recibe el celular', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId, mesas } = await crearSalaDesdePanel('Guiada real', 1)
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.click(await screen.findByLabelText(/^Guiado/))
    await screen.findByText('Modo guiado: todos ven la pregunta que elijas en Sala en vivo.')
    expect((await accion(e, salaId, 'abrir_inscripcion')).statusCode).toBe(200)
    const token = (await inscribir(e, mesas[0].codigo, 'ana@x.co')).json().token as string
    expect((await accion(e, salaId, 'abrir_ronda_1')).statusCode).toBe(200)
    const yo = async () => (await e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': token } })).json()

    fireEvent.click(nav().getByText('Sala en vivo'))
    const seccion = within(await screen.findByRole('region', { name: 'Pregunta en pantalla' }))
    const siguiente = (await seccion.findByRole('button', { name: 'Siguiente' }, { timeout: 5000 })) as HTMLButtonElement
    fireEvent.click(siguiente)
    expect(await seccion.findByText('Pregunta 1 de 6 · INSUMEX · ronda 1')).toBeTruthy()
    expect((await yo()).sala.pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'alistamiento_tecnico' })
    await waitFor(() => expect(siguiente.disabled).toBe(false))
    fireEvent.click(siguiente)
    expect(await seccion.findByText('Pregunta 2 de 6 · INSUMEX · ronda 1')).toBeTruthy()
    expect((await yo()).sala.pregunta_guiada).toEqual({ proyecto_id: 'insumex', criterio_id: 'conocimiento_cliente' })
  }, 20_000)

  // A5 (C19-1): el servidor de prueba arma los QR con https://horizontes.test, que no es el origen de jsdom.
  it('avisa en rojo que BASE_URL del servidor no es el dominio del panel', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    await crearSalaDesdePanel('Dominio real', 1)
    const aviso = await screen.findByText(/^Los QR apuntan a/)
    expect(aviso.textContent).toBe(`Los QR apuntan a https://horizontes.test, pero estás en ${window.location.origin}. Corrige BASE_URL en Coolify.`)
  }, 20_000)
})

describe('correcciones de la QA del panel contra la API real', () => {
  /** Sala de 2 mesas con Ana (votó) y Beto (no votó) en la Mesa 1, en ronda 1 abierta. */
  async function salaConVotos() {
    const sala = await crearSala(e, 2, 'Sala QA real')
    expect((await accion(e, sala.id, 'abrir_inscripcion')).statusCode).toBe(200)
    const ana = (await inscribir(e, sala.mesas[0].codigo, 'ana@x.co', 'Ana Real')).json().token as string
    expect((await inscribir(e, sala.mesas[0].codigo, 'beto@x.co', 'Beto Real')).statusCode).toBe(201)
    expect((await accion(e, sala.id, 'abrir_ronda_1')).statusCode).toBe(200)
    for (const p of ['insumex', 'nutriwhat']) expect((await votar(e, ana, p, 1)).statusCode).toBe(200)
    return sala
  }

  async function entrarA(ruta: string) {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    await screen.findByRole('heading', { level: 1, name: 'Salas' })
    cleanup()
    montar(ruta)
  }

  it('D1: «Dar acceso de nuevo» genera el enlace real, el celular lo canjea y queda en la bitácora', async () => {
    const sala = await salaConVotos()
    await entrarA(`/admin/salas/${sala.id}/participantes`)
    fireEvent.click(await screen.findByRole('button', { name: 'Dar acceso de nuevo a Ana Real' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Acceso de nuevo para Ana Real' })
    const enlace = within(dialogo).getByText(/^https:\/\/horizontes\.test\/m\/.+\?acceso=/).textContent!
    expect(await within(dialogo).findByRole('img', { name: 'Código QR del acceso de Ana Real' })).toBeTruthy()
    // El reloj del servidor de prueba está a las 2:00 p. m. de Bogotá: vence a las 2:15 p. m.
    expect(within(dialogo).getByText(/^Sirve una sola vez y vence a las 2:15/)).toBeTruthy()
    const canje = await e.app.inject({ method: 'POST', url: '/api/acceso', payload: { acceso: new URL(enlace).searchParams.get('acceso') } })
    expect(canje.statusCode).toBe(200)
    expect(canje.json().participante.nombre).toBe('Ana Real')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Listo' }))
    fireEvent.click(nav().getByText('Sala en vivo'))
    expect(await screen.findByText(/Acceso de nuevo para Ana Real · paola/, {}, { timeout: 5000 })).toBeTruthy()
    expect(await screen.findByText(/Ana Real volvió a entrar con el acceso de nuevo/)).toBeTruthy()
  }, 20_000)

  it('QA-A-09 y QA-A-06: mover a quien votó pide confirmar; cerrar con pendientes también', async () => {
    const sala = await salaConVotos()
    await entrarA(`/admin/salas/${sala.id}/participantes`)
    const mesaAna = (await screen.findByLabelText('Mesa de Ana Real')) as HTMLSelectElement
    // Espera a que el panel sepa quién votó (Respuestas) antes de mover.
    await new Promise((r) => setTimeout(r, 300))
    fireEvent.change(mesaAna, { target: { value: sala.mesas[1].id } })
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, mover' }))
    expect(await screen.findByText('Ana Real pasó a Mesa 2.')).toBeTruthy()
    expect((e.db.prepare('SELECT mesa_id FROM participantes WHERE correo = ?').get('ana@x.co') as { mesa_id: string }).mesa_id).toBe(sala.mesas[1].id)
    // Beto no votó: se mueve sin preguntar.
    fireEvent.change(screen.getByLabelText('Mesa de Beto Real'), { target: { value: sala.mesas[1].id } })
    expect(await screen.findByText('Beto Real pasó a Mesa 2.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()

    fireEvent.click(nav().getByText('Sala en vivo'))
    fireEvent.click(await screen.findByRole('button', { name: 'Cerrar ronda 1' }))
    const dialogo = await screen.findByRole('dialog', { name: '¿Cerrar la ronda 1 con 1 persona sin terminar?' })
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect((e.db.prepare('SELECT estado FROM salas WHERE id = ?').get(sala.id) as { estado: string }).estado).toBe('r1_abierta')
  }, 20_000)

  it('QA-A-07: Quitar la pregunta deja al celular sin pregunta guiada', async () => {
    const sala = await crearSala(e, 1, 'Guiada QA real', { modo_preguntas: 'guiado' })
    expect((await accion(e, sala.id, 'abrir_inscripcion')).statusCode).toBe(200)
    const token = (await inscribir(e, sala.mesas[0].codigo, 'ana@x.co')).json().token as string
    expect((await accion(e, sala.id, 'abrir_ronda_1')).statusCode).toBe(200)
    await entrarA(`/admin/salas/${sala.id}/vivo`)
    const seccion = within(await screen.findByRole('region', { name: 'Pregunta en pantalla' }))
    fireEvent.click(await seccion.findByRole('button', { name: 'Siguiente' }))
    expect(await seccion.findByText('Pregunta 1 de 6 · INSUMEX · ronda 1')).toBeTruthy()
    await waitFor(() => expect((seccion.getByRole('button', { name: 'Quitar la pregunta' }) as HTMLButtonElement).disabled).toBe(false))
    fireEvent.click(seccion.getByRole('button', { name: 'Quitar la pregunta' }))
    expect(await seccion.findByText(/^Sin pregunta en pantalla/)).toBeTruthy()
    const yo = await e.app.inject({ method: 'GET', url: '/api/yo', headers: { 'x-participante-token': token } })
    expect(yo.json().sala.pregunta_guiada).toBeNull()
  }, 20_000)

  it('F-7: cambiar el país conserva la hora programada en el mismo reloj', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    const { salaId } = await crearSalaDesdePanel('País real', 1)
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByRole('heading', { name: 'Apertura y cierre programados' })
    programar('Ronda 1', 'Cerrar el', '2026-10-20T16:00')
    await screen.findByText(/La ronda 1 se cerrará el/)
    fireEvent.change(screen.getByLabelText('País de la sala'), { target: { value: 'GT' } })
    expect(await screen.findByText(/Las horas programadas siguen en el mismo reloj, ahora en hora de Guatemala: 16:00/)).toBeTruthy()
    const config = (await e.app.inject({ method: 'GET', url: `/api/admin/salas/${salaId}`, headers: { cookie } })).json().sala.config
    expect(config.pais).toBe('GT')
    expect(Date.parse(config.cierre_programado_r1_at)).toBe(Date.parse('2026-10-20T16:00:00-06:00'))
  }, 20_000)

  it('F-5: si la sesión se cierra en el servidor, el panel vuelve al login', async () => {
    montar('/admin/login')
    await entrar('paola', 'superclave123')
    await crearSalaDesdePanel('Sesión real', 1)
    // Otra pestaña cierra la sesión: el siguiente sondeo responde 401.
    await e.app.inject({ method: 'POST', url: '/api/admin/logout', headers: { cookie } })
    expect(await screen.findByRole('heading', { name: 'Panel de administración' }, { timeout: 6000 })).toBeTruthy()
    expect(screen.getByText('Tu sesión terminó. Vuelve a entrar para seguir donde ibas.')).toBeTruthy()
  }, 20_000)
})
