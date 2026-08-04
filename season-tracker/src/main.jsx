import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ledger.css'        // the prototype's design language (see file header)
import './theme-classic.css' // "Classic" theme overrides (see file header)
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)