import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useApp } from '../hooks/useApp.jsx'
import KpiCard from '../components/KpiCard.jsx'
import Card from '../components/Card.jsx'
import MapaCalor from '../components/MapaCalor.jsx'
import { faixa, COR } from '../utils/topsis.js'
export default function Dashboard() {
  const { ranking } = useApp()
  const media = ranking.reduce((s, m) => s + m.ci, 0) / (ranking.length || 1)
  const top = ranking[0]
  return (
    <>
      <header className="head"><div><h1>Dashboard</h1><p>Visão geral da priorização de municípios</p></div></header>
      <div className="grid kpis">
        <KpiCard rotulo="Total de municípios" valor={ranking.length} />
        <KpiCard rotulo="Média do índice Ci" valor={media.toFixed(3)} cor={COR.accent} />
        <KpiCard rotulo="Município mais vulnerável" valor={top?.nome ?? '-'} detalhe={top && `Ci ${top.ci.toFixed(3)}`} cor={top && faixa(top.ci).cor} />
      </div>
      <div className="grid two" style={{ marginTop: '1rem' }}>
        <Card titulo="Ranking por Ci">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ranking} layout="vertical" margin={{ left: 20 }}>
              <XAxis type="number" domain={[0, 1]} stroke="#94A3B8" />
              <YAxis type="category" dataKey="nome" width={120} stroke="#94A3B8" />
              <Tooltip contentStyle={{ background: '#0F172A', border: '1px solid #334155' }} />
              <Bar dataKey="ci">{ranking.map((m) => <Cell key={m.ibge} fill={faixa(m.ci).cor} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card titulo="Mapa por faixa"><MapaCalor itens={ranking.map((m) => ({ ...m, valor: m.ci }))} altura={300} /></Card>
      </div>
    </>
  )
}
