import { faixa } from '../utils/topsis.js'
export default function Faixa({ ci }) {
    const f = faixa(ci)
    return <span className="tag" style={{background: f.cor}}>{f.nome}</span>
}