# Registro de alterações

## 2026-10-09 — Perfis de acesso, cadastro com IBGE/ANEEL, TOPSIS, PDF e reset

Commit `a65fb3d` na `main` (autor: AngeloMeirelles).

### Cadastro de usuários e níveis de acesso
- Página **Criar conta** (`/registro`) com os perfis Gestor público e Pesquisador. O primeiro usuário do sistema vira Administrador.
- Página **Usuários** (admin): criar contas com qualquer perfil, alterar perfil e remover usuários. O sistema nunca fica sem administrador; ninguém rebaixa nem exclui a própria conta.
- O usuário é recarregado do banco a cada requisição (`middleware/usuario.js`), por isso a troca de perfil vale na hora. `GET /api/auth/me` devolve token renovado.
- Menu, Dashboard e botões variam por perfil (PDF só para Administrador e Gestor; configuração TOPSIS para Administrador e Pesquisador).

### Município com dados das fontes
- `POST /api/municipios` recebe só `codigoIbge` e busca nome, UF, população e PIB (IBGE), potência e nº de usinas renováveis (ANEEL/SIGA) e coordenadas (malha do IBGE) antes de gravar.
- Na tela, escolher a UF carrega a lista do IBGE e o resumo da ANEEL; a prévia já mostra se o município tem geração renovável. Busca por CEP preenche a seleção.
- Importação em lote por UF e "Atualizar dados" (por município ou pendentes da UF), ambos incrementais para caber no tempo limite da Vercel.
- ANEEL: só usinas **em operação** de origem renovável (solar, eólica, biomassa, undi-elétrica, hídrica PCH/CGH); usina em vários municípios tem a potência rateada; nomes casados sem acento; cache de 6 h por UF. Se a ANEEL estiver fora do ar o município fica como "não consultado", nunca como "sem geração".

### TOPSIS
- Semântica única: **Ci = índice de vulnerabilidade (maior = mais vulnerável)**. O backend e o PDF diziam o contrário do frontend.
- Critérios da ANEEL passaram para o tipo **custo**; município sem geração renovável constatada tende ao topo do ranking.
- Município sem dado em algum critério fica fora do ranking e aparece em "sem dados". Ausência de dado não é zero.
- `POST /api/topsis/executar-banco` roda com os dados do banco, aceita ajustes de peso/tipo e salva a simulação ligada aos municípios e ao usuário.

### Relatórios
- **Exportar PDF** no ranking: gera uma simulação com os pesos atuais e baixa `GET /api/relatorios/:id/pdf` (critérios, resumo, ranking com faixa e flag de geração renovável, excluídos, paginação).
- CSV do ranking com BOM, `;`, aspas e proteção contra fórmulas do Excel.

### Banco de dados
- Migration `20261009120000_reset_dados_e_integridade`: apaga municípios (havia duplicatas), matriz, critérios, simulações e rankings; mantém usuários; `codigo_ibge` obrigatório e único; `(uf, nome)` único; exclusões em cascata na matriz; município apagado vira `NULL` nas simulações antigas; colunas `geracao_renovavel`, `dados_atualizados_em`, `criterios.chave`, `criterios.fonte`.
- Reset posterior: tela Municípios → "Reset dos dados" ou `POST /api/admin/reset-dados` com `{ "confirmacao": "RESETAR" }`.

### Verificação feita
- 83 testes automatizados no backend (sem banco).
- Teste ponta a ponta de 26 passos contra as APIs reais do IBGE e da ANEEL em um PostgreSQL local descartável.
- Build e lint do frontend.

### Deploy
- Publicado em 09/10/2026 na conta Vercel do time NOG (deploy do backend `dpl_79QVzE3swuTe3FWdnts9kDngpnJ7`). A migration de reset foi aplicada no Neon de produção pelo build; usuários mantidos.
- Adicionado `frontend/vercel.json` com rewrite de SPA: antes, abrir ou recarregar rotas como `/registro` e `/resultado` dava 404.

### Pendências
- Teste manual no navegador em produção (cadastrar municípios novamente, pois o banco foi zerado).
- Opcional: ligar os projetos da Vercel ao repositório para deploy automático a cada push.
- Decidir se Pesquisador também deve exportar PDF (hoje: só Administrador e Gestor, como no desenho original).
