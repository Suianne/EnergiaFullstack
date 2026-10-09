import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
import { atualizarCriterio } from '../services/api.js'

export default function Topsis() {
  const { criterios, setCriterios, ranking, excluidos, recarregar } = useApp()
  const nav = useNavigate()
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState('')

  const soma = criterios.reduce((s, c) => s + c.peso, 0)
  const ok = Math.abs(soma - 1) < 0.005

  const alterar = (id, campo, v) => setCriterios((cs) => cs.map((c) => (c.id === id ? { ...c, [campo]: v } : c)))
  const normalizar = () => setCriterios((cs) => cs.map((c) => ({ ...c, peso: soma ? +(c.peso / soma).toFixed(3) : 0 })))

  // Persiste pesos/tipos para que todos os perfis (e o PDF) usem a mesma configuração
  const salvar = async () => {
    setSalvando(true)
    setMsg('')
    try {
      await Promise.all(
        criterios.map((c) =>
          atualizarCriterio(c.id, {
            nome: c.nome,
            descricao: c.descricao ?? null,
            tipo: c.tipo,
            peso: +c.peso.toFixed(4),
            unidade: c.unidade ?? null,
          }),
        ),
      )
      setMsg('Configuração salva.')
      recarregar()
    } catch (err) {
      setMsg(`Erro ao salvar: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <header className="head">
        <div>
          <h1>Configuração TOPSIS</h1>
          <p>Defina o peso e o tipo de cada critério</p>
        </div>
        <div className="row">
          <strong style={{ color: ok ? 'var(--cta, var(--primary))' : 'var(--alta)' }}>Soma: {soma.toFixed(2)}</strong>
          {!ok && <Button variante="ghost" onClick={normalizar}>Ajustar para 1.0</Button>}
          <Button variante="secundario" onClick={salvar} disabled={salvando || !ok}>{salvando ? 'Salvando…' : 'Salvar configuração'}</Button>
          <Button disabled={!ok} onClick={() => nav('/resultado')}>Ver ranking</Button>
        </div>
      </header>

      {msg && <p className={`alerta ${msg.startsWith('Erro') ? 'erro' : 'ok'}`} role="status">{msg}</p>}

      <Card titulo="Como o índice é interpretado">
        <p className="ajuda">
          O Ci mede a <strong>vulnerabilidade energética</strong> (0 a 1): quanto maior, mais vulnerável o município.
          Critério <strong>benefício</strong>: quanto maior o valor, mais vulnerável (ex.: população exposta).
          Critério <strong>custo</strong>: quanto maior o valor, menos vulnerável (ex.: PIB per capita, potência renovável instalada, usinas em operação).
          Município sem geração renovável constatada pela ANEEL tem valor 0 nos critérios de geração e, por isso, sobe no ranking.
          Município sem dado em algum critério fica fora do ranking (ausência de dado não é zero).
        </p>
      </Card>

      <Card className="mt">
        <div className="tablewrap">
          <table>
            <thead><tr><th>Critério</th><th>Fonte</th><th>Tipo</th><th>Peso</th></tr></thead>
            <tbody>
              {criterios.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.nome}</strong>{c.unidade ? ` (${c.unidade})` : ''}
                    {c.descricao && <div className="ajuda">{c.descricao}</div>}
                  </td>
                  <td>{c.fonte || '-'}</td>
                  <td>
                    <select aria-label={`Tipo de ${c.nome}`} value={c.tipo} onChange={(e) => alterar(c.id, 'tipo', e.target.value)}>
                      <option value="beneficio">Benefício (maior = mais vulnerável)</option>
                      <option value="custo">Custo (maior = menos vulnerável)</option>
                    </select>
                  </td>
                  <td>
                    <div className="row">
                      <input
                        type="range" min="0" max="1" step="0.01" value={c.peso}
                        aria-label={`Peso de ${c.nome}`}
                        onChange={(e) => alterar(c.id, 'peso', +e.target.value)}
                        style={{ minWidth: 140 }}
                      />
                      <span>{c.peso.toFixed(2)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {!criterios.length && (
                <tr><td colSpan={4} className="ajuda">Nenhum critério. Os critérios padrão são criados ao cadastrar o primeiro município.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="ajuda" style={{ marginTop: '0.75rem' }}>
          Pré-visualização: {ranking.length} município(s) no ranking{excluidos.length ? `, ${excluidos.length} fora por falta de dados` : ''}.
        </p>
      </Card>
    </>
  )
}
