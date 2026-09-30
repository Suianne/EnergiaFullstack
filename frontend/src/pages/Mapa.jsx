import { useState } from 'react'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import MapaCalor from '../components/MapaCalor.jsx'
export default function Mapa() {
  const { ranking, criterios } = useApp()
  const [ind, setInd] = useState('ci')
  const vals = ranking.map((m) => (ind === 'ci' ? m.ci : m.valores[ind]))
  const [mn, mx] = [Math.min(...vals), Math.max(...vals)]
  const itens = ranking.map((m, i) => ({ ...m, valor: mx === mn ? 0.5 : (vals[i] - mn) / (mx - mn) }))
  return (
    <>
      <header className="head"><div><h1>Mapa georreferenciado</h1><p>Camada de calor por indicador</p></div>
        <select aria-label="Indicador" value={ind} onChange={(e) => setInd(e.target.value)} style={{ width: 'auto' }}>
          <option value="ci">Índice Ci</option>{criterios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></header>
      <Card><MapaCalor itens={itens} altura={480} /></Card>
    </>
  )
}
