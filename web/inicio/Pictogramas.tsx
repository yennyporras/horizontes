// Pictogramas de «Cómo funciona», en la línea del glifo de Horizontes: lienzo de 48 con esquinas de 12, trazo carbón
// de 3 con puntas redondas y una sola idea por paso. R1 y R2 llevan sus formas de siempre (hueco verde y sólido rojo).
// Decorativos: el paso se lee en el título que los acompaña.

import type { ReactElement } from 'react'

export type IdPaso = 'codigo' | 'inscripcion' | 'lectura' | 'ronda1' | 'ronda2' | 'matriz'

const DIBUJO: Record<IdPaso, ReactElement> = {
  // El celular con el QR de la mesa.
  codigo: (
    <>
      <rect className="in-pict__trazo" x="14" y="6" width="20" height="36" rx="4" />
      <path className="in-pict__relleno" d="M18.5 12h5v5h-5zM24.5 12h5v5h-5zM18.5 18h5v5h-5zM26 20h3.5v3.5H26zM18.5 26h11v3h-11z" />
      <path className="in-pict__trazo" d="M21 36.5h6" />
    </>
  ),
  // Una persona y su autorización.
  inscripcion: (
    <>
      <circle className="in-pict__trazo" cx="19" cy="16" r="6" />
      <path className="in-pict__trazo" d="M8 38a11 11 0 0 1 22 0" />
      <path className="in-pict__trazo" d="M29 26l4.5 4.5L41 21" />
    </>
  ),
  // El caso y, encima, la hoja del perfil.
  lectura: (
    <>
      <path className="in-pict__trazo" d="M28 10V9a3 3 0 0 0-3-3H12a3 3 0 0 0-3 3v23a3 3 0 0 0 3 3h3" />
      <rect className="in-pict__trazo in-pict__hoja" x="18" y="14" width="21" height="28" rx="3" />
      <path className="in-pict__trazo" d="M23.5 22h10M23.5 28h10M23.5 34h6" />
    </>
  ),
  // Cada quien por su cuenta: una persona y su calificación de la ronda 1.
  ronda1: (
    <>
      <circle className="in-pict__trazo" cx="17" cy="16" r="6" />
      <path className="in-pict__trazo" d="M6 38a11 11 0 0 1 22 0" />
      <circle className="in-r1-forma" cx="36" cy="27" r="5.5" />
    </>
  ),
  // La mesa conversa: tres personas, la mesa y la calificación de la ronda 2.
  ronda2: (
    <>
      <circle className="in-pict__trazo" cx="10.5" cy="19" r="4.5" />
      <circle className="in-pict__trazo" cx="24" cy="12" r="4.5" />
      <circle className="in-pict__trazo" cx="37.5" cy="19" r="4.5" />
      <path className="in-pict__trazo" d="M7 37h34" />
      <circle className="in-r2-forma" cx="24" cy="28" r="5.5" />
    </>
  ),
  // El plano de la matriz: el proyecto se mueve de la R1 a la R2.
  matriz: (
    <>
      <path className="in-pict__trazo" d="M8 6v34h34" />
      <circle className="in-r1-forma" cx="35" cy="14" r="5" />
      <path className="in-pict__trazo" d="M30.5 18.5l-6 6" />
      <path className="in-pict__relleno" d="M21 28l5-1.3-3.7-3.7z" />
      <circle className="in-r2-forma" cx="17" cy="32" r="5" />
    </>
  ),
}

export function PictogramaPaso({ id }: { id: IdPaso }) {
  return (
    <svg className="in-pict" data-paso={id} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {DIBUJO[id]}
    </svg>
  )
}
