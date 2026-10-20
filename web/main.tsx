import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/montserrat'
// Tokens y estilos base antes de cargar el área, así la espera ya tiene el fondo y la tipografía de la familia.
import './shared/ui/tokens.css'
import './shared/ui/componentes.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
