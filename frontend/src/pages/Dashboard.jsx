import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import KpiCard from '../components/KpiCard.jsx'
import Card from '../components/Card.jsx'
import MapaCalor from '../components/MapaCalor.jsx'
import { faixa, COR } from '../utils/topsis.js'
import { rotuloPerfil, DESCRICAO_PERFIL } from '../utils/perfis.js'

const TOP = 15

const ATALHOS = {
  ADMINISTRADOR: [
    { to: '/municipios', txt: 'Cadastrar/importar municípios (IBGE + ANEEL)' },
    { to: '/configuracao', txt: 'Configurar pesos do TOPSIS' },
    { to: '/resultado', txt: 'Ver ranking e exportar PDF' },
    { to: '/usuarios', txt: 'Gerenciar usuários e níveis de acesso' },
  ],
  PESQUISADOR: [
    { to: '/configuracao', txt: 'Configurar pesos e tipos dos critérios' },
    { to: '/resultado', txt: 'Ver ranking e exportar CSV' },
    { to: '/mapa', txt: 'Explorar o mapa por indicador' },
  ],
  GESTOR: [
    { to: '/resultado', txt: 'Ver ranking e exportar relatório em PDF' },
    { to: '/mapa', txt: 'Explorar o mapa por indicador' },
  ],
}

export default function Dashboard() {
  const { municipios, ranking, excluidos, carregando, erro } = useApp()
  const { usuario } = useAuth()

  const media = ranking.reduce((s, m) => s + m.ci, 0) / (ranking.length || 1)
  const top = ranking[0]
  const semGeracao = municipios.filter((m) => m.aneelConsultada && !m.geracaoRenovavel).length
  const naoConsultados = municipios.filter((m) => !m.aneelConsultada).length
  const porFaixa = ranking.reduce((acc, m) => {
    const f = faixa(m.ci).nome
    acc[f] = (acc[f] || 0) + 1
    return acc
  }, {})
  const maisVulneraveis = ranking.slice(0, TOP)

  return (
    <>
      <header className="head">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da vulnerabilidade energética dos municípios</p>
        </div>
      </header>

      {erro && <p className="alerta erro">Não foi possível carregar os dados: {erro}</p>}

      <Card className="painel-perfil">
        <div>
          <strong>Olá, {usuario?.nome}.</strong> Seu acesso: <span className="badge neutro">{rotuloPerfil(usuario?.perfil)}</span>
          <p className="ajuda" style={{ marginTop: '0.25rem' }}>{DESCRICAO_PERFIL[usuario?.perfil]}</p>
        </div>
        <ul className="lista-simples">
          {(ATALHOS[usuario?.perfil] || []).map((a) => <li key={a.to}><Link to={a.to}>{a.txt}</Link></li>)}
        </ul>
      </Card>

      <div className="grid kpis" style={{ marginTop: '1rem' }}>
        <KpiCard rotulo="Municípios cadastrados" valor={municipios.length} detalhe={carregando ? 'carregando…' : `${ranking.length} no ranking`} />
        <KpiCard rotulo="Ci médio (vulnerabilidade)" valor={media.toFixed(3)} cor={COR.accent} detalhe={`Alta ${porFaixa.Alta || 0} · Média ${porFaixa['Média'] || 0} · Baixa ${porFaixa.Baixa || 0}`} />
        <KpiCard rotulo="Mais vulnerável" valor={top ? `${top.nome} - ${top.uf}` : '-'} detalhe={top && `Ci ${top.ci.toFixed(3)}`} cor={top && faixa(top.ci).cor} />
        <KpiCard rotulo="Sem geração renovável (ANEEL)" valor={semGeracao} cor={COR.alta} detalhe={naoConsultados ? `${naoConsultados} não consultado(s)` : 'todos consultados'} />
        <KpiCard rotulo="Sem dados (fora do ranking)" valor={excluidos.length} cor={excluidos.length ? COR.media : undefined} />
      </div>

      <div className="grid two" style={{ marginTop: '1rem' }}>
        <Card titulo={`Os ${Math.min(TOP, ranking.length)} municípios mais vulneráveis`}>
          <ResponsiveContainer width="100%" height={Math.max(220, 24 * maisVulneraveis.length + 40)}>
            <BarChart data={maisVulneraveis} layout="vertical" margin={{ left: 20, right: 16 }}>
              <XAxis type="number" domain={[0, 1]} stroke="#94A3B8" />
              <YAxis type="category" dataKey="nome" width={140} stroke="#94A3B8" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(valor) => [`Ci: ${Number(valor).toFixed(3).replace('.', ',')}`, '']}
                contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8e3', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.10)' }}
                labelStyle={{ color: '#1f2937', fontWeight: '600' }}
                itemStyle={{ color: '#176b3a' }}
              />
              <Bar dataKey="ci">
                {maisVulneraveis.map((m) => <Cell key={m.id ?? m.codigoIbge ?? m.nome} fill={faixa(m.ci).cor} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card titulo="Mapa por faixa de vulnerabilidade">
          <MapaCalor itens={ranking.map((m) => ({ ...m, valor: m.ci }))} altura={300} />
        </Card>
      </div>
    </>
  )
}
