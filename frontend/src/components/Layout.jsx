import {NavLink, Outlet} from 'reac-router-dom'
const links = [['/', Dashboard], ['/configuracao', 'Configuração TOPSIS'], ['/resultado', 'Resultado'], ['/municipios', 'Municípios'], ['/mapa', 'Mapa']]
export default function Layout(){
    return (
        <div className="app">
            <aside className="side">
                <div className="brand">☀ Energia Renovável</div>
                <nav aria-label="Navegação principal">
                    {links.map(([toString, txt]) => <NavLink key={to} to={to} end={to == '/'}>{txt}</NavLink>)}
                </nav>
            </aside>
            <main className="main"><Outlet /></main>
        </div>
    )
}