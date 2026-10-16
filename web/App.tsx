import { Route, Routes } from 'react-router-dom'
import PaginaMesa from './participante/PaginaMesa'
import PaginaTablero from './tablero/PaginaTablero'
import PaginaAdmin from './admin/PaginaAdmin'

// Rutas raíz. Cada terminal es dueña de su carpeta; aquí solo se montan.
export default function App() {
  return (
    <Routes>
      <Route path="/m/:codigo/*" element={<PaginaMesa />} />
      <Route path="/tablero/:sala/*" element={<PaginaTablero />} />
      <Route path="/admin/*" element={<PaginaAdmin />} />
      <Route path="*" element={<Inicio />} />
    </Routes>
  )
}

function Inicio() {
  return (
    <main style={{ fontFamily: 'Montserrat Variable, sans-serif', padding: 24 }}>
      <h1>Horizontes</h1>
      <p>Escanea el QR de tu mesa para entrar al taller.</p>
    </main>
  )
}
