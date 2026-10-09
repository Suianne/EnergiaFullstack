export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

// O token fica em memória (definido pelo AuthProvider) e o storage é só um reserva
// para quando a página é recarregada. Assim a primeira requisição após o login já
// sai autenticada e o app funciona mesmo sem localStorage.
let tokenAtual = null

export function definirToken(token) {
  tokenAtual = token || null
}

function getToken() {
  if (tokenAtual) return tokenAtual
  try {
    return localStorage.getItem('token')
  } catch {
    return null
  }
}

function cabecalhos(opts) {
  const token = getToken()
  const headers = { ...opts.headers }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

async function enviar(path, opts = {}) {
  const token = getToken()
  let r
  try {
    r = await fetch(BASE + path, { ...opts, headers: cabecalhos(opts) })
  } catch {
    throw new Error('Não foi possível conectar ao servidor.')
  }

  // Token inválido/expirado ou usuário removido: avisa o AuthProvider para encerrar a sessão.
  if (r.status === 401 && token && !path.startsWith('/auth/login')) {
    window.dispatchEvent(new CustomEvent('auth:expirada'))
    throw new Error('Sessão expirada. Entre novamente.')
  }

  if (!r.ok) {
    const corpo = await r.json().catch(() => ({}))
    throw new Error(corpo.erro || `Erro ${r.status}`)
  }
  return r
}

async function req(path, opts) {
  const r = await enviar(path, opts)
  if (r.status === 204) return null
  return r.json()
}

const post = (path, dados) => req(path, { method: 'POST', body: JSON.stringify(dados ?? {}) })
const put = (path, dados) => req(path, { method: 'PUT', body: JSON.stringify(dados ?? {}) })
const del = (path) => req(path, { method: 'DELETE' })

// Dispara o download de um Blob no navegador
export function baixarArquivo(blob, nome) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = nome
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

// Autenticação
export const login = (email, senha) => post('/auth/login', { email, senha })
export const registrar = (dados) => post('/auth/registrar', dados)
export const usuarioAtual = () => req('/auth/me')

// Usuários (ADMINISTRADOR)
export const listarUsuarios = () => req('/usuarios')
export const criarUsuario = (dados) => post('/usuarios', dados)
export const atualizarPerfilUsuario = (id, perfil) => put(`/usuarios/${id}`, { perfil })
export const removerUsuario = (id) => del(`/usuarios/${id}`)

// Municípios
export const listarMunicipios = () => req('/municipios')
export const buscarMunicipio = (id) => req(`/municipios/${id}`)
// O cadastro é só pelo código IBGE: o backend busca nome, UF, população, PIB, ANEEL e coordenadas
export const criarMunicipio = ({ codigoIbge }) => post('/municipios', { codigoIbge })
export const atualizarMunicipio = (id, dados) => put(`/municipios/${id}`, dados)
export const atualizarDadosMunicipio = (id, { forcarAneel = false } = {}) =>
  post(`/municipios/${id}/atualizar-dados${forcarAneel ? '?forcarAneel=1' : ''}`)
export const removerMunicipio = (id) => del(`/municipios/${id}`)

// Critérios
export const listarCriterios = () => req('/criterios')
export const criarCriterio = (d) => post('/criterios', d)
export const atualizarCriterio = (id, d) => put(`/criterios/${id}`, d)
export const removerCriterio = (id) => del(`/criterios/${id}`)

// TOPSIS
export const executarTopsis = (d) => post('/topsis/executar', d)
// Roda com os municípios/critérios do banco e salva a simulação; `criterios` = [{ id, peso, tipo }]
export const executarTopsisBanco = (criterios) => post('/topsis/executar-banco', { criterios })

// Simulações
export const listarSimulacoes = () => req('/simulacoes')
export const buscarSimulacao = (id) => req(`/simulacoes/${id}`)

// Relatórios
export const exportarPdf = (simulacaoId) => enviar(`/relatorios/${simulacaoId}/pdf`).then((r) => r.blob())

// Fontes externas (IBGE + ANEEL)
export const listarMunicipiosIBGE = (uf) => req(`/importacao/ibge/municipios/${uf}`)
export const resumoAneel = (uf, { forcar = false } = {}) => req(`/importacao/aneel/${uf}${forcar ? '?forcar=1' : ''}`)
export const importarMunicipiosIBGE = (uf, limite = 10) => post(`/importacao/ibge/municipios/${uf}?limite=${limite}`)
export const atualizarDadosUF = (uf, limite = 10) => post(`/importacao/atualizar-dados/${uf}?limite=${limite}`)

// Administração
export const estatisticasAdmin = () => req('/admin/estatisticas')
export const resetarDados = (confirmacao) => post('/admin/reset-dados', { confirmacao })

// CEP (ViaCEP, público)
export async function buscarCep(cep) {
  const r = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`)
  const d = await r.json()
  if (d.erro) throw new Error('CEP não encontrado')
  return { nome: d.localidade, uf: d.uf, codigoIbge: d.ibge }
}
