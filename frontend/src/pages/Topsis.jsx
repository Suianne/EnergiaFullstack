import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import Button from '../components/Button.jsx'
export default function Topsis() {
  const { criterios, setCriterios } = useApp()
  const nav = useNavigate()
  const soma = criterios.reduce((s, c) => s + c.peso, 0)
  const ok = Math.abs(soma - 1) < 0.005
  const alterar = (id, campo, v) => setCriterios((cs) => cs.map((c) => (c.id === id ? { ...c, [campo]: v } : c)))
  const normalizar = () => setCriterios((cs) => cs.map((c) => ({ ...c, peso: +(c.peso / soma).toFixed(3) })))
  return (
    <>
      <header className="head"><div><h1>Configuração TOPSIS</h1><p>Defina o peso e o tipo de cada critério</p></div>
        <div className="row"><strong style={{ color: ok ? 'var(--cta)' : 'var(--alta)' }}>Soma: {soma.toFixed(2)}</strong>
          {!ok && <Button variante="ghost" onClick={normalizar}>Ajustar para 1.0</Button>}
          <Button disabled={!ok} onClick={() => nav('/resultado')}>Simular</Button></div></header>
      <Card>
        <div className="tablewrap"><table>
          <thead><tr><th>Critério</th><th>Tipo</th><th>Peso</th></tr></thead>
          <tbody>{criterios.map((c) => (
            <tr key={c.id}>
              <td>{c.nome}</td>
              <td><select aria-label={`Tipo de ${c.nome}`} value={c.tipo} onChange={(e) => alterar(c.id, 'tipo', e.target.value)}>
                <option value="beneficio">Benefício</option><option value="custo">Custo</option></select></td>
              <td><div className="row"><input type="range" min="0" max="1" step="0.01" value={c.peso} aria-label={`Peso de ${c.nome}`}
                onChange={(e) => alterar(c.id, 'peso', +e.target.value)} style={{ minWidth: 140 }} /><span>{c.peso.toFixed(2)}</span></div></td>
            </tr>))}</tbody>
        </table></div>
      </Card>
    </>
  )
}
