import { useState } from 'react'
import { useApp } from '../hooks/useApp.jsx'
import Card from '../components/Card.jsx'
import MapaCalor from '../components/MapaCalor.jsx'

export default function Mapa() {
  const { ranking, municipios, criterios } = useApp()
  const [ind, setInd] = useState('ci')

  // Ci só existe para quem está no ranking; os critérios brutos valem para todos os municípios
  const base = ind === 'ci' ? ranking : municipios
  const vals = base.map((m) => (ind === 'ci' ? m.ci : Number(m.valores?.[ind]) || 0))
  const mn = vals.length ? Math.min(...vals) : 0
  const mx = vals.length ? Math.max(...vals) : 0
  const itens = base.map((m, i) => ({ ...m, valor: mx === mn ? 0.5 : (vals[i] - mn) / (mx - mn) }))
  const criterioSel = criterios.find((c) => String(c.id) === String(ind))

  return (
    <>
      <header className="head">
        <div>
          <h1>Mapa georreferenciado</h1>
          <p>Camada de calor por indicador (valores normalizados de 0 a 1)</p>
        </div>
        <select aria-label="Indicador" value={ind} onChange={(e) => setInd(e.target.value)} style={{ width: 'auto' }}>
          <option value="ci">Índice Ci (vulnerabilidade)</option>
          {criterios.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </header>
      <Card>
        <p className="ajuda" style={{ marginBottom: '0.5rem' }}>
          {ind === 'ci'
            ? 'Vermelho = mais vulnerável, verde = menos vulnerável.'
            : `${criterioSel?.nome || 'Indicador'}: vermelho = valor mais alto, verde = valor mais baixo.`}
        </p>
        <MapaCalor itens={itens} altura={480} />
      </Card>
    </>
  )
}
