export const COR = { alta: '#F87171', media: '#FBBF24', baixa: '#4ADE80', accent: '#38BDF8' }
export const faixa = (ci) => ci >= 0.66 ? { nome: 'Alta', cor: COR.alta } : ci >= 0.33 ? { nome: 'Média', cor: COR.media } : { nome: 'Baixa', cor: COR.baixa }

// TOPSIS: normalização vetorial -> ponderação -> ideal/anti-ideal -> Ci = d- / (d+ + d-)
export function rank(items, crit) {
  if (!items.length || !crit.length) return []
  if (!items[0].valores) return items.map((m, i) => ({ ...m, ci: 0, pos: i + 1 }))
  const soma = crit.reduce((s, c) => s + c.peso, 0) || 1
  const norma = crit.map((c) => Math.sqrt(items.reduce((s, m) => s + (m.valores[c.id] || 0) ** 2, 0)) || 1)
  const v = items.map((m) => crit.map((c, j) => ((m.valores[c.id] || 0) / norma[j]) * (c.peso / soma)))
  const pick = (j, maior) => Math[maior ? 'max' : 'min'](...v.map((r) => r[j]))
  const ideal = crit.map((c, j) => pick(j, c.tipo === 'beneficio'))
  const anti = crit.map((c, j) => pick(j, c.tipo !== 'beneficio'))
  return items
    .map((m, i) => {
      const dp = Math.hypot(...v[i].map((x, j) => x - ideal[j]))
      const dn = Math.hypot(...v[i].map((x, j) => x - anti[j]))
      return { ...m, ci: dp + dn ? dn / (dp + dn) : 0 }
    })
    .sort((a, b) => b.ci - a.ci)
    .map((m, i) => ({ ...m, pos: i + 1 }))
}
