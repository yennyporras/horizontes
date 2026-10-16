import { useEffect, useState } from 'react'

// Sin saltos de diseño (CLS): el texto aparece ya en Montserrat. La descarga empieza al importar
// este módulo, en paralelo con la primera llamada a la API; el esqueleto de carga cubre la espera.
// Tope de 1,5 s: con red muy lenta se muestra el texto con la fuente de respaldo (tokens.css).
const TOPE_MS = 1500

const PESOS = ['400', '500', '700', '800']
const fuente = (peso: string) => `${peso} 16px 'Montserrat Variable'`

// Ojo: document.fonts.status vale 'loaded' antes de que se pida cualquier fuente; check() sí dice si esta cargó.
let lista = typeof document === 'undefined' || !document.fonts || PESOS.every((p) => document.fonts.check(fuente(p), 'Áá'))

const promesa: Promise<void> = lista
  ? Promise.resolve()
  : Promise.race([
      Promise.all(PESOS.map((p) => document.fonts.load(fuente(p), 'Áá'))).then(() => undefined),
      new Promise<void>((r) => setTimeout(r, TOPE_MS)),
    ])
      .catch(() => undefined)
      .then(() => {
        lista = true
      })

/** true cuando Montserrat ya cargó (o venció el tope). */
export function usarFuenteLista(): boolean {
  const [ok, setOk] = useState(lista)
  useEffect(() => {
    if (ok) return
    let vivo = true
    void promesa.then(() => vivo && setOk(true))
    return () => {
      vivo = false
    }
  }, [ok])
  return ok
}
