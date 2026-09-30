// Ponto único de integração com o backend (trocar o mock quando a API existir)
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
async function req(path, opts) {
  const r = await fetch(BASE + path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  if (!r.ok) throw new Error(`Erro ${r.status}`)
  return r.json()
}
export const listarMunicipios = () => req('/municipios')
export const criarMunicipio = (d) => req('/municipios', { method: 'POST', body: JSON.stringify(d) })
export async function buscarCep(cep) {
  const r = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`)
  const d = await r.json()
  if (d.erro) throw new Error('CEP não encontrado')
  return { nome: d.localidade, uf: d.uf, ibge: d.ibge }
}
