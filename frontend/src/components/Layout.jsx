import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.jsx'
import { rotuloPerfil } from '../utils/perfis.js'

const TODOS = ['ADMINISTRADOR', 'PESQUISADOR', 'GESTOR']

const todosLinks = [
  { to: '/',             txt: 'Dashboard',           perfis: TODOS },
  { to: '/configuracao', txt: 'Configuração TOPSIS', perfis: ['ADMINISTRADOR', 'PESQUISADOR'] },
  { to: '/resultado',    txt: 'Ranking',             perfis: TODOS },
  { to: '/mapa',         txt: 'Mapa',                perfis: TODOS },
  { to: '/municipios',   txt: 'Municípios',          perfis: ['ADMINISTRADOR'] },
  { to: '/usuarios',     txt: 'Usuários',            perfis: ['ADMINISTRADOR'] },
]

export default function Layout() {
  const { usuario, logout } = useAuth()
  const links = todosLinks.filter((l) => l.perfis.includes(usuario?.perfil))

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">☀ Energia Renovável</div>
        <nav aria-label="Navegação principal">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'}>{l.txt}</NavLink>
          ))}
        </nav>
        <div className="side-footer">
          <span className="side-user">{usuario?.nome}</span>
          <span className="side-perfil">{rotuloPerfil(usuario?.perfil)}</span>
          <button className="btn-logout" onClick={logout}>Sair</button>
        </div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}
