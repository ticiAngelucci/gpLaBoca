import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode is off on purpose: the renderers and the turn state machine run on
// real timers and must not be mounted twice.
createRoot(document.getElementById('root')!).render(<App />)
