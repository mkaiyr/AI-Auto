import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth/AuthProvider'
import './styles/tokens.css'
import './styles/global.css'
// мобильный слой подключается последним: он переопределяет оформление только на узких экранах
import './styles/mobile.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
