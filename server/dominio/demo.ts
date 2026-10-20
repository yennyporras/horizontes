// Modo demo (QA por roles, 20-oct): una sala «Demostración» que se juega sola en cerca de un minuto, para mostrar el
// taller sin gente. Crea la sala (tipo ensayo, 4 mesas, Colombia) y en segundo plano inscribe 24 personas de ejemplo,
// abre la ronda 1, las hace votar repartidas en el tiempo, la cierra, abre la ronda 2, votan otra vez y la cierra.
// Usa las mismas funciones que la API (inscripción, voto, acciones), así el panel, el tablero y los celulares la ven
// como una sala real. Los temporizadores viven en memoria: si el servidor se reinicia a mitad, la sala queda donde iba.
import type { Db } from '../db/index.js'
import { ErrorApi } from '../http.js'
import { generadorRealista } from '../../shared/simulacion/distribuciones.js'
import { VERSION_CONSENTIMIENTO } from './consentimiento.js'
import { aplicarAccion } from './estados.js'
import { autenticarParticipante, inscribir, votar } from './participantes.js'
import { vivos } from './resultados.js'
import { type SalaFila, cargarSala, crearSalaDesdePlantilla, mesasDeSala } from './salas.js'
import type { Reloj } from './util.js'

export interface TiemposDemo {
  /** En cuánto tiempo se inscriben las 24 personas. */
  inscripcionMs: number
  /** En cuánto tiempo votan todas en cada ronda. */
  rondaMs: number
  /** Pausa entre un paso y el siguiente (abrir, cerrar). */
  pausaMs: number
}

/** Unos 60 s en total: 3 de inscripción, 25 por ronda y pausas de 2. */
export const TIEMPOS_DEMO: TiemposDemo = { inscripcionMs: 3_000, rondaMs: 25_000, pausaMs: 2_000 }
export const NOMBRE_SALA_DEMO = 'Demostración'
export const PERSONAS_DEMO = 24
export const MESAS_DEMO = 4

const NOMBRES = [
  'Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gloria', 'Hernán', 'Inés', 'Julián', 'Karina', 'Luis',
  'Marta', 'Nicolás', 'Olga', 'Pablo', 'Rosa', 'Samuel', 'Tatiana', 'Ulises', 'Valeria', 'Wilson', 'Ximena', 'Yesid',
]

type Paso = { enMs: number; hacer: () => void }

export class Demostracion {
  private temporizadores = new Set<ReturnType<typeof setTimeout>>()
  private sala: string | null = null

  constructor(
    private db: Db,
    private ahora: Reloj,
    private tiempos: TiemposDemo = TIEMPOS_DEMO,
    private alFallar: (e: unknown) => void = () => {},
  ) {}

  /** Id de la sala de la demostración en curso, o null. */
  enCurso(): string | null {
    return this.sala
  }

  /** Crea la sala y programa la demostración. 409 DEMO_EN_CURSO si ya hay una corriendo. */
  iniciar(por: string): SalaFila {
    if (this.sala) throw new ErrorApi(409, 'DEMO_EN_CURSO', 'Ya hay una demostración en curso. Espera a que termine (cerca de un minuto).')
    const db = this.db
    const sala = crearSalaDesdePlantilla(db, { nombre: NOMBRE_SALA_DEMO, plantilla: 'foodsume_2026', mesas: MESAS_DEMO, tipo: 'ensayo' }, this.ahora(), por)
    this.sala = sala.id
    const mesas = mesasDeSala(db, sala.id)
    const proyectos = vivos(db, sala.id).map((p) => p.id)
    const gen = generadorRealista(this.ahora() % 1_000_000, MESAS_DEMO)
    const tokens: string[] = []
    const { inscripcionMs, rondaMs, pausaMs } = this.tiempos
    const accion = (a: string) => aplicarAccion(db, sala.id, a, this.ahora(), 'demo')

    const pasos: Paso[] = [{ enMs: 0, hacer: () => accion('abrir_inscripcion') }]
    for (let i = 0; i < PERSONAS_DEMO; i++) {
      pasos.push({
        enMs: ((i + 1) * inscripcionMs) / (PERSONAS_DEMO + 1),
        hacer: () => {
          const r = inscribir(
            db,
            {
              codigoMesa: mesas[i % MESAS_DEMO].codigo,
              nombre: `${NOMBRES[i]} Ejemplo`,
              correo: `persona${i + 1}@example.com`,
              consentimiento: { aceptado: true, version: VERSION_CONSENTIMIENTO },
            },
            { userAgent: 'demostracion' },
            this.ahora(),
          )
          tokens[i] = r.token
        },
      })
    }
    let t = inscripcionMs + pausaMs
    for (const ronda of [1, 2] as const) {
      pasos.push({ enMs: t, hacer: () => accion(`abrir_ronda_${ronda}`) })
      // Cada persona vota los 2 proyectos; los votos se reparten parejo en la ronda, primero un proyecto y luego el otro.
      const votos = proyectos.flatMap((proyecto) => Array.from({ length: PERSONAS_DEMO }, (_, i) => ({ i, proyecto })))
      votos.forEach(({ i, proyecto }, k) => {
        pasos.push({
          enMs: t + ((k + 1) * rondaMs) / (votos.length + 1),
          hacer: () => {
            const p = autenticarParticipante(db, tokens[i])
            votar(db, p, { proyecto_id: proyecto, ronda, respuestas: gen.respuestas(i, i % MESAS_DEMO, proyecto, ronda) }, {}, this.ahora())
          },
        })
      })
      t += rondaMs + pausaMs
      pasos.push({ enMs: t, hacer: () => accion(`cerrar_ronda_${ronda}`) })
      t += pausaMs
    }
    const ultimo = pasos.length - 1
    pasos.forEach((p, k) => this.programar(p.enMs, () => this.paso(p.hacer, k === ultimo)))
    return cargarSala(db, sala.id)
  }

  /** Corre un paso. Si falla (alguien cerró la sala a mano, por ejemplo), la demostración se detiene ahí. */
  private paso(hacer: () => void, ultimo: boolean) {
    if (!this.sala) return
    try {
      hacer()
      if (ultimo) this.detener()
    } catch (e) {
      this.detener()
      this.alFallar(e)
    }
  }

  private programar(ms: number, fn: () => void) {
    const t = setTimeout(() => {
      this.temporizadores.delete(t)
      fn()
    }, ms)
    t.unref?.()
    this.temporizadores.add(t)
  }

  /** Cancela lo que falte (al cerrar la app). La sala queda en el estado al que llegó. */
  detener() {
    for (const t of this.temporizadores) clearTimeout(t)
    this.temporizadores.clear()
    this.sala = null
  }
}
