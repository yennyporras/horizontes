import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import type { DatosTablero } from './tipos'
import {
  avisosPrecierre,
  delta,
  esPreliminar,
  mensajeVacio,
  numero,
  pedirTablero,
  rondaEnFoco,
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
    expect(mensajeVacio(d, 1)).toBe('Aún no hay votos en la ronda 1')
    expect(mensajeVacio(d, 'comparacion')).toBe('Aún no hay votos en la ronda 1')
    expect(mensajeVacio(d, 2)).toBe('Aún no hay votos en la ronda 2')
  })
  test('R1 con votos y R2 vacía', () => {
    const d = sinVotos(mock, 2)
    expect(mensajeVacio(d, 1)).toBeNull()
    expect(mensajeVacio(d, 'comparacion')).toMatch(/solo la ronda 1/)
    expect(rondaEnFoco(d, 'comparacion')).toBe(1)
    expect(rondaEnFoco(mock, 'comparacion')).toBe(2)
  })
  test('datos nulos', () => {
    expect(mensajeVacio(null, 1)).toBe('Aún no hay votos en la ronda 1')
    expect(avisosPrecierre(null)).toEqual([])
    expect(esPreliminar(null)).toBe(false)
  })
})

describe('precierre y preliminar', () => {
  test('aviso por mesa en precierre con ronda abierta', () => {
    expect(avisosPrecierre(mock)).toEqual(['Mesa 1: todos votaron'])
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
    expect(avisosPrecierre(d)[0]).toBe('Toda la sala votó')
  })
  test('preliminar si la mesa del alcance está en precierre', () => {
    expect(esPreliminar(mock)).toBe(true) // alcance Mesa 1 en precierre, R2 abierta
    const d = structuredClone(mock)
    d.alcance = { tipo: 'mesa', mesa_id: 'm2', mesa_nombre: 'Mesa 2' }
    expect(esPreliminar(d)).toBe(false)
    d.alcance = { tipo: 'sala' }
    expect(esPreliminar(d)).toBe(false)
    d.preliminar = true
    expect(esPreliminar(d)).toBe(true)
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
    const textos = [mensajeVacio(sinVotos(mock, 2), 'comparacion'), ...avisosPrecierre(mock)]
    for (const t of textos) expect(t).not.toContain('—')
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
    if (r.tipo === 'error') expect(r.mensaje).toMatch(/token/)

    const caido = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await pedirTablero('/x', null, caido)).toMatchObject({ tipo: 'error', codigo: 'SIN_CONEXION' })

    const f500 = (async () => respuesta(500, { error: { codigo: 'ERROR_INTERNO', mensaje: 'Algo falló en el servidor.' } })) as typeof fetch
    expect(await pedirTablero('/x', null, f500)).toMatchObject({ mensaje: 'Algo falló en el servidor.' })
  })
})
