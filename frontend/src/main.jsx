import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import './styles/global.css'
import App from './App.jsx'
import { AppProvider } from './hooks/useApp.jsx'
createRoot(document.getElementById('root')).render(<BrowserRouter><AppProvider><App /></AppProvider></BrowserRouter>)
