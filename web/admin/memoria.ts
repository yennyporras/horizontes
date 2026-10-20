// Lo que el panel recuerda en este navegador (localStorage). Puede fallar: modo privado, almacenamiento bloqueado o
// lleno. Si falla, el panel sigue funcionando y solo olvida; nunca se cae por esto.

export function leer(llave: string): string | null {
  try {
    return window.localStorage.getItem(llave)
  } catch {
    return null
  }
}

export function guardar(llave: string, valor: string): void {
  try {
    window.localStorage.setItem(llave, valor)
  } catch {
    // Sin almacenamiento: el panel no recuerda, pero sigue.
  }
}

export function borrar(llave: string): void {
  try {
    window.localStorage.removeItem(llave)
  } catch {
    // Igual que arriba.
  }
}

const LLAVE_SALA = 'hz_admin_sala'

/** Última sala abierta en este navegador: las secciones de sala del menú la usan. */
export function recordarSala(id: string) {
  if (leer(LLAVE_SALA) !== id) guardar(LLAVE_SALA, id)
}

export function salaRecordada(): string | null {
  return leer(LLAVE_SALA)
}

/** La sala recordada ya no existe (otra base, sala de otro ambiente): las secciones vuelven a pedir sala. */
export function olvidarSala(id: string) {
  if (salaRecordada() === id) borrar(LLAVE_SALA)
}
