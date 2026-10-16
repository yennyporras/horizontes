// Cola de votos sin señal (resiliencia): si el PUT falla por red, el voto queda en este celular
// (localStorage, sobrevive a recargas) y se reenvía solo cuando vuelve la conexión.
import { ErrorApi, guardarVoto, type RespuestaVoto } from './api'

export interface VotoEnCola {
  /** Versión exacta del voto: un reenvío viejo no borra una edición más nueva del mismo proyecto. */
  id: string
  /** Dueño del voto: si en el celular entra otra persona, no se envía con su token. */
  participante_id: string
  proyecto_id: string
  /** Nombre del proyecto, para los avisos. */
  nombre: string
  ronda: number
  respuestas: Record<string, number>
}

const clave = (codigo: string) => `hz_cola:${codigo.toUpperCase()}`

export function leerCola(codigo: string): VotoEnCola[] {
  try {
    const t = window.localStorage.getItem(clave(codigo))
    const v = t ? (JSON.parse(t) as unknown) : []
    return Array.isArray(v) ? (v as VotoEnCola[]) : []
  } catch {
    return []
  }
}

function escribirCola(codigo: string, cola: VotoEnCola[]) {
  try {
    if (cola.length === 0) window.localStorage.removeItem(clave(codigo))
    else window.localStorage.setItem(clave(codigo), JSON.stringify(cola))
  } catch {
    /* sin almacenamiento: la cola vive solo en memoria de esta pantalla */
  }
}

/** Un voto por proyecto y ronda: el más reciente reemplaza al anterior. */
export function encolar(codigo: string, voto: VotoEnCola): VotoEnCola[] {
  const cola = [...leerCola(codigo).filter((v) => !(v.proyecto_id === voto.proyecto_id && v.ronda === voto.ronda)), voto]
  escribirCola(codigo, cola)
  return cola
}

export const nuevoId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Con `id` borra solo esa versión; sin `id`, cualquier versión de ese proyecto y ronda (se guardó en línea). */
export function quitar(codigo: string, voto: Pick<VotoEnCola, 'proyecto_id' | 'ronda'> & { id?: string }): VotoEnCola[] {
  const cola = leerCola(codigo).filter((v) => !(v.proyecto_id === voto.proyecto_id && v.ronda === voto.ronda && (!voto.id || v.id === voto.id)))
  escribirCola(codigo, cola)
  return cola
}

export type ResultadoEnvio =
  | { tipo: 'enviado'; voto: VotoEnCola; respuesta: RespuestaVoto }
  /** El servidor lo rechazó para siempre (ronda cerrada, respuesta inválida): sale de la cola. */
  | { tipo: 'rechazado'; voto: VotoEnCola; error: ErrorApi }

/**
 * Envía la cola en orden. Se detiene en el primer fallo de red o de sesión (401): esos votos siguen
 * en la cola para el siguiente intento. Devuelve lo que pasó con cada voto que salió de la cola.
 */
export async function enviarCola(codigo: string, token: string, participanteId: string): Promise<ResultadoEnvio[]> {
  const hechos: ResultadoEnvio[] = []
  for (const voto of leerCola(codigo)) {
    if (voto.participante_id !== participanteId) continue
    // Pudo cambiar mientras se enviaba el anterior (la persona editó otra vez): se envía la versión vigente.
    if (!leerCola(codigo).some((v) => v.id === voto.id)) continue
    try {
      const respuesta = await guardarVoto(token, { proyecto_id: voto.proyecto_id, ronda: voto.ronda, respuestas: voto.respuestas })
      quitar(codigo, voto)
      hechos.push({ tipo: 'enviado', voto, respuesta })
    } catch (e) {
      const ea = e instanceof ErrorApi ? e : new ErrorApi(0, 'SIN_RED', 'Sin conexión')
      if (ea.esRed || ea.status === 401 || ea.status === 429 || ea.status >= 500) break
      quitar(codigo, voto)
      hechos.push({ tipo: 'rechazado', voto, error: ea })
    }
  }
  return hechos
}
