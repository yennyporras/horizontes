/**
 * Glifo de Horizontes: el sol que asoma sobre la línea del horizonte, en el acento de la herramienta
 * (verde agua) con trazo carbón. Es decorativo: el nombre «Horizontes» va siempre en texto al lado.
 * El mismo dibujo está en web/public/favicon.svg (ahí con los valores: el ícono no lee los tokens).
 */
export function LogoHorizontes({ tamano = 40, className }: { tamano?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={tamano}
      height={tamano}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="48" height="48" rx="12" fill="var(--hz-acento-producto)" />
      <path d="M16 31a8 8 0 0 1 16 0z" fill="var(--et-carbon)" />
      <path d="M10.5 26a14 14 0 0 1 27 0" fill="none" stroke="var(--et-carbon)" strokeWidth="3" strokeLinecap="round" />
      <path d="M8 35h32" stroke="var(--et-carbon)" strokeWidth="3.4" strokeLinecap="round" />
    </svg>
  )
}
