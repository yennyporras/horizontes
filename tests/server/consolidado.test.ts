// D2 (20-oct): consolidado en vivo de 3 en 3 contra el ataque S-2 de la auditoría (restar dos consultas para despejar un
// voto). Desde el 21-oct (decisión de Paola: «cada voto en todas siempre en anonimato») el tablero y los celulares se
// actualizan con cada voto en todas las salas; el anonimato es que ninguna vista pública muestra nombres. El mecanismo
// de la foto con umbral se conserva y se prueba directo, por si vuelve.
// Desde la decisión 1 de Paola (R1 oculta, 20-oct) el tablero público y el celular no muestran la ronda 1 abierta: el
// consolidado en vivo que todos ven es el de la ronda 2, así que el ataque se reproduce con la ronda 2 abierta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { agregadoPublicado } from '../../server/dominio/fotos'
import { contenido, vistasEnCache } from '../../server/dominio/resultados'
import { type Entorno, RESPUESTAS_5, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

type Resp = Record<string, number>
const SECRETO: Resp = { alistamiento_tecnico: 1, conocimiento_cliente: 9, regulacion: 3, capacidades_organizacionales: 7, alineacion_core: 1, inversion_requerida: 9 }
const OTRO_1: Resp = { alistamiento_tecnico: 3, conocimiento_cliente: 3, regulacion: 9, capacidades_organizacionales: 1, alineacion_core: 7, inversion_requerida: 3 }
const OTRO_2: Resp = { alistamiento_tecnico: 7, conocimiento_cliente: 1, regulacion: 1, capacidades_organizacionales: 3, alineacion_core: 3, inversion_requerida: 1 }

const resultados = (token: string) => e.app.inject({ url: '/api/resultados?ronda=2', headers: { 'x-participante-token': token } })
const yo = (token: string) => e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })
const tablero = (s: { id: string; token_tablero: string }, q = '') => e.app.inject(`/api/tablero/${s.id}?t=${s.token_tablero}${q}`)
const insumexR2 = (t: any) => t.proyectos_vivos.find((p: any) => p.id === 'insumex').rondas.find((r: any) => r.ronda === 2)

/** Ronda 1 abierta y cerrada sin votos, ronda 2 abierta. */
async function abrirR2(salaId: string) {
  for (const a of ['abrir_ronda_1', 'cerrar_ronda_1', 'abrir_ronda_2']) expect((await accion(e, salaId, a)).statusCode).toBe(200)
}

async function persona(codigo: string, correo: string) {
  const r = await inscribir(e, codigo, correo)
  expect(r.statusCode).toBe(201)
  return r.json() as { token: string; participante: { id: string } }
}

/** El ataque de la auditoría: la distribución de después menos la de antes; si un solo bucket sube en 1 por criterio, es el voto. */
function reconstruir(antes: any, despues: any): Resp | null {
  const rec: Resp = {}
  for (const c of Object.keys(SECRETO)) {
    const dif = Object.keys(despues.distribucion[c]).filter((k) => despues.distribucion[c][k] - (antes.distribucion?.[c]?.[k] ?? 0) !== 0)
    if (dif.length !== 1 || despues.distribucion[c][dif[0]] - (antes.distribucion?.[c]?.[dif[0]] ?? 0) !== 1) return null
    rec[c] = Number(dif[0])
  }
  return rec
}

/** Sala de 3 mesas con la ronda 2 abierta y 3 personas de la mesa 1 que ya votaron los 2 proyectos con 5. */
async function salaConTres() {
  const s = await crearSala(e, 3)
  await accion(e, s.id, 'abrir_inscripcion')
  await abrirR2(s.id)
  const tres = []
  for (let i = 0; i < 3; i++) {
    const p = await persona(s.mesas[0].codigo, `a${i}@x.co`)
    for (const pr of ['insumex', 'nutriwhat']) expect((await votar(e, p.token, pr, 2)).statusCode).toBe(200)
    tres.push(p)
  }
  return { s, tres }
}

describe('cada voto en vivo en todas las salas (decisión de Paola del 21-oct)', () => {
  it('un taller con cliente muestra el resultado desde 1 voto y lo actualiza con cada voto', async () => {
    const s = await crearSala(e, 1)
    await abrirR2(s.id)
    const a = await persona(s.mesas[0].codigo, 'a@x.co')
    await votar(e, a.token, 'insumex', 2, SECRETO)
    const uno = (await tablero(s)).json()
    expect(uno.minimo_votos).toBe(1)
    expect(uno.votos_por_actualizacion).toBe(1)
    expect(uno).not.toHaveProperty('ensayo')
    expect(insumexR2(uno)).toMatchObject({ n_votos: 1, promedios: SECRETO })
    expect(insumexR2(uno)).not.toHaveProperty('bajo_minimo')
    const b = await persona(s.mesas[0].codigo, 'b@x.co')
    await votar(e, b.token, 'insumex', 2, OTRO_1)
    const dos = insumexR2((await tablero(s)).json())
    expect(dos.n_votos).toBe(2)
    expect(dos.promedios.regulacion).toBeCloseTo((3 + 9) / 2, 9)
    // Cambiar el voto también se ve en la siguiente consulta.
    await votar(e, b.token, 'insumex', 2, OTRO_2)
    expect(insumexR2((await tablero(s)).json()).promedios.regulacion).toBeCloseTo((3 + 1) / 2, 9)
  })

  it('igual en el tablero (sala y mesa), en /api/resultados y en /api/yo, sin nombres ni correos', async () => {
    const { s, tres } = await salaConTres()
    const otra = await persona(s.mesas[0].codigo, 'victima@x.co')
    expect((await votar(e, otra.token, 'insumex', 2, SECRETO)).statusCode).toBe(200)
    const vistas = [
      (await tablero(s)).json(),
      (await tablero(s, `&alcance=mesa&mesa=${s.mesas[0].id}`)).json(),
      (await resultados(tres[0].token)).json(),
      (await yo(tres[1].token)).json().resultados,
    ]
    for (const v of vistas) {
      expect(insumexR2(v).n_votos).toBe(4)
      expect(insumexR2(v).promedios.alineacion_core).toBeCloseTo((5 * 3 + 1) / 4, 9)
      const texto = JSON.stringify(v)
      expect(texto).not.toContain('Persona Prueba')
      expect(texto).not.toContain('@x.co')
      expect(texto).not.toContain(otra.participante.id)
    }
  })
})

