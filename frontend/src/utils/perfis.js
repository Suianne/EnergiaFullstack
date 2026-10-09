// Níveis de acesso. A regra real é aplicada no backend; aqui só descrevemos o que cada nível vê.
export const PERFIS = {
  GESTOR: 'Consulta o dashboard, o resultado do ranking, o mapa e exporta PDF/CSV.',
  PESQUISADOR: 'Tudo do Gestor Público, mais a configuração do TOPSIS (pesos e tipos dos critérios).',
  ADMINISTRADOR: 'Tudo do Pesquisador, mais cadastro de municípios, importação por estado e gestão de usuários.',
}
export const NOME_PERFIL = { GESTOR: 'Gestor Público', PESQUISADOR: 'Pesquisador', ADMINISTRADOR: 'Administrador' }