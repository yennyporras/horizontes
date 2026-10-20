import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { accionDeTecla } from './usePantallaCompleta'
import type { DatosTablero } from './tipos'
import {
  EN_VIVO,
  avisosPrecierre,
  cifraRonda,
  conteoMesa,
  delta,
  esSinPermiso,
  faltanVotos,
  modoDeUrl,
  rondaEnCurso,
  votosRecibidos,
  esPreliminar,
  insigniaResultado,
  mensajeVacio,
  mostrarR2,
  numero,
  pedirTablero,
  urlApiTablero,
  vistaPorDefecto,
} from './logica'

const mock: DatosTablero = JSON.parse(readFileSync(new URL('../../mocks/GET_api_tablero.json', import.meta.url), 'utf8'))

function sinVotos(datos: DatosTablero, ronda: number): DatosTablero {
  const d = structuredClone(datos)
  for (const v of d.proyectos_vivos) {
    const r = v.rondas.find((x) => x.ronda === ronda)!
    Object.assign(r, { n_votos: 0, promedios: null, distribucion: null, t2m: null, eje_x: null, eje_y: null })
  }
  return d
}

describe('vista por defecto', () => {
  test('ronda actual y comparación tras cerrar R2', () => {
    expect(vistaPorDefecto('preparada', null)).toBe(1)
    expect(vistaPorDefecto('inscripcion', null)).toBe(1)
    expect(vistaPorDefecto('r1_abierta', 1)).toBe(1)
    expect(vistaPorDefecto('r1_cerrada', 1)).toBe(1)
    expect(vistaPorDefecto('r2_abierta', 2)).toBe(2)
    expect(vistaPorDefecto('r2_cerrada', 2)).toBe('comparacion')
    expect(vistaPorDefecto('cerrada', 2)).toBe('comparacion')
  })
})

describe('estados vacíos', () => {
  test('sin votos en R1', () => {
    const d = sinVotos(sinVotos(mock, 1), 2)
    d.sala.estado = 'r2_cerrada'
    expect(mensajeVacio(d, 1)).toBe('Aún no hay votos en la ronda 1')
    expect(mensajeVacio(d, 'comparacion')).toBe('Aún no hay votos en la ronda 1')
    expect(mensajeVacio(d, 2)).toBe('Aún no hay votos en la ronda 2')
  })
  test('D2: con la ronda abierta llega la última foto, así que no se afirma que no haya votos', () => {
    const d = sinVotos(sinVotos(mock, 1), 2)
    d.sala.estado = 'r2_abierta'
    expect(mensajeVacio(d, 2)).toBe('Aún no hay resultados en la ronda 2. Se actualizan cada 3 votos nuevos')
    expect(mensajeVacio(d, 1)).toBe('Aún no hay votos en la ronda 1')
    expect(EN_VIVO.texto).toBe('En vivo, cada 3 votos')
    expect(EN_VIVO.titulo).toMatch(/cada 3 votos nuevos y queda exacto al cerrarla/)
    expect(rondaEnCurso('r1_abierta')).toBe(1)
    expect(rondaEnCurso('r1_cerrada')).toBeNull()
  })
  test('R1 con votos y R2 vacía', () => {
    const d = sinVotos(mock, 2)
    expect(mensajeVacio(d, 1)).toBeNull()
    expect(mensajeVacio(d, 'comparacion')).toMatch(/solo la ronda 1/)
  })
  test('bajo el mínimo de votos: el aviso dice cuántos faltan, no «Aún no hay votos»', () => {
    const d = sinVotos(sinVotos(mock, 1), 2)
    d.sala.estado = 'r2_cerrada'
    for (const v of d.proyectos_vivos) Object.assign(v.rondas[0], { n_votos: 2, bajo_minimo: true })
    d.minimo_votos = 3
    d.alcance = { tipo: 'mesa', mesa_id: 'm1', mesa_nombre: 'Mesa 1' }
    expect(mensajeVacio(d, 1)).toBe('Hacen falta al menos 3 votos para mostrar esta mesa')
    expect(mensajeVacio(d, 'comparacion')).toBe('Hacen falta al menos 3 votos para mostrar esta mesa')
    expect(mensajeVacio(d, 2)).toBe('Aún no hay votos en la ronda 2')
    d.alcance = { tipo: 'sala', mesa_id: null, mesa_nombre: null }
    delete d.minimo_votos
    expect(mensajeVacio(d, 1)).toBe('Hacen falta al menos 3 votos para mostrar estos resultados')
    const r2 = sinVotos(mock, 2)
    for (const v of r2.proyectos_vivos) Object.assign(v.rondas[1], { n_votos: 1, bajo_minimo: true })
    expect(mensajeVacio(r2, 'comparacion')).toBe('Hacen falta al menos 3 votos para mostrar esta mesa. La comparación muestra solo la ronda 1.')
    expect(cifraRonda(r2.proyectos_vivos[0].rondas[1], null)).toBe('Faltan votos')
    expect(cifraRonda(mock.proyectos_vivos[0].rondas[0], 4.567)).toBe('4,57')
    expect(cifraRonda(null, null)).toBe('Sin votos')
  })
  test('F-12: concordancia del mínimo de votos', () => {
    expect(faltanVotos(3)).toBe('Hacen falta al menos 3 votos')
    expect(faltanVotos(5)).toBe('Hacen falta al menos 5 votos')
    expect(faltanVotos(1)).toBe('Hace falta al menos 1 voto')
  })
  test('columna R2 solo desde la ronda 2', () => {
    const d = sinVotos(mock, 2)
    d.sala.ronda_actual = 1
    expect(mostrarR2(d)).toBe(false)
    d.sala.ronda_actual = 2
    expect(mostrarR2(d)).toBe(true)
    expect(mostrarR2(mock)).toBe(true)
  })
  test('datos nulos', () => {
    expect(mensajeVacio(null, 1)).toBe('Aún no hay votos en la ronda 1')
    expect(avisosPrecierre(null)).toEqual([])
    expect(esPreliminar(null)).toBe(false)
  })
})

