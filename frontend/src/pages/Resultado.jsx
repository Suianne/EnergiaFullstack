import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Faixa from '../components/Faixa.jsx'
import { COR } from '../utils/topsis.js'
import { exportarRankingPdf } from '../services/api.js'
export default function Resultado() {
  const { ranking, criterios } = useApp()
  const [sel, setSel] = useState(0)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const [erroPdf, setErroPdf] = useState('')
  const atual = ranking[sel]
  const max = (id) => Math.max(...ranking.map((m) => m.valores?.[id] || 0)) || 1
  const radar = atual ? criterios.map((c) => ({ criterio: c.nome.split(' (')[0], v: (atual.valores?.[c.id] || 0) / max(c.id) })) : []
  const exportar = () => {
    const csv = ['pos;municipio;ci', ...ranking.map((m) => `${m.pos};${m.nome};${m.ci.toFixed(4)}`)].join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'resultado-topsis.csv'; a.click()
  }
  const exportarPdf = async () => {
    setErroPdf('')
    setGerandoPdf(true)
    try {
      const blob = await exportarRankingPdf(
        ranking.map((m) => ({ posicao: m.pos, municipio: m.nome, uf: m.uf, ci: m.ci, semGeracao: !!m.semGeracaoRenovavel })),
        criterios.map((c) => ({ nome: c.nome, tipo: c.tipo, peso: c.peso })),
      )
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = 'ranking-municipios.pdf'; a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) {
      setErroPdf(e.message)
    } finally {
      setGerandoPdf(false)
    }
  }
  return (
    <>
      <header className="head"><div><h1>Resultado da simulação</h1><p>Selecione uma linha para ver o radar</p></div>
        <div className="row">
          <Button variante="secundario" onClick={exportar}>Exportar CSV</Button>
          <Button onClick={exportarPdf} disabled={gerandoPdf || !ranking.length}>{gerandoPdf ? 'Gerando PDF…' : 'Exportar PDF'}</Button>
        </div>
      </header>
      {erroPdf && <p className="erro" role="alert" style={{ marginBottom: '1rem' }}>Não foi possível gerar o PDF: {erroPdf}</p>}
      <div className="grid two">
        <Card><div className="tablewrap"><table>
          <thead><tr><th>#</th><th>Município</th><th>Ci</th><th>Faixa</th><th>Geração renovável</th></tr></thead>
          <tbody>{ranking.map((m, i) => (
            <tr key={m.ibge || m.id || m.nome} onClick={() => setSel(i)} style={{ cursor: 'pointer', background: i === sel ? 'var(--bg)' : undefined }}>
              <td>{m.pos}</td><td>{m.nome}</td><td>{m.ci.toFixed(3)}</td><td><Faixa ci={m.ci} /></td>
              <td>{m.semGeracaoRenovavel ? <span className="tag sem-geracao">Sem geração constatada</span> : <span style={{ color: 'var(--muted)' }}>Com geração</span>}</td></tr>))}</tbody>
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
