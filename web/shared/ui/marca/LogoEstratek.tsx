/**
 * Logo oficial de Estratek (FAMILIA_ESTRATEK §6). El PNG del sitio es de un solo color y no hay vector: se dibuja como
 * máscara (`.hz-logo-estratek` en componentes.css) pintada con la tinta del tema. Sobre el claro sale en carbón y dentro
 * de la barra carbón, en hielo: no hay que elegir archivo según el fondo. Alto por defecto de 32 px; se cambia con
 * `className` (el alto en CSS; el ancho sale de la proporción del logo).
 */
export function LogoEstratek({ className }: { className?: string }) {
  return <span role="img" aria-label="Estratek" className={['hz-logo-estratek', className].filter(Boolean).join(' ')} />
}