describe('modos de proyección y votos recibidos', () => {
  test('?modo=grafica|detallado, con los valores anteriores vivo|tabla como alias; cualquier otro valor es Gráfica', () => {
    expect(modoDeUrl('detallado')).toBe('detallado')
    expect(modoDeUrl('grafica')).toBe('grafica')
    // Enlaces ya compartidos (antes del 20-oct): tabla es Detallado y vivo es Gráfica.
    expect(modoDeUrl('tabla')).toBe('detallado')
    expect(modoDeUrl('vivo')).toBe('grafica')
    expect(modoDeUrl(null)).toBe('grafica')
    expect(modoDeUrl('otro')).toBe('grafica')
  })
  test('teclas del proyector: G Gráfica, D Detallado, M alterna, V «Cómo votó», F pantalla completa, 1, 2 y C la vista', () => {
    expect(accionDeTecla('g')).toEqual({ tipo: 'matriz', sola: true })
    expect(accionDeTecla('G')).toEqual({ tipo: 'matriz', sola: true })
    expect(accionDeTecla('d')).toEqual({ tipo: 'matriz', sola: false })
    expect(accionDeTecla('Escape')).toEqual({ tipo: 'matriz', sola: false })
    expect(accionDeTecla('m')).toEqual({ tipo: 'matriz', sola: null })
    expect(accionDeTecla('v')).toEqual({ tipo: 'detalle' })
    expect(accionDeTecla('f')).toEqual({ tipo: 'pantalla' })
    expect(accionDeTecla('1')).toEqual({ tipo: 'vista', vista: 1 })
    expect(accionDeTecla('2')).toEqual({ tipo: 'vista', vista: 2 })
    expect(accionDeTecla('c')).toEqual({ tipo: 'vista', vista: 'comparacion' })
    // T era «Con tabla»: ya no es un atajo.
    expect(accionDeTecla('t')).toBeNull()
  })
  test('indicador discreto: los de la sala o, con alcance mesa, los de esa mesa', () => {
    const d = structuredClone(mock)
    d.alcance = { tipo: 'sala', mesa_id: null, mesa_nombre: null }
    expect(votosRecibidos(d)).toBe('14 de 20 votaron')
    d.alcance = { tipo: 'mesa', mesa_id: 'm2', mesa_nombre: 'Mesa 2' }
    expect(votosRecibidos(d)).toBe('4 de 7 votaron')
    d.sala.ronda_actual = 0
    expect(votosRecibidos(d)).toBeNull()
    expect(votosRecibidos(null)).toBeNull()
  })
  test('QA-T-04: el conteo de cada mesa es el de la ronda que se ve', () => {
    const d = structuredClone(mock)
    d.sala.estado = 'r2_abierta'
    for (const v of d.proyectos_vivos) v.rondas[0].n_votos = 2
    const mesa = { inscritos: 2, completos: 0 }
    expect(conteoMesa(d, mesa, 1)).toBe('R1: 2 de 2')
    expect(conteoMesa(d, mesa, 2)).toBe('R2: 0 de 2')
    expect(conteoMesa(d, mesa, 'comparacion')).toBe('R1: 2 de 2 · R2: 0 de 2')
    expect(conteoMesa(null, mesa, 1)).toBe('0 de 2')
  })
})

