import Card from './Card.jsx'
export default function KpiCard({ rotulo, valor, detalhe, cor }) {
  return <Card className="kpi"><span>{rotulo}</span><b style={{ color: cor }}>{valor}</b>{detalhe && <span>{detalhe}</span>}</Card>
}
