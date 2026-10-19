import { Route, Routes } from 'react-router-dom'
import PaginaMesa from './participante/PaginaMesa'
import PaginaTablero from './tablero/PaginaTablero'
import PaginaAdmin from './admin/PaginaAdmin'
import PaginaInicio from './inicio/PaginaInicio'

// Rutas raíz. Cada terminal es dueña de su carpeta; aquí solo se montan.
export default function App() {
  return (
    <Routes>
      <Route path="/m/:codigo/*" element={<PaginaMesa />} />
      <Route path="/tablero/:sala/*" element={<PaginaTablero />} />
      <Route path="/admin/*" element={<PaginaAdmin />} />
      <Route path="*" element={<PaginaInicio />} />
    </Routes>
  )
}