describe('precierre y preliminar', () => {
  test('aviso por mesa en precierre con ronda abierta', () => {
    expect(avisosPrecierre(mock).map((a) => a.texto)).toEqual(['Mesa 1: todos votaron'])
  })
  test('sin avisos con la ronda cerrada', () => {
    const d = structuredClone(mock)
    d.sala.estado = 'r2_cerrada'
    expect(avisosPrecierre(d)).toEqual([])
    expect(esPreliminar(d)).toBe(false)
  })
  test('sala completa en precierre', () => {
    const d = structuredClone(mock)
    d.progreso.precierre = true
    d.progreso.por_mesa.forEach((m) => (m.precierre = true))
    expect(avisosPrecierre(d)[0].texto).toBe('Toda la sala votó')
  })
  test('preliminar si la mesa del alcance está en precierre', () => {
    expect(esPreliminar(mock)).toBe(true) // alcance Mesa 1 en precierre, R2 abierta
    const d = structuredClone(mock)
    d.alcance = { tipo: 'mesa', mesa_id: 'm2', mesa_nombre: 'Mesa 2' }
    expect(esPreliminar(d)).toBe(false)
    d.alcance = { tipo: 'sala', mesa_id: null, mesa_nombre: null }
    expect(esPreliminar(d)).toBe(false)
    // La API real manda preliminar: true con la ronda abierta aunque no haya precierre: no cuenta.
    d.preliminar = true
    expect(esPreliminar(d)).toBe(false)
    expect(insigniaResultado(d)).toBe('en_vivo')
    expect(insigniaResultado(mock)).toBe('preliminar')
    d.sala.estado = 'r2_cerrada'
    expect(insigniaResultado(d)).toBe(null)
  })
})

describe('formato', () => {
  test('coma decimal y sin dato', () => {
    expect(numero(4.893)).toBe('4,89')
    expect(numero(5, 1)).toBe('5,0')
    expect(numero(null)).toBe('Sin votos')
    expect(delta(4.9, 5.1)).toBe('+0,20')
    expect(delta(5.4, 4.3)).toBe('−1,10')
    expect(delta(5, 5)).toBe('=')
    expect(delta(null, 5)).toBeNull()
  })
  test('sin rayas en los textos', () => {
    const textos = [mensajeVacio(sinVotos(mock, 2), 'comparacion'), ...avisosPrecierre(mock).map((a) => a.texto)]
    for (const t of textos) expect(t).not.toMatch(/[—–]/)
    // Ni en el código del tablero (textos visibles, ayudas y comentarios).
    const fuentes = [...readdirSync(__dirname), 'matriz/matriz.js'].filter((n) => /\.(tsx?|css|js)$/.test(n) && !n.includes('.test.'))
    expect(fuentes).toContain('PaginaTablero.tsx')
    for (const f of fuentes) expect(readFileSync(join(__dirname, f), 'utf8'), f).not.toMatch(/[—–]/)
  })
})

