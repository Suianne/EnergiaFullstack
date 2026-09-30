import { Routes, Route } from 'react-router-dm'
import Layout from '../src/components/Layout.jsx'
import Dashboard from '../src/pages/Dashboard.jsx'
import Topsis from '../src/pages/Topsis.jsx'
import Resultado from '../src/pages/Resultado.jsx'
import Cadastro from '../src/pages/Mapa.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />}/>
        <Route path="configuracao" element={<Topsis />}/>
        <Route path="resultado" element={<Resultado />}/>
        <Route path="municipios" element={<Cadastro />}/>
        <Route path="mapa" element={<Mapa />}/>
      </Route>
    </Routes>
  )
}