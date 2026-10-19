import { useEffect } from 'react'

/** Temas de la familia Estratek: claro por defecto (celular y panel), carbón para la landing y la proyección. */
export type Tema = 'claro' | 'carbon'

/**
 * Pone el tema en <html> mientras la vista está montada, para que el fondo detrás de la página (rebote del
 * desplazamiento) y el theme-color del navegador coincidan con la vista. La vista lleva además su propio
 * data-tema en su elemento raíz.
 */
export function useTemaDocumento(tema: Tema) {
  useEffect(() => {
    const html = document.documentElement
    const anterior = html.getAttribute('data-tema')
    html.setAttribute('data-tema', tema)
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const colorAnterior = meta?.content
    const fondo = getComputedStyle(html).getPropertyValue('--hz-fondo').trim()
    if (meta && fondo) meta.content = fondo
    return () => {
      if (anterior === null) html.removeAttribute('data-tema')
      else html.setAttribute('data-tema', anterior)
      if (meta && colorAnterior) meta.content = colorAnterior
    }
  }, [tema])
}