describe('URL de la API', () => {
  test('alcance sala o mesa y token', () => {
    expect(urlApiTablero('s_demo', {})).toBe('/api/tablero/s_demo?alcance=sala')
    expect(urlApiTablero('s_demo', { mesa: 'm2', t: 'abc' })).toBe('/api/tablero/s_demo?alcance=mesa&mesa=m2&t=abc')
  })
})

describe('polling con ETag', () => {
  const respuesta = (status: number, cuerpo?: unknown, headers: Record<string, string> = {}) =>
    new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), { status, headers })

  test('200 trae datos y ETag; 304 no cambia nada', async () => {
    let enviado: HeadersInit | undefined
    const f = (async (_u: string, init?: RequestInit) => {
      enviado = init?.headers
      return respuesta(200, mock, { ETag: '"v-000123"' })
    }) as typeof fetch
    const r = await pedirTablero('/api/tablero/s_demo', null, f)
    expect(r.tipo).toBe('nuevo')
    if (r.tipo === 'nuevo') expect(r.etag).toBe('"v-000123"')
    expect(enviado).not.toHaveProperty('If-None-Match')

    const f304 = (async (_u: string, init?: RequestInit) => {
      enviado = init?.headers
      return respuesta(304)
    }) as typeof fetch
    expect(await pedirTablero('/x', '"v-000123"', f304)).toEqual({ tipo: 'igual' })
    expect(enviado).toHaveProperty('If-None-Match', '"v-000123"')
  })

  test('errores con texto útil', async () => {
    const f403 = (async () => respuesta(403, { error: { codigo: 'TOKEN_INVALIDO', mensaje: 'x' } })) as typeof fetch
    const r = await pedirTablero('/x', null, f403)
    expect(r).toMatchObject({ tipo: 'error', status: 403, codigo: 'TOKEN_INVALIDO' })
    if (r.tipo === 'error') expect(r.mensaje).toBe('Este enlace del tablero no tiene permiso. Pide al facilitador el enlace completo del tablero.')
    expect([401, 403].map(esSinPermiso)).toEqual([true, true])
    expect([0, 404, 500].map(esSinPermiso)).toEqual([false, false, false])

    const caido = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await pedirTablero('/x', null, caido)).toMatchObject({ tipo: 'error', codigo: 'SIN_CONEXION' })

    // QA-T-05: la sala existe pero la mesa del enlace no.
    const f404 = (async () => respuesta(404, { error: { codigo: 'MESA_NO_EXISTE', mensaje: 'Esa mesa no existe en esta sala.' } })) as typeof fetch
    expect(await pedirTablero('/x', null, f404)).toMatchObject({ codigo: 'MESA_NO_EXISTE', mensaje: 'No encontramos esta mesa en la sala. Revisa el enlace del tablero.' })
    const sala404 = (async () => respuesta(404, { error: { codigo: 'SALA_NO_EXISTE', mensaje: 'x' } })) as typeof fetch
    expect(await pedirTablero('/x', null, sala404)).toMatchObject({ mensaje: 'No encontramos esta sala. Revisa el enlace del tablero.' })

    const f500 = (async () => respuesta(500, { error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo falló en el servidor.' } })) as typeof fetch
    expect(await pedirTablero('/x', null, f500)).toMatchObject({ mensaje: 'Algo falló en el servidor.' })

    // proxy que devuelve el index.html del SPA con 200
    const html = (async () => new Response('<!doctype html><html></html>', { status: 200 })) as typeof fetch
    expect(await pedirTablero('/x', null, html)).toMatchObject({ tipo: 'error', codigo: 'RESPUESTA_INVALIDA' })
  })
})
