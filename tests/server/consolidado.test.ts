// D2 (20-oct): consolidado en vivo de 3 en 3. Reproduce el ataque de la auditoría (S-2): consultar el resultado antes y
// después de un voto nuevo y restar para despejarlo. Con la foto congelada ya no se reconstruye.
// Desde la decisión 1 de Paola (R1 oculta, 20-oct) el tablero público y el celular no muestran la ronda 1 abierta: el
// consolidado en vivo que todos ven es el de la ronda 2, así que el ataque se reproduce con la ronda 2 abierta.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { vistasEnCache } from '../../server/dominio/resultados'
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

describe('S-2: un voto nuevo ya no se despeja comparando consultas', () => {
  it('reproduce el ataque por /api/resultados: tras un voto la foto no cambia; tras 3 votos cambia mezclada', async () => {
    const { s, tres } = await salaConTres()
    const antes = (await resultados(tres[0].token)).json()
    expect(antes.votos_por_actualizacion).toBe(3)
    expect(insumexR2(antes).n_votos).toBe(3)

    const victima = await persona(s.mesas[2].codigo, 'victima@x.co')
    expect((await votar(e, victima.token, 'insumex', 2, SECRETO)).statusCode).toBe(200)
    const despues1 = (await resultados(tres[0].token)).json()
    // La foto sigue igual: mismo n_votos, mismos promedios y misma distribución.
    expect(despues1.proyectos_vivos).toEqual(antes.proyectos_vivos)
    expect(reconstruir(insumexR2(antes), insumexR2(despues1))).toBeNull()

    // Con 2 votos más de otras personas (3 cambios) la foto se renueva, pero la diferencia mezcla 3 votos.
    const o1 = await persona(s.mesas[1].codigo, 'o1@x.co')
    expect((await votar(e, o1.token, 'insumex', 2, OTRO_1)).statusCode).toBe(200)
    expect((await resultados(tres[0].token)).json().proyectos_vivos).toEqual(antes.proyectos_vivos)
    const o2 = await persona(s.mesas[1].codigo, 'o2@x.co')
    expect((await votar(e, o2.token, 'insumex', 2, OTRO_2)).statusCode).toBe(200)
    const despues3 = (await resultados(tres[0].token)).json()
    expect(insumexR2(despues3).n_votos).toBe(6)
    expect(reconstruir(insumexR2(antes), insumexR2(despues3))).toBeNull()
    for (const c of Object.keys(SECRETO)) {
      const suma = Object.values(insumexR2(despues3).distribucion[c] as Resp).reduce((a, n) => a + n, 0)
      expect(suma).toBe(6)
    }
  })

  it('igual en el tablero (sala y mesa) y en /api/yo', async () => {
    const { s, tres } = await salaConTres()
    const salaAntes = insumexR2((await tablero(s)).json())
    const mesaAntes = insumexR2((await tablero(s, `&alcance=mesa&mesa=${s.mesas[0].id}`)).json())
    const yoAntes = insumexR2((await yo(tres[1].token)).json().resultados)
    const otra = await persona(s.mesas[0].codigo, 'victima@x.co')
    expect((await votar(e, otra.token, 'insumex', 2, SECRETO)).statusCode).toBe(200)
    expect(insumexR2((await tablero(s)).json())).toEqual(salaAntes)
    expect(insumexR2((await tablero(s, `&alcance=mesa&mesa=${s.mesas[0].id}`)).json())).toEqual(mesaAntes)
    expect(insumexR2((await yo(tres[1].token)).json().resultados)).toEqual(yoAntes)
  })

  it('una persona que cambia su voto muchas veces cuenta como un solo cambio: no fuerza la renovación', async () => {
    const { s, tres } = await salaConTres()
    const antes = insumexR2((await resultados(tres[0].token)).json())
    const victima = await persona(s.mesas[1].codigo, 'victima@x.co')
    await votar(e, victima.token, 'insumex', 2, SECRETO)
    // Quien ataca conoce su propio voto y lo cambia dos veces para sumar «3 votos nuevos».
    await votar(e, tres[0].token, 'insumex', 2, OTRO_1)
    await votar(e, tres[0].token, 'insumex', 2, OTRO_2)
    expect(insumexR2((await resultados(tres[0].token)).json())).toEqual(antes)
  })

  it('antes de la primera foto con valores solo se ve el conteo (bajo el mínimo), sin promedios ni distribución', async () => {
    const s = await crearSala(e, 1)
    await abrirR2(s.id)
    const a = await persona(s.mesas[0].codigo, 'a@x.co')
    const b = await persona(s.mesas[0].codigo, 'b@x.co')
    await votar(e, a.token, 'insumex', 2)
    expect(insumexR2((await tablero(s)).json())).toMatchObject({ n_votos: 1, bajo_minimo: true, promedios: null, distribucion: null })
    await votar(e, b.token, 'insumex', 2, SECRETO)
    expect(insumexR2((await tablero(s)).json())).toMatchObject({ n_votos: 2, bajo_minimo: true, promedios: null })
    const c = await persona(s.mesas[0].codigo, 'c@x.co')
    await votar(e, c.token, 'insumex', 2)
    const tres = insumexR2((await tablero(s)).json())
    expect(tres.n_votos).toBe(3)
    expect(tres).not.toHaveProperty('bajo_minimo')
    expect(tres.promedios.conocimiento_cliente).toBeCloseTo(19 / 3, 9)
  })
})

describe('ronda cerrada, reabierta y reiniciada', () => {
  it('al cerrar la ronda se publica el exacto; al reabrirla, la foto parte del exacto que se mostró', async () => {
    const { s, tres } = await salaConTres()
    await tablero(s) // foto con 3
    const v = await persona(s.mesas[1].codigo, 'v@x.co')
    await votar(e, v.token, 'insumex', 2, SECRETO)
    expect(insumexR2((await tablero(s)).json()).n_votos).toBe(3)
    await accion(e, s.id, 'cerrar_ronda_2')
    const exacto = insumexR2((await tablero(s)).json())
    expect(exacto.n_votos).toBe(4)
    expect(exacto.promedios.alineacion_core).toBeCloseTo((5 * 3 + 1) / 4, 9)

    await accion(e, s.id, 'reabrir_ronda')
    const w = await persona(s.mesas[1].codigo, 'w@x.co')
    await votar(e, w.token, 'insumex', 2, OTRO_1)
    // Un voto después del exacto no cambia lo publicado (si partiera de la foto de 3, lo despejaría el exacto de 4).
    expect(insumexR2((await tablero(s)).json())).toEqual(exacto)
    expect(insumexR2((await resultados(tres[0].token)).json())).toEqual(exacto)
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
