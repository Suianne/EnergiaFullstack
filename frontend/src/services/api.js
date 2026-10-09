const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

function getToken() {
  return localStorage.getItem('token')
}

async function req(path, opts = {}) {
  const token = getToken()
  const headers = { 'Content-Type': 'application/json', ...opts.headers }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const r = await fetch(BASE + path, { ...opts, headers })

  if (r.status === 401) {
    throw new Error('Sessão expirada')
  }

  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}))
    throw new Error(corpo.erro || `Erro ${r.status}`)
  }

  if (r.status === 204) return null
  return r.json()
}

// Municípios
export const listarMunicipios = () => req('/municipios')
export const buscarMunicipio = (id) => req(`/municipios/${id}`)
export const criarMunicipio = (d) => req('/municipios', { method: 'POST', body: JSON.stringify(d) })
export const atualizarMunicipio = (id, d) => req(`/municipios/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const removerMunicipio = (id) => req(`/municipios/${id}`, { method: 'DELETE' })

// Critérios
export const listarCriterios = () => req('/criterios')
export const criarCriterio = (d) => req('/criterios', { method: 'POST', body: JSON.stringify(d) })
export const atualizarCriterio = (id, d) => req(`/criterios/${id}`, { method: 'PUT', body: JSON.stringify(d) })
export const removerCriterio = (id) => req(`/criterios/${id}`, { method: 'DELETE' })

// TOPSIS
export const executarTopsis = (d) => req('/topsis/executar', { method: 'POST', body: JSON.stringify(d) })

// Simulações
export const listarSimulacoes = () => req('/simulacoes')
export const buscarSimulacao = (id) => req(`/simulacoes/${id}`)

// Relatórios
export const exportarCsv = (ranking) => req('/relatorios/csv', { method: 'POST', body: JSON.stringify({ ranking }) })
export function exportarPdf(simulacaoId) {
  const token = getToken()
  return fetch(`${BASE}/relatorios/${simulacaoId}/pdf`, {
    headers: { 'Authorization': `Bearer ${token}` },
  }).then((r) => {
    if (!r.ok) throw new Error(`Erro ${r.status}`)
    return r.blob()
  })
}

// Importação IBGE + ANEEL
// Importar um estado já traz os dados do IBGE e da ANEEL; "atualizar" refaz só os dados.
export const importarMunicipiosIBGE = (uf) => req(`/importacao/ibge/municipios/${uf}`, { method: 'POST' })
export const popularDadosApis = (uf) => req(`/importacao/popular-dados/${uf}`, { method: 'POST' })

// Usuários e níveis de acesso
export const registrarUsuario = (d) => req('/auth/registrar', { method: 'POST', body: JSON.stringify(d) })
export const listarUsuarios = () => req('/usuarios')
export const alterarPerfilUsuario = (id, perfil) => req(`/usuarios/${id}/perfil`, { method: 'PATCH', body: JSON.stringify({ perfil }) })
export const removerUsuario = (id) => req(`/usuarios/${id}`, { method: 'DELETE' })

// PDF do ranking exibido na tela de Resultado
export async function exportarRankingPdf(ranking, criterios) {
  const r = await fetch(`${BASE}/relatorios/pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ ranking, criterios }),
  })
  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}))
    throw new Error(corpo.erro || `Erro ${r.status}`)
  }
  return r.blob()
}

// CEP
export async function buscarCep(cep) {
  const r = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`)
  const d = await r.json()
  if (d.erro) throw new Error('CEP não encontrado')
  return { nome: d.localidade, uf: d.uf, ibge: d.ibge }
}
