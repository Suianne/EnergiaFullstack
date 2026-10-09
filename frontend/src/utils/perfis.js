// Níveis de acesso da plataforma
export const PERFIS = {
  ADMINISTRADOR: 'Administrador',
  PESQUISADOR: 'Pesquisador',
  GESTOR: 'Gestor público',
}

// Perfis que o próprio usuário pode escolher ao criar a conta
export const PERFIS_PUBLICOS = ['GESTOR', 'PESQUISADOR']

export const DESCRICAO_PERFIL = {
  ADMINISTRADOR: 'Acesso total: cadastro e importação de municípios (IBGE + ANEEL), critérios, usuários, TOPSIS, relatórios e reset de dados.',
  PESQUISADOR: 'Configura os critérios e pesos do TOPSIS, acompanha o ranking, o mapa e exporta CSV.',
  GESTOR: 'Acompanha o ranking de vulnerabilidade, o mapa e exporta o relatório em PDF.',
}

export const rotuloPerfil = (perfil) => PERFIS[perfil] || perfil || '-'

export const UFS = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' },
]
