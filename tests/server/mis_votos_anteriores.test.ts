// mis_votos_anteriores (aditivo del 20-oct): en la ronda 2, /api/yo trae también los votos propios de la ronda 1, para
// que la comparación R1→R2 del celular muestre «Tú» en las dos rondas. Solo los de la persona; mis_votos no cambia.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Entorno, RESPUESTAS_5, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

const yo = async (token: string) => (await e.app.inject({ url: '/api/yo', headers: { 'x-participante-token': token } })).json()

describe('mis_votos_anteriores en /api/yo', () => {
  it('vacío en la ronda 1; en la ronda 2 trae solo los votos propios de la ronda 1, y mis_votos solo los de la 2', async () => {
    const s = await crearSala(e, 1)
    await accion(e, s.id, 'abrir_inscripcion')
    const ana = (await inscribir(e, s.mesas[0].codigo, 'ana@example.com', 'Ana Prueba')).json().token as string
    const beto = (await inscribir(e, s.mesas[0].codigo, 'beto@example.com', 'Beto Prueba')).json().token as string
    await accion(e, s.id, 'abrir_ronda_1')
    const r1 = { ...RESPUESTAS_5, regulacion: 9 }
    expect((await votar(e, ana, 'insumex', 1, r1)).statusCode).toBe(200)
    expect((await votar(e, beto, 'insumex', 1, { ...RESPUESTAS_5, regulacion: 1 })).statusCode).toBe(200)
    expect((await yo(ana)).mis_votos_anteriores).toEqual([])

    await accion(e, s.id, 'cerrar_ronda_1')
    await accion(e, s.id, 'abrir_ronda_2')
    expect((await votar(e, ana, 'insumex', 2)).statusCode).toBe(200)
    const y = await yo(ana)
    expect(y.mis_votos.map((v: { ronda: number }) => v.ronda)).toEqual([2])
    expect(y.mis_votos_anteriores).toHaveLength(1)
    expect(y.mis_votos_anteriores[0]).toMatchObject({ proyecto_id: 'insumex', ronda: 1, respuestas: r1 })
    // Nada de Beto en lo de Ana.
    expect(JSON.stringify(y.mis_votos_anteriores)).not.toContain('"regulacion":1')
  })
})
