// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import PaginaAdmin from './PaginaAdmin'
import { usarTransporte } from './api'
import { reiniciarMock, responderMock } from './mock/servidor'
import { CLAVE_GUIA } from './componentes/GuiaUso'
import { DESCRIPCION_CRITERIO } from '../shared/criterios'
import { contenidoDe, ordenPreguntas } from './contenido'
import {
  ACCIONES_POR_ESTADO,
  dominioDistinto,
  estadoMesa,
  faltan,
  horaLocalAIso,
  isoAHoraLocal,
  programaciones,
  rutaApiTablero,
  textoEvento,
  bitacora,
  urlTableroSala,
  enEsteServidor,
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
  // La guía de uso tiene su propia prueba (guia-uso.test.tsx); aquí ya se dio por vista.
  localStorage.setItem(CLAVE_GUIA, '1,2,3,4,5')
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

  it('los enlaces del panel abren en su propio servidor aunque BASE_URL apunte a otro ambiente', () => {
    expect(enEsteServidor('https://staging-horizontes.estratek.com.co/tablero/s_1?mesa=m1&t=TOK')).toBe('/tablero/s_1?mesa=m1&t=TOK')
    expect(enEsteServidor('https://otro.dominio/m/HZ7K2-1')).toBe('/m/HZ7K2-1')
    expect(enEsteServidor('/tablero/s_1?t=TOK')).toBe('/tablero/s_1?t=TOK')
    expect(enEsteServidor(undefined)).toBeNull()
  })

  it('describe los eventos de la bitácora en lenguaje claro', () => {
    expect(textoEvento({ tipo: 'ronda_cerrada', detalle: { ronda: 1 }, por: 'admin:paola' })).toBe('Ronda 1 cerrada · paola')
    expect(textoEvento({ tipo: 'inscripcion_abierta', detalle: {}, por: 'admin:paola' })).toBe('Inscripción abierta · paola')
    expect(textoEvento({ tipo: 'cierre_programado', detalle: {}, por: 'programado' })).toBe('Cierre programado aplicado · a la hora programada')
    // QA-A-15: el precierre del servidor viene en imperativo y sin ronda; la bitácora lo dice como hecho, con la ronda.
    expect(textoEvento({ tipo: 'precierre', detalle: { mensaje: 'Todos votaron en Mesa 1. Puedes cerrar la ronda.' }, por: 'sistema' })).toBe('Todos votaron en Mesa 1')
    const ctx = { mesas: [{ id: 'm1', nombre: 'Mesa 1' }, { id: 'm2', nombre: 'Mesa 2' }], participantes: [{ id: 'p_1', nombre: 'Ana Pérez' }] }
    expect(textoEvento({ tipo: 'precierre', detalle: { mesa_id: 'm2', ronda: 2, mensaje: 'Todos votaron en Mesa 2. Puedes cerrar la ronda.' }, por: 'sistema' }, ctx)).toBe('Todos votaron en Mesa 2 (ronda 2)')
    expect(textoEvento({ tipo: 'precierre', detalle: { alcance: 'sala', ronda: 1 }, por: 'sistema' }, ctx)).toBe('Todos votaron en la sala (ronda 1)')
    expect(textoEvento({ tipo: 'inscripcion', detalle: { participante_id: 'p_1', mesa_id: 'm1' }, por: 'sistema' }, ctx)).toBe('Ana Pérez se inscribió en Mesa 1')
    expect(textoEvento({ tipo: 'inscripcion', detalle: { participante_id: 'p_9', mesa_id: 'm2' }, por: 'sistema' }, ctx)).toBe('Nueva inscripción en Mesa 2')
    expect(textoEvento({ tipo: 'config', detalle: { pais: 'GT', zona_horaria: 'America/Guatemala' }, por: 'admin:qa' })).toBe('Configuración: país y zona horaria · qa')
    expect(textoEvento({ tipo: 'config', detalle: { cierre_programado_r1_at: null }, por: 'admin:qa' })).toBe('Configuración: cierre programado de la ronda 1 · qa')
    expect(textoEvento({ tipo: 'participante_editado', detalle: { participante_id: 'p_1', mesa_id: 'm2' }, por: 'admin:paola' }, ctx)).toBe('Ana Pérez pasó a Mesa 2 · paola')
    expect(textoEvento({ tipo: 'participante_editado', detalle: { participante_id: 'p_1', activo: false }, por: 'admin:paola' }, ctx)).toBe('Ana Pérez quedó inactivo · paola')
    const contenido = contenidoDe({ proyectos_vivos: [{ id: 'insumex', nombre: 'INSUMEX' }], perfiles: [{ id: 'financiero', nombre: 'Financiero' }] })
    expect(textoEvento({ tipo: 'pregunta_guiada', detalle: { ronda: 1, proyecto_id: 'insumex', criterio_id: 'regulacion' }, por: 'admin:jorge' }, { contenido })).toBe('Pregunta en pantalla: INSUMEX · Pregunta 3 de 6 · jorge')
    expect(textoEvento({ tipo: 'participante_editado', detalle: { participante_id: 'p_1', perfil_id: 'financiero' }, por: 'admin:paola' }, { ...ctx, contenido })).toBe('Ana Pérez ahora tiene el perfil Financiero · paola')
    expect(textoEvento({ tipo: 'rubrica_editada', detalle: { criterio_id: 'inversion_requerida' }, por: 'admin:paola' })).toBe('Rúbrica editada: Inversión para probar · paola')
    expect(textoEvento({ tipo: 'pregunta_guiada', detalle: { ronda: 1, proyecto_id: null, criterio_id: null }, por: 'admin:jorge' })).toBe('Pregunta quitada: vuelve la matriz · jorge')
    expect(textoEvento({ tipo: 'algo_nuevo', detalle: null, por: 'sistema' })).toBe('Algo nuevo')
    // Eventos nuevos del servidor (20-oct).
    expect(textoEvento({ tipo: 'acceso_reemitido', detalle: { participante_id: 'p_1', vence_at: 'x' }, por: 'admin:paola' }, ctx)).toBe('Acceso de nuevo para Ana Pérez · paola')
    expect(textoEvento({ tipo: 'acceso_canjeado', detalle: { participante_id: 'p_1' }, por: 'sistema' }, ctx)).toBe('Ana Pérez volvió a entrar con el acceso de nuevo')
    expect(textoEvento({ tipo: 'apertura_programada_descartada', detalle: { accion: 'abrir_ronda_1' }, por: 'programado' })).toBe(
      'Apertura programada descartada: a esa hora no aplicaba · a la hora programada',
    )
  })

  it('bitácora sin ruido: agrupa lo repetido y no duplica lo programado', () => {
    const at = '2026-10-20T14:21:00-05:00'
    const eventos = [
      { at, tipo: 'apertura_programada', detalle: { accion: 'abrir_ronda_1' }, por: 'programado' },
      { at, tipo: 'ronda_abierta', detalle: { ronda: 1 }, por: 'programado' },
      { at, tipo: 'apertura_programada', detalle: { accion: 'abrir_inscripcion' }, por: 'programado' },
      { at, tipo: 'inscripcion_abierta', detalle: {}, por: 'programado' },
      ...Array.from({ length: 12 }, () => ({ at, tipo: 'config', detalle: { cierre_programado_r1_at: null }, por: 'admin:qa' })),
    ]
    expect(bitacora(eventos)).toEqual([
      { at, texto: 'Ronda 1 abierta · a la hora programada', veces: 1 },
      { at, texto: 'Inscripción abierta · a la hora programada', veces: 1 },
      { at, texto: 'Configuración: cierre programado de la ronda 1 · qa', veces: 12 },
    ])
    // Sin transición al lado, «aplicado» se conserva.
    expect(bitacora([{ at, tipo: 'cierre_programado', detalle: {}, por: 'programado' }]).map((l) => l.texto)).toEqual(['Cierre programado aplicado · a la hora programada'])
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

  it('crea una sala y recorre el ciclo de estados: solo se ven las acciones posibles', async () => {
    montar('/admin/login')
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Ensayo' } })
    fireEvent.change(screen.getByLabelText('Mesas'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    await screen.findByText('Preparada')

    const boton = (n: string) => screen.getByRole('button', { name: n }) as HTMLButtonElement
    // QA-A-05: lo que no aplica en el estado actual no se muestra.
    expect(screen.queryByRole('button', { name: 'Abrir ronda 1' })).toBeNull()
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
    // QA-A-01: con la ronda 2 cerrada, el paso que sigue es cerrar la sala, no «Reabrir ronda».
    const principales = () => [...document.querySelectorAll('.hz-boton--primario')].map((b) => b.textContent)
    expect(principales()).toEqual(['Cerrar sala'])
    expect(boton('Reabrir ronda').className).toContain('hz-boton--secundario')
    // Cerrar sala pide confirmación.
    fireEvent.click(boton('Cerrar sala'))
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, cerrar la sala' }))
    await screen.findByText('Sala cerrada', { selector: '.estado' })
    expect(boton('Reabrir sala').disabled).toBe(false)
    // Con la sala cerrada lo que sigue es exportar; reabrir queda para corregir.
    expect(principales()).toEqual(['Descargar los datos'])
    expect(boton('Reabrir sala').className).not.toContain('hz-boton--primario')
  })

  it('marca Estratek: barra de producto carbón y una sola acción principal, el paso que sigue', async () => {
    montar('/admin/login')
    expect(screen.getByText('Horizontes').closest('[data-tema="carbon"]')).toBeTruthy()
    expect(within(document.querySelector('.hz-producto') as HTMLElement).getByText(/por Estratek/)).toBeTruthy()
    await entrar('paola')
    fireEvent.change(screen.getByLabelText('Nombre del taller'), { target: { value: 'Marca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear sala' }))
    await screen.findByRole('heading', { name: 'Sala en vivo' })
    await screen.findByText('Preparada', { selector: '.estado' })
    const principales = () => [...document.querySelectorAll('.hz-boton--primario')].map((b) => b.textContent)
    expect(principales()).toEqual(['Abrir inscripción'])
    // Lo que cierra va aparte, en «Corregir», en contorno rojo: no compite con el paso que sigue.
    const corregir = screen.getByRole('group', { name: 'Corregir' })
    expect(within(corregir).getByRole('button', { name: 'Cerrar sala' }).className).toContain('hz-boton--peligro')
    expect(within(screen.getByRole('list', { name: 'Estado de la sala' })).getByText('Inscritos')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Abrir inscripción' }))
    await screen.findByText('Inscripción abierta', { selector: '.estado' })
    expect(principales()).toEqual(['Abrir ronda 1'])
    const enVivo = screen.getByRole('region', { name: 'Ver en vivo' })
    for (const nombre of ['Gráfica', 'Detallado', /^Tablero de Mesa 1/, 'Vista previa del celular']) {
      const href = within(enVivo).getByRole('link', { name: nombre }).getAttribute('href') ?? ''
      expect(href.startsWith('/')).toBe(true)
    }
    // Dos modos de proyección del tablero de la sala, a elegir por evento: Gráfica y Detallado (20-oct).
    const modo = (n: string) => new URL(within(enVivo).getByRole('link', { name: n }).getAttribute('href')!, 'http://x').searchParams.get('modo')
    expect([modo('Gráfica'), modo('Detallado')]).toEqual(['grafica', 'detallado'])
    const ayuda = document.getElementById('ayuda-tablero-sala')!.textContent ?? ''
    for (const t of ['Gráfica muestra solo la matriz moviéndose', 'Detallado muestra la matriz con el progreso y los promedios', 'G y D cambian de modo', 'M los alterna', 'V muestra Cómo votó', 'F pone pantalla completa'])
      expect(ayuda).toContain(t)
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
    // QA-A-27: semáforo en lenguaje llano, sin jerga (p95, modo).
    expect(await screen.findByText('Todo bien')).toBeTruthy()
    expect(screen.getByText(/^El servidor responde/)).toBeTruthy()
    expect(screen.getByText(/Versión instalada: simulador\./)).toBeTruthy()
    expect(screen.queryByText(/p95|Modo:/)).toBeNull()
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
    // Acta A3, A4 y P2: los 6 criterios; sin T2M, ejes ni votos. Preentrega 19-oct: sin fila «Total».
    const tabla = screen.getByRole('table', { name: 'INSUMEX' })
    // Cada fila: el nombre del criterio y debajo su descripción corta (pedido del 20-oct).
    expect(within(tabla).getAllByRole('rowheader').map((th) => th.querySelector('.tabla-criterio__desc')?.textContent)).toEqual(Object.values(DESCRIPCION_CRITERIO))
    expect(within(tabla).getAllByRole('rowheader').map((th) => th.firstChild?.textContent)).toEqual([
      'Nivel de Alistamiento Técnico',
      'Nivel de Conocimiento del Cliente/Mercado',
      'Regulación',
      'Capacidades Organizacionales',
      'Alineación y Cercanía Estratégica con el Core',
      'Inversión Requerida para Probar',
    ])
    expect(within(tabla).getByRole('columnheader', { name: 'R1' }).querySelector('.ronda--1')).toBeTruthy()
    expect(within(tabla).queryByText(/eje|votos|time to market|total/i)).toBeNull()
    // Promedio del servidor con 2 decimales.
    const regulacion = within(tabla).getByRole('rowheader', { name: /^Regulación/ }).parentElement!
    expect(regulacion.querySelector('td')?.textContent).toMatch(/^\d+,\d\d$/)
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
    expect((screen.getByLabelText(/Resultado en vivo/) as HTMLInputElement).checked).toBe(true)
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
    // QA-A-30: el mismo aviso de datos personales que Participantes y Respuestas.
    const ayuda = await screen.findByText('Solo administradores. No se proyecta.')
    expect(ayuda.parentElement?.className).toContain('alerta--aviso')
    expect(ayuda.parentElement?.textContent).toMatch(/Registro interno.*país e IP.*siguen anónimos/)
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
    // QA-A-14: cambiar de criterio con cambios pendientes pregunta antes; «Seguir editando» los conserva.
    fireEvent.change(seccion().getByLabelText('Criterio'), { target: { value: 'regulacion' } })
    const dialogo = await screen.findByRole('dialog', { name: '¿Descartar los cambios?' })
    expect(document.activeElement?.textContent).toBe('Seguir editando')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Seguir editando' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(nivel(1).value).toBe('Algo que se descarta')
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
  /** Campos de la programación dentro de su grupo: «Ronda 1» → «Abrir el». */
  const enGrupo = (grupo: string) => within(screen.getByRole('group', { name: grupo }))
  const campo = (grupo: string, etiqueta: string) => enGrupo(grupo).getByLabelText(etiqueta) as HTMLInputElement
  const fila = (grupo: string, etiqueta: string) => within(campo(grupo, etiqueta).closest('.campo-hora') as HTMLElement)
  const programar = (grupo: string, etiqueta: string, valor: string) => {
    fireEvent.change(campo(grupo, etiqueta), { target: { value: valor } })
    fireEvent.click(fila(grupo, etiqueta).getByRole('button', { name: 'Programar' }))
  }

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
    // Los proyectos vivos salen de la sala (contenido.ts), los criterios en el orden del motor.
    const orden = ordenPreguntas(contenidoDe(null, { proyectosVivos: [{ id: 'insumex', nombre: 'INSUMEX' }, { id: 'nutriwhat', nombre: 'NUTRIWHAT' }] }))
    expect(orden).toHaveLength(12)
    expect(orden[0]).toEqual({ proyecto_id: 'insumex', criterio_id: 'alistamiento_tecnico' })
    expect(orden[6]).toEqual({ proyecto_id: 'nutriwhat', criterio_id: 'alistamiento_tecnico' })
    expect(orden[11]).toEqual({ proyecto_id: 'nutriwhat', criterio_id: 'inversion_requerida' })
    // Solo lo programado, en el orden del taller (no en el de los campos).
    const lista = programaciones({
      cierre_programado_sala_at: '2030-01-10T18:00:00-05:00',
      cierre_programado_r1_at: null,
      apertura_programada_r1_at: '2030-01-10T09:00:00-05:00',
    })
    expect(lista).toEqual([
      { texto: 'Abre la ronda 1', at: '2030-01-10T09:00:00-05:00' },
      { texto: 'Cierra la sala', at: '2030-01-10T18:00:00-05:00' },
    ])
    expect(programaciones({})).toEqual([])
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
    // Orden del taller (pedido de Paola, 20-oct): preparar, conducir, después y sistema, cada grupo con su nombre.
    const secciones = ['Salas', 'Configuración', 'Hojas', 'Mesas y QR', 'Sala en vivo', 'Participantes', 'Respuestas', 'Exportar', 'Salud']
    expect(nav().getAllByRole('link').map((a) => a.textContent)).toEqual(esSuper ? [...secciones, 'Administradores'] : secciones)
    expect(nav().getAllByRole('group').map((g) => [g.getAttribute('aria-label'), within(g).getAllByRole('link').map((a) => a.textContent)])).toEqual([
      ['Preparar el taller', ['Salas', 'Configuración', 'Hojas', 'Mesas y QR']],
      ['Conducir el taller', ['Sala en vivo', 'Participantes']],
      ['Después del taller', ['Respuestas', 'Exportar']],
      ['Sistema', esSuper ? ['Salud', 'Administradores'] : ['Salud']],
    ])

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
      ['Salud', () => screen.findByText('Todo bien')],
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

  // Preentrega 19-oct: ayudas de mesas y QR, y aviso en las vistas con datos personales.
  it('ayudas de la preentrega: mesas recomendadas, QR impreso y aviso de datos personales', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Salas'))
    const mesas = await screen.findByLabelText('Mesas')
    expect(document.getElementById(mesas.getAttribute('aria-describedby')!)?.textContent).toBe('Recomendado: una mesa por cada 6 personas (hay 6 perfiles por mesa).')
    fireEvent.click(nav().getByText('Mesas y QR'))
    expect(await screen.findByText('Imprime el QR de cada mesa y ponlo en su mesa, así cada persona entra a la suya. Proyecta un QR solo si a una mesa le falta su hoja.')).toBeTruthy()
    fireEvent.click(nav().getByText('Participantes'))
    expect(await screen.findByText('Solo administradores. No se proyecta.')).toBeTruthy()
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
      'Inversión para probar',
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
    // Pedido del 20-oct: bajo la tabla, qué mide cada criterio en una línea (100 caracteres como máximo).
    const leyenda = screen.getByLabelText('Qué mide cada criterio')
    expect(within(leyenda).getAllByRole('definition').map((d) => d.textContent)).toEqual(Object.values(DESCRIPCION_CRITERIO))
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

  // A2 (C19-4) con los títulos de la preentrega: grupos Sala, Ronda 1 y Ronda 2, y una línea de qué pasa a esa hora.
  it('programa apertura y cierre por etapa en la hora de la sala, y muestra los rechazos del servidor tal cual', async () => {
    await salaNueva('Programada')
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByRole('heading', { name: 'Apertura y cierre programados' })
    expect(screen.getByText(/^Hora del servidor:/)).toBeTruthy()
    expect(['Abrir inscripción el', 'Cerrar la sala el'].map((e) => campo('Sala', e).id)).toEqual(['apertura_programada_sala_at', 'cierre_programado_sala_at'])
    expect(['Abrir el', 'Cerrar el'].map((e) => campo('Ronda 1', e).id)).toEqual(['apertura_programada_r1_at', 'cierre_programado_r1_at'])
    expect(['Abrir el', 'Cerrar el'].map((e) => campo('Ronda 2', e).id)).toEqual(['apertura_programada_r2_at', 'cierre_programado_r2_at'])
    // Cada campo dice qué pasa a esa hora (descripción accesible del campo).
    const describe = (g: string, e: string) => campo(g, e).getAttribute('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent).join(' ')
    expect(describe('Sala', 'Abrir inscripción el')).toBe('A partir de esta hora se puede entrar con el QR.')
    expect(describe('Ronda 1', 'Cerrar el')).toBe('Después de esta hora nadie más puede responder la ronda 1.')

    programar('Ronda 1', 'Abrir el', '2030-01-10T09:00')
    expect((await fila('Ronda 1', 'Abrir el').findByRole('status')).textContent).toMatch(/^La ronda 1 se abrirá el .*2030/)

    programar('Ronda 1', 'Cerrar el', '2030-01-10T08:00')
    expect((await fila('Ronda 1', 'Cerrar el').findByRole('alert')).textContent).toBe('La apertura de la ronda 1 debe ser antes que el cierre de la ronda 1.')
    expect(campo('Ronda 1', 'Cerrar el').getAttribute('aria-invalid')).toBe('true')

    programar('Sala', 'Cerrar la sala el', '2020-01-10T08:00')
    expect((await fila('Sala', 'Cerrar la sala el').findByRole('alert')).textContent).toMatch(/^Esa hora ya pasó\. En el servidor son las \d\d:\d\d:\d\d; elige una hora posterior\.$/)

    programar('Ronda 2', 'Abrir el', '2030-01-10')
    expect((await fila('Ronda 2', 'Abrir el').findByRole('alert')).textContent).toBe('Elige fecha y hora completas.')

    // Sala en vivo lista lo programado con su cuenta regresiva.
    fireEvent.click(nav().getByText('Sala en vivo'))
    const lista = await screen.findByRole('list', { name: 'Programado' })
    expect(lista.textContent).toMatch(/^Abre la ronda 1: .*2030.* · faltan /)

    fireEvent.click(nav().getByText('Configuración'))
    await waitFor(() => expect(campo('Ronda 1', 'Abrir el').value).toBe('2030-01-10T09:00'))
    fireEvent.click(fila('Ronda 1', 'Abrir el').getByRole('button', { name: 'Quitar' }))
    expect((await fila('Ronda 1', 'Abrir el').findByRole('status')).textContent).toBe('Quitamos la apertura programada de la ronda 1.')
    await waitFor(() => expect(campo('Ronda 1', 'Abrir el').value).toBe(''))
  })

  it('bloquea lo que ya pasó en la sala y explica por qué', async () => {
    await abrirDemo()
    fireEvent.click(nav().getByText('Configuración'))
    await screen.findByRole('heading', { name: 'Apertura y cierre programados' })
    // Demo en ronda 1 abierta: la inscripción y la ronda 1 ya se abrieron; lo demás sigue programable.
    expect(campo('Sala', 'Abrir inscripción el').disabled).toBe(true)
    expect(fila('Sala', 'Abrir inscripción el').getByText('La inscripción ya se abrió.')).toBeTruthy()
    expect(campo('Ronda 1', 'Abrir el').disabled).toBe(true)
    expect(fila('Ronda 1', 'Abrir el').getByText('La ronda 1 ya se abrió.')).toBeTruthy()
    for (const [g, e] of [
      ['Ronda 1', 'Cerrar el'],
      ['Ronda 2', 'Abrir el'],
      ['Ronda 2', 'Cerrar el'],
      ['Sala', 'Cerrar la sala el'],
    ])
      expect(campo(g, e).disabled).toBe(false)
    // El cierre de sala que trae el demo se muestra en la hora de la sala.
    expect(campo('Sala', 'Cerrar la sala el').value).toBe('2026-10-20T18:00')
  })

  // A4 (C19-5)
  it('modo guiado: Anterior, Siguiente y salto a cualquier pregunta desde Sala en vivo', async () => {
    // La sala demo del simulador está en modo guiado, con INSUMEX · Regulación en pantalla.
    await abrirDemo('jorge')
    const seccion = within(await screen.findByRole('region', { name: 'Pregunta en pantalla' }))
    const b = (n: string) => seccion.getByRole('button', { name: n }) as HTMLButtonElement
    // QA-A-08: la numeración es la del tablero, por proyecto.
    expect(seccion.getByText('Pregunta 3 de 6 · INSUMEX · ronda 1')).toBeTruthy()
    expect(seccion.getByText('INSUMEX · Regulación')).toBeTruthy()
    fireEvent.click(b('Anterior'))
    expect(await seccion.findByText('Pregunta 2 de 6 · INSUMEX · ronda 1')).toBeTruthy()
    expect(seccion.getByText('INSUMEX · Nivel de Conocimiento del Cliente/Mercado')).toBeTruthy()
    await waitFor(() => expect(b('Siguiente').disabled).toBe(false))
    fireEvent.click(b('Siguiente'))
    expect(await seccion.findByText('Pregunta 3 de 6 · INSUMEX · ronda 1')).toBeTruthy()

    fireEvent.change(seccion.getByLabelText('Proyecto'), { target: { value: 'nutriwhat' } })
    fireEvent.change(seccion.getByLabelText('Pregunta'), { target: { value: 'inversion_requerida' } })
    fireEvent.click(b('Mostrar esta pregunta'))
    expect(await seccion.findByText('Pregunta 6 de 6 · NUTRIWHAT · ronda 1')).toBeTruthy()
    expect(seccion.getByText('NUTRIWHAT · Inversión Requerida para Probar')).toBeTruthy()
    await waitFor(() => expect(b('Siguiente').disabled).toBe(true))
    expect(b('Mostrar esta pregunta').disabled).toBe(true)
    // Queda en la bitácora.
    expect(screen.getAllByText(/Pregunta en pantalla: NUTRIWHAT · Pregunta 6 de 6 · jorge/).length).toBeGreaterThan(0)

    // QA-A-07: «Quitar la pregunta» vuelve a la matriz y queda en la bitácora.
    fireEvent.click(b('Quitar la pregunta'))
    expect(await seccion.findByText(/^Sin pregunta en pantalla: el tablero muestra la matriz/)).toBeTruthy()
    await waitFor(() => expect(b('Quitar la pregunta').disabled).toBe(true))
    expect(screen.getAllByText(/Pregunta quitada: vuelve la matriz · jorge/).length).toBeGreaterThan(0)

    // En automático no hay control; al volver a guiado la pregunta empieza de cero (el servidor la borra al cambiar el modo).
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.click(await screen.findByLabelText(/^Automático/))
    expect(await screen.findByText('Cada persona avanza sola: al responder pasa a la siguiente pregunta.')).toBeTruthy()
    fireEvent.click(nav().getByText('Sala en vivo'))
    await screen.findByRole('heading', { name: 'Control de la sala' })
    expect(screen.queryByRole('heading', { name: 'Pregunta en pantalla' })).toBeNull()
    fireEvent.click(nav().getByText('Configuración'))
    fireEvent.click(await screen.findByLabelText(/^Guiado/))
    expect(await screen.findByText('Modo guiado: todos ven la pregunta que elijas en Sala en vivo.')).toBeTruthy()
    fireEvent.click(nav().getByText('Sala en vivo'))
    const otra = within(await screen.findByRole('region', { name: 'Pregunta en pantalla' }))
    expect(otra.getByText(/Sin pregunta en pantalla/)).toBeTruthy()
    expect((otra.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(otra.getByRole('button', { name: 'Siguiente' }))
    expect(await otra.findByText('Pregunta 1 de 6 · INSUMEX · ronda 1')).toBeTruthy()
    expect(otra.getByText('INSUMEX · Nivel de Alistamiento Técnico')).toBeTruthy()
  })

  it('modo guiado: sin ronda abierta lo explica y un rechazo del servidor sale tal cual', async () => {
    usarTransporte(async (metodo, ruta, cuerpo, etag) =>
      metodo === 'PUT' && ruta.endsWith('/pregunta-guiada')
        ? { status: 409, body: { error: { codigo: 'RONDA_CERRADA', mensaje: 'No hay una ronda abierta: abre una ronda para guiar las preguntas.' } } }
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
    expect((await seccion.findByRole('alert')).textContent).toBe('No hay una ronda abierta: abre una ronda para guiar las preguntas.')
  })

  // A5 (C19-1): base_url viene en el detalle de la sala.
  it('avisa en rojo si BASE_URL no es el dominio desde el que se abre el panel', async () => {
    await abrirDemo()
    expect(screen.queryByText(/Los QR apuntan a/)).toBeNull() // el simulador usa el mismo origen
    cleanup()
    usarTransporte(async (metodo, ruta, cuerpo, etag) => {
      const r = await responderMock(metodo, ruta, cuerpo, etag)
      return /^\/api\/admin\/salas\/[^/]+$/.test(ruta) && r.status === 200 ? { ...r, body: { ...(r.body as object), base_url: 'https://staging-horizontes.estratek.com.co' } } : r
    })
    // En Salas, sin sala abierta ni recordada en este navegador, se lee la primera sala de la lista.
    localStorage.removeItem('hz_admin_sala')
    montar('/admin/salas')
    const aviso = await screen.findByText(/^Los QR apuntan a/)
    expect(aviso.getAttribute('role')).toBe('alert')
    expect(aviso.textContent).toBe(
      `Los QR apuntan a https://staging-horizontes.estratek.com.co, pero estás en ${window.location.origin}. Corrige BASE_URL en Coolify.`,
    )
  })
})
