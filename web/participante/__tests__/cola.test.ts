// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encolar, enviarCola, leerCola, quitar } from '../cola'

const C = 'HZ7K2-1'
const R = { alistamiento_tecnico: 5, conocimiento_cliente: 5, regulacion: 5, capacidades_organizacionales: 5, alineacion_core: 5, inversion_requerida: 5 }
const voto = (id: string, participante_id = 'p1') => ({ id, participante_id, proyecto_id: 'insumex', nombre: 'INSUMEX', ronda: 1, respuestas: R })
const ok = () => new Response(JSON.stringify({ voto: {}, completo_ronda: false, progreso_mesa: { inscritos: 2, completos: 0, precierre: false } }), { status: 200 })

beforeEach(() => localStorage.clear())
afterEach(() => vi.unstubAllGlobals())

describe('cola de votos sin señal', () => {
  it('un reenvío viejo que responde tarde no borra la edición más nueva', async () => {
    encolar(C, voto('a1'))
    let soltar: () => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((r) => (soltar = () => r(ok())))))
    const envio = enviarCola(C, 'tok', 'p1')
    await Promise.resolve()
    encolar(C, voto('a2'))
    soltar()
    const hechos = await envio
    expect(hechos.map((h) => h.voto.id)).toEqual(['a1'])
    expect(leerCola(C).map((v) => v.id)).toEqual(['a2'])
  })

  it('no envía votos de otra persona con el token actual', async () => {
    encolar(C, voto('b1', 'otra'))
    const f = vi.fn()
    vi.stubGlobal('fetch', f)
    expect(await enviarCola(C, 'tok', 'p1')).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })

  it('sin red se detiene y conserva la cola; quitar sin id borra cualquier versión', async () => {
    encolar(C, voto('c1'))
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))))
    expect(await enviarCola(C, 'tok', 'p1')).toEqual([])
    expect(leerCola(C)).toHaveLength(1)
    expect(quitar(C, { proyecto_id: 'insumex', ronda: 1, id: 'otro' })).toHaveLength(1)
    expect(quitar(C, { proyecto_id: 'insumex', ronda: 1 })).toHaveLength(0)
  })
})
