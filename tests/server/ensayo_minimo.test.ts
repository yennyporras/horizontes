// Salas de ensayo (decisión de Paola del 21-oct): resultados desde 1 voto y fotos que se renuevan con cada voto, para
// probar sin juntar 3 personas. Un taller con cliente conserva el mínimo de 3.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type Entorno, accion, crearEntorno, crearSala, inscribir, votar } from './ayuda'

let e: Entorno
beforeEach(async () => {
  e = await crearEntorno()
})
afterEach(async () => {
  await e.app.close()
})

async function salaConUnVoto(tipo: 'taller' | 'ensayo') {
  const s = await crearSala(e, 1, `Sala ${tipo}`, { tipo })
  await accion(e, s.id, 'abrir_inscripcion')
  const t = (await inscribir(e, s.mesas[0].codigo, `una.${tipo}@example.com`)).json().token as string
  await inscribir(e, s.mesas[0].codigo, `otra.${tipo}@example.com`)
  await accion(e, s.id, 'abrir_ronda_1')
  expect((await votar(e, t, 'insumex', 1)).statusCode).toBe(200)
  await accion(e, s.id, 'cerrar_ronda_1')
  const r = await e.app.inject({ url: `/api/tablero/${s.id}?t=${s.token_tablero}` })
  return r.json()
}

describe('mínimo de votos según el tipo de sala', () => {
  it('taller con cliente: con 1 voto no muestra resultados (mínimo 3)', async () => {
    const t = await salaConUnVoto('taller')
    expect(t.minimo_votos).toBe(3)
    expect(t.ensayo).toBeUndefined()
    const r1 = t.proyectos_vivos.find((p: { id: string }) => p.id === 'insumex').rondas.find((r: { ronda: number }) => r.ronda === 1)
    expect(r1.bajo_minimo).toBe(true)
    expect(r1.promedios).toBeNull()
  })

  it('ensayo: con 1 voto ya muestra el resultado y lo marca como ensayo', async () => {
    const t = await salaConUnVoto('ensayo')
    expect(t.minimo_votos).toBe(1)
    expect(t.votos_por_actualizacion).toBe(1)
    expect(t.ensayo).toBe(true)
    const r1 = t.proyectos_vivos.find((p: { id: string }) => p.id === 'insumex').rondas.find((r: { ronda: number }) => r.ronda === 1)
    expect(r1.bajo_minimo).toBeUndefined()
    expect(r1.n_votos).toBe(1)
    expect(r1.promedios).not.toBeNull()
  })
})
