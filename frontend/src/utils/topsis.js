// Motor TOPSIS do cliente (pré-visualização ao vivo). Mesma matemática do backend:
// normalização vetorial -> ponderação -> ideal/anti-ideal -> Ci = d- / (d+ + d-).
//
// Convenção do projeto: Ci é um ÍNDICE DE VULNERABILIDADE energética (0 a 1).
// Quanto MAIOR o Ci, MAIS vulnerável é o município (maior prioridade).
//   - critério "beneficio": quanto maior o valor, mais vulnerável (ex.: população exposta)
//   - critério "custo":     quanto maior o valor, menos vulnerável (ex.: PIB, geração renovável)
//
// Município SEM DADO em algum critério fica fora do ranking (ausência de dado não é zero).
// Município com geração renovável = 0 constatada pela ANEEL entra normalmente com 0.

export const COR = { alta: '#ef4444', media: '#f59e0b', baixa: '#22c55e', accent: '#176b3a' }

export const faixa = (ci) =>
  ci >= 0.66 ? { nome: 'Alta', cor: COR.alta } : ci >= 0.33 ? { nome: 'Média', cor: COR.media } : { nome: 'Baixa', cor: COR.baixa }

export function valorCriterio(municipio, criterio) {
  const v = municipio.valores?.[criterio.id]
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Divide os municípios entre aptos (valor para todos os critérios) e excluídos (com motivo)
export function separarAptos(municipios, criterios) {
  const aptos = []
  const excluidos = []
  for (const m of municipios) {
    const faltando = criterios.filter((c) => valorCriterio(m, c) === null)
    if (faltando.length) {
      excluidos.push({ ...m, motivo: `Sem dados para: ${faltando.map((c) => c.nome).join(', ')}.` })
    } else {
      aptos.push(m)
    }
  }
  return { aptos, excluidos }
}

/**
 * @returns {{ ranking: object[], excluidos: object[] }}
 *   ranking: municípios ordenados do maior Ci (pos 1 = mais vulnerável) ao menor,
 *            cada um com { ci, dp, dn, pos }.
 */
export function rankCompleto(municipios, criterios) {
  const crit = (criterios || []).filter((c) => Number(c.peso) > 0)
  if (!municipios?.length || !crit.length) return { ranking: [], excluidos: [] }

  const { aptos, excluidos } = separarAptos(municipios, crit)
  if (!aptos.length) return { ranking: [], excluidos }

  const soma = crit.reduce((s, c) => s + Number(c.peso), 0)
  const pesos = crit.map((c) => Number(c.peso) / soma)

  const norma = crit.map((c) => Math.sqrt(aptos.reduce((s, m) => s + valorCriterio(m, c) ** 2, 0)))
  const v = aptos.map((m) => crit.map((c, j) => (norma[j] ? valorCriterio(m, c) / norma[j] : 0) * pesos[j]))

  const coluna = (j) => v.map((linha) => linha[j])
  const ideal = crit.map((c, j) => (c.tipo === 'custo' ? Math.min(...coluna(j)) : Math.max(...coluna(j))))
  const anti = crit.map((c, j) => (c.tipo === 'custo' ? Math.max(...coluna(j)) : Math.min(...coluna(j))))

  const ranking = aptos
    .map((m, i) => {
      const dp = Math.hypot(...v[i].map((x, j) => x - ideal[j]))
      const dn = Math.hypot(...v[i].map((x, j) => x - anti[j]))
      const total = dp + dn
      return { ...m, ci: total ? dn / total : 0.5, dp, dn, _i: i }
    })
    .sort((a, b) => b.ci - a.ci || a._i - b._i)
    .map(({ _i, ...m }, i) => ({ ...m, pos: i + 1 }))

  return { ranking, excluidos }
}

export const rank = (municipios, criterios) => rankCompleto(municipios, criterios).ranking

// "Canindé de São Francisco" -> "caninde de sao francisco" (mesma regra do backend, para casar com a ANEEL)
export function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const fmtNum = (n, casas = 0) =>
  n == null || !Number.isFinite(Number(n))
    ? '-'
    : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
