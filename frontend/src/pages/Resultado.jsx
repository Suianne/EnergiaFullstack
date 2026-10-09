import { useState } from 'react'
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer } from 'recharts'
import { useApp } from '../hooks/useApp.jsx'
import { useAuth } from '../hooks/useAuth.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import Faixa from '../components/Faixa.jsx'
import { COR, faixa, fmtNum } from '../utils/topsis.js'
import { gerarCsv, numeroCsv } from '../utils/csv.js'
import { executarTopsisBanco, exportarPdf, baixarArquivo } from '../services/api.js'

function BadgeGeracao({ m }) {
  if (!m.aneelConsultada) return <span className="badge neutro">não consultada</span>
  return m.geracaoRenovavel ? <span className="badge ok">Sim</span> : <span className="badge alerta">Não</span>
}

export default function Resultado() {
  const { ranking, excluidos, criterios, carregando } = useApp()
  const { temPermissao } = useAuth()
  const [sel, setSel] = useState(0)
  const [exportando, setExportando] = useState(false)
  const [msg, setMsg] = useState('')

  const criteriosAtivos = criterios.filter((c) => c.peso > 0)
  const atual = ranking[sel] || ranking[0]
  const max = (id) => Math.max(...ranking.map((m) => Number(m.valores?.[id]) || 0)) || 1
  const radar = atual
    ? criteriosAtivos.map((c) => ({ criterio: c.nome.split(' (')[0], v: (Number(atual.valores?.[c.id]) || 0) / max(c.id) }))
    : []

  // CSV com os mesmos cuidados do backend (BOM, ";", aspas e prote\u00E7\u00E3o contra f\u00F3rmulas)
  const exportarCsv = () => {
    const cabecalho = ['Posi\u00E7\u00E3o', 'Munic\u00EDpio', 'UF', 'Ci', 'Faixa', 'Gera\u00E7\u00E3o renov\u00E1vel (ANEEL)', 'D+', 'D-']
    const linhas = ranking.map((m) => [
      m.pos,
      m.nome,
      m.uf,
      numeroCsv(m.ci),
      faixa(m.ci).nome,
      !m.aneelConsultada ? 'N\u00E3o consultada' : m.geracaoRenovavel ? 'Sim' : 'N\u00E3o',
      numeroCsv(m.dp),
      numeroCsv(m.dn),
    ])
    baixarArquivo(gerarCsv(cabecalho, linhas), 'ranking-topsis.csv')
  }

  // O PDF é gerado pelo servidor a partir de uma simulação salva com os pesos atuais.
  const exportarPdfRanking = async () => {
    setExportando(true)
    setMsg('')
    try {
      const r = await executarTopsisBanco(criterios.map((c) => ({ id: c.id, peso: c.peso, tipo: c.tipo })))
      const blob = await exportarPdf(r.simulacaoId)
      baixarArquivo(blob, `relatorio-topsis-${r.simulacaoId}.pdf`)
      setMsg(`PDF gerado (simulação nº ${r.simulacaoId}, ${r.ranking.length} municípios).`)
    } catch (err) {
      setMsg(`Erro ao gerar PDF: ${err.message}`)
    } finally {
      setExportando(false)
    }
  }

  const podePdf = temPermissao('ADMINISTRADOR', 'GESTOR')

  return (
    <>
      <header className="head">
        <div>
          <h1>Ranking de vulnerabilidade</h1>
          <p>Maior Ci = mais vulnerável. Selecione uma linha para ver o perfil do município</p>
        </div>
        <div className="row">
          <Button variante="secundario" onClick={exportarCsv} disabled={!ranking.length}>Exportar CSV</Button>
          {podePdf && (
            <Button onClick={exportarPdfRanking} disabled={exportando || ranking.length < 2}>
              {exportando ? 'Gerando PDF…' : 'Exportar PDF'}
            </Button>
          )}
        </div>
      </header>

      {msg && <p className={`alerta ${msg.startsWith('Erro') ? 'erro' : 'ok'}`} role="status">{msg}</p>}
      {carregando && <p className="ajuda">Carregando…</p>}

      <div className="grid two">
        <Card>
          <div className="tablewrap">
            <table className="compacta">
              <thead>
                <tr><th>#</th><th>Município</th><th>UF</th><th>Ci</th><th>Faixa</th><th>Geração renovável</th></tr>
              </thead>
              <tbody>
                {ranking.map((m, i) => (
                  <tr
                    key={m.id ?? m.codigoIbge ?? m.nome}
                    onClick={() => setSel(i)}
                    style={{ cursor: 'pointer', background: i === sel ? 'var(--bg)' : undefined }}
                  >
                    <td>{m.pos}</td>
                    <td>{m.nome}</td>
                    <td>{m.uf}</td>
                    <td>{m.ci.toFixed(3)}</td>
                    <td><Faixa ci={m.ci} /></td>
                    <td><BadgeGeracao m={m} /></td>
                  </tr>
                ))}
                {!ranking.length && !carregando && (
                  <tr><td colSpan={6} className="ajuda">Nenhum município com dados completos para calcular o ranking.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid" style={{ alignContent: 'start' }}>
          <Card titulo={atual ? `Perfil: ${atual.nome} - ${atual.uf}` : 'Perfil'}>
            {atual && (
              <ul className="lista-simples" style={{ marginBottom: '0.5rem' }}>
                {criteriosAtivos.map((c) => (
                  <li key={c.id}>
                    {c.nome}: <strong>{fmtNum(atual.valores?.[c.id], c.chave === 'pib_per_capita' ? 2 : 0)}</strong> {c.unidade || ''}
                  </li>
                ))}
              </ul>
            )}
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radar}>
                <PolarGrid stroke="#cbd5e1" />
                <PolarAngleAxis dataKey="criterio" stroke="#64748b" />
                <Radar dataKey="v" stroke={COR.accent} fill={COR.accent} fillOpacity={0.4} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {excluidos.length > 0 && (
            <Card titulo={`Fora do ranking por falta de dados (${excluidos.length})`}>
              <p className="ajuda">Ausência de dado não é tratada como zero. Atualize os dados desses municípios na tela de Municípios.</p>
              <ul className="lista-simples">
                {excluidos.slice(0, 15).map((m) => <li key={m.id}>{m.nome} - {m.uf}: {m.motivo}</li>)}
                {excluidos.length > 15 && <li>… e mais {excluidos.length - 15}.</li>}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
