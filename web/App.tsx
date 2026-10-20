import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

// Rutas raíz. Cada área es dueña de su carpeta; aquí solo se montan.
// Cada área se carga aparte: el celular no descarga el panel ni el tablero (y al revés).
const PaginaMesa = lazy(() => import('./participante/PaginaMesa'))
const PaginaTablero = lazy(() => import('./tablero/PaginaTablero'))
const PaginaAdmin = lazy(() => import('./admin/PaginaAdmin'))
const PaginaInicio = lazy(() => import('./inicio/PaginaInicio'))

export default function App() {
  return (
    <Suspense fallback={<div className="hz-cargando-area" aria-busy="true" />}>
      <Routes>
        <Route path="/m/:codigo/*" element={<PaginaMesa />} />
        <Route path="/tablero/:sala/*" element={<PaginaTablero />} />
        <Route path="/admin/*" element={<PaginaAdmin />} />
        <Route path="*" element={<PaginaInicio />} />
      </Routes>
    </Suspense>
  )
}