describe('foto del consolidado con umbral (se conserva por si vuelve el mínimo)', () => {
  it('con umbral 3, un voto nuevo no cambia lo publicado y 3 cambios lo renuevan; con umbral 1, cada voto', async () => {
    const pesos = contenido(e.db, (await crearSala(e, 1)).id).pesos
    const v = (id: string, r: Resp) => ({ participante_id: id, entradas: r as never })
    const k = (umbral: number) => ({ salaId: 'x', alcance: 'sala', ronda: 2, proyectoId: 'insumex', versionSala: 1, umbral })
    const base = [v('a', RESPUESTAS_5), v('b', RESPUESTAS_5), v('c', RESPUESTAS_5)]
    const p0 = agregadoPublicado(e.db, k(3), base, pesos, false)
    expect(p0.n_votos).toBe(3)
    expect(agregadoPublicado(e.db, k(3), [...base, v('d', SECRETO)], pesos, false)).toEqual(p0)
    const p3 = agregadoPublicado(e.db, k(3), [...base, v('d', SECRETO), v('e', OTRO_1), v('f', OTRO_2)], pesos, false)
    expect(p3.n_votos).toBe(6)
    const p4 = agregadoPublicado(e.db, k(1), [...base, v('d', SECRETO), v('e', OTRO_1), v('f', OTRO_2), v('g', SECRETO)], pesos, false)
    expect(p4.n_votos).toBe(7)
  })
})

describe('ronda cerrada, reabierta y reiniciada', () => {
  it('al cerrar la ronda se publica el exacto; al reabrirla, cada voto nuevo se ve de inmediato', async () => {
    const { s, tres } = await salaConTres()
    await tablero(s)
    const v = await persona(s.mesas[1].codigo, 'v@x.co')
    await votar(e, v.token, 'insumex', 2, SECRETO)
    expect(insumexR2((await tablero(s)).json()).n_votos).toBe(4)
    await accion(e, s.id, 'cerrar_ronda_2')
    const exacto = insumexR2((await tablero(s)).json())
    expect(exacto.n_votos).toBe(4)
    expect(exacto.promedios.alineacion_core).toBeCloseTo((5 * 3 + 1) / 4, 9)

    await accion(e, s.id, 'reabrir_ronda')
    const w = await persona(s.mesas[1].codigo, 'w@x.co')
    await votar(e, w.token, 'insumex', 2, OTRO_1)
    expect(insumexR2((await tablero(s)).json()).n_votos).toBe(5)
    expect(insumexR2((await resultados(tres[0].token)).json()).n_votos).toBe(5)
  })

  it('reiniciar la ronda borra las fotos de esa ronda', async () => {
    const { s } = await salaConTres()
    await tablero(s)
    expect(Number((e.db.prepare('SELECT COUNT(*) AS n FROM fotos_agregado WHERE sala_id = ?').get(s.id) as { n: number }).n)).toBeGreaterThan(0)
    await accion(e, s.id, 'reiniciar_ronda')
    expect(Number((e.db.prepare('SELECT COUNT(*) AS n FROM fotos_agregado WHERE sala_id = ? AND ronda = 2').get(s.id) as { n: number }).n)).toBe(0)
    expect(insumexR2((await tablero(s)).json()).n_votos).toBe(0)
  })
})

describe('progreso.por_mesa y caché', () => {
  it('las vistas del participante no traen progreso.por_mesa; el tablero sí', async () => {
    const { s, tres } = await salaConTres()
    const r = (await resultados(tres[0].token)).json()
    expect(Object.keys(r.progreso).sort()).toEqual(['completos', 'inscritos', 'precierre'])
    expect((await yo(tres[0].token)).json().resultados.progreso).not.toHaveProperty('por_mesa')
    expect((await tablero(s)).json().progreso.por_mesa).toHaveLength(3)
  })

  it('la caché es por alcance: muchos celulares del mismo alcance comparten una vista y cada uno conserva su ETag', async () => {
    const { s, tres } = await salaConTres()
    const vistas = await Promise.all(tres.map(async (p) => (await resultados(p.token)).json()))
    expect(new Set(vistas.map((v) => v.version)).size).toBe(3)
    const sinVersion = vistas.map(({ version: _, ...v }) => v)
    expect(sinVersion[1]).toEqual(sinVersion[0])
    expect(sinVersion[2]).toEqual(sinVersion[0])
    expect(vistasEnCache(e.db, s.id)).toBe(1)
    await tablero(s)
    expect(vistasEnCache(e.db, s.id)).toBe(2)
    // Un voto sube la versión: la caché de la sala se descarta entera.
    await votar(e, tres[0].token, 'insumex', 2, { ...RESPUESTAS_5, regulacion: 9 })
    await resultados(tres[0].token)
    expect(vistasEnCache(e.db, s.id)).toBe(1)
  })
})
