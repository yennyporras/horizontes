// Persistencia en el dispositivo (DISENO §8): token en localStorage, borradores y vista en sessionStorage.
// Todo envuelto en try: en modo privado de algunos navegadores el almacenamiento falla y la app debe seguir.

function leer(almacen: () => Storage, clave: string): string | null {
  try {
    return almacen().getItem(clave)
  } catch {
    return null
  }
}

function escribir(almacen: () => Storage, clave: string, valor: string | null) {
  try {
    if (valor === null) almacen().removeItem(clave)
    else almacen().setItem(clave, valor)
  } catch {
    /* sin almacenamiento: se pierde al recargar, nada más */
  }
}

const local = () => window.localStorage
const sesion = () => window.sessionStorage
const clave = (tipo: string, codigo: string) => `hz_${tipo}:${codigo.toUpperCase()}`

export const leerToken = (codigo: string) => leer(local, clave('token', codigo))
export const guardarToken = (codigo: string, token: string | null) => escribir(local, clave('token', codigo), token)

/** Bienvenida con el perfil: solo la primera vez tras inscribirse. */
export const bienvenidaPendiente = (codigo: string) => leer(local, clave('bienvenida', codigo)) === '1'
export const marcarBienvenida = (codigo: string, pendiente: boolean) => escribir(local, clave('bienvenida', codigo), pendiente ? '1' : null)

/** Aviso "Ya puedes ver la información de los 6 perfiles": una sola vez. */
export const hojasAvisadas = (codigo: string) => leer(local, clave('hojas', codigo)) === '1'
export const marcarHojasAvisadas = (codigo: string) => escribir(local, clave('hojas', codigo), '1')

/** Pantalla en la que iba (inicio, lectura o calificar:{proyecto}) para volver tras recargar. */
export const leerVista = (codigo: string) => leer(sesion, clave('vista', codigo))
export const guardarVista = (codigo: string, vista: string) => escribir(sesion, clave('vista', codigo), vista)

/** Lo marcado y no guardado, por proyecto y ronda. */
export function leerBorrador(codigo: string, proyecto: string, ronda: number): Record<string, number> | null {
  const t = leer(sesion, clave(`borrador_${proyecto}_r${ronda}`, codigo))
  if (!t) return null
  try {
    return JSON.parse(t) as Record<string, number>
  } catch {
    return null
  }
}
export function guardarBorrador(codigo: string, proyecto: string, ronda: number, respuestas: Record<string, number> | null) {
  escribir(sesion, clave(`borrador_${proyecto}_r${ronda}`, codigo), respuestas ? JSON.stringify(respuestas) : null)
}

/**
 * Hasta el 20-oct el celular guardaba nombre y correo para recuperar la sesión con el correo. Desde la decisión D1
 * el acceso nuevo lo da el facilitador: esos datos ya no se guardan y se borran si quedaron de antes.
 */
export const olvidarDatos = (codigo: string) => escribir(local, clave('datos', codigo), null)
