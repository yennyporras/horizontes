import { useEffect } from 'react'

/**
 * Temas de la familia Estratek. Desde el 20-oct todas las vistas son claras y el carbón queda para la barra superior
 * (`EncabezadoProducto` lo lleva en su <header>). `'carbon'` se sigue aceptando para no romper a quien aún lo pida.
 */
export type Tema = 'claro' | 'carbon'

/**
 * Pone el tema en <html> mientras la vista está montada, para que el fondo detrás de la página (rebote del
 * desplazamiento) coincida con la vista aunque se llegue desde otra ruta de la SPA. La vista lleva además su propio
 * data-tema en su elemento raíz. El `theme-color` del navegador es fijo en web/index.html: el carbón de la barra
 * superior, lo primero que se ve en todas las vistas.
 */
export function useTemaDocumento(tema: Tema) {
  useEffect(() => {
    const html = document.documentElement
    const anterior = html.getAttribute('data-tema')
    html.setAttribute('data-tema', tema)
    return () => {
      if (anterior === null) html.removeAttribute('data-tema')
      else html.setAttribute('data-tema', anterior)
    }
  }, [tema])
}
