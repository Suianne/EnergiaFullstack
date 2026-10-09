import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Topsis from './pages/Topsis.jsx'
import Resultado from './pages/Resultado.jsx'
import Cadastro from './pages/Cadastro.jsx'
import Mapa from './pages/Mapa.jsx'
import Registro from './pages/Registro.jsx'
import Usuarios from './pages/Usuarios.jsx'

function RotaProtegida({ perfis, children }) {
  const { logado, temPermissao } = useAuth()
  if (!logado) return <Navigate to="/login" />
  if (perfis && !temPermissao(...perfis)) return <Navigate to="/" />
  return children
}

export default function App() {
  const { logado, login } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={logado ? <Navigate to="/" /> : <Login onLogin={login} />} />

      <Route path="/registrar" element={logado ? <Navigate to="/" /> : <Registro onLogin={login} />} />

      <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
        <Route index element={<Dashboard />} />
        <Route path="configuracao" element={
          <RotaProtegida perfis={['ADMINISTRADOR', 'PESQUISADOR']}><Topsis /></RotaProtegida>
        } />
        <Route path="resultado" element={<Resultado />} />
        <Route path="municipios" element={
          <RotaProtegida perfis={['ADMINISTRADOR']}><Cadastro /></RotaProtegida>
        } />
        <Route path="usuarios" element={
          <RotaProtegida perfis={['ADMINISTRADOR']}><Usuarios /></RotaProtegida>
        } />
        <Route path="mapa" element={<Mapa />} />
      </Route>
    </Routes>
  )
}
