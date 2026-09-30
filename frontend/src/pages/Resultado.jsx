import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Faixa from '../components/Faixa.jsx'
import { COR } from '../utils/topsis.js'
export default function Resultado() {
  const { ranking, criterios } = useApp()
  const [sel, setSel] = useState(0)
  const atual = ranking[sel]
  const max = (id) => Math.max(...ranking.map((m) => m.valores[id])) || 1
  const radar = atual ? criterios.map((c) => ({ criterio: c.nome.split(' (')[0], v: atual.valores[c.id] / max(c.id) })) : []
  const exportar = () => {
    const csv = ['pos;municipio;ci', ...ranking.map((m) => `${m.pos};${m.nome};${m.ci.toFixed(4)}`)].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'resultado-topsis.csv'; a.click()
  }
  return (
    <>
      <header className="head"><div><h1>Resultado da simulação</h1><p>Selecione uma linha para ver o radar</p></div><Button variante="secundario" onClick={exportar}>Exportar CSV</Button></header>
      <div className="grid two">
        <Card><div className="tablewrap"><table>
          <thead><tr><th>#</th><th>Município</th><th>Ci</th><th>Faixa</th></tr></thead>
          <tbody>{ranking.map((m, i) => (
            <tr key={m.ibge} onClick={() => setSel(i)} style={{ cursor: 'pointer', background: i === sel ? 'var(--bg)' : undefined }}>
              <td>{m.pos}</td><td>{m.nome}</td><td>{m.ci.toFixed(3)}</td><td><Faixa ci={m.ci} /></td></tr>))}</tbody>
        </table></div></Card>
        <Card titulo={atual ? `Perfil: ${atual.nome}` : 'Perfil'}>
          <ResponsiveContainer width="100%" height={300}><RadarChart data={radar}>
            <PolarGrid stroke="#334155" /><PolarAngleAxis dataKey="criterio" stroke="#94A3B8" />
            <Radar dataKey="v" stroke={COR.accent} fill={COR.accent} fillOpacity={0.4} /></RadarChart></ResponsiveContainer>
        </Card>
      </div>
    </>
  )
}
