# Plataforma de Energia Renovável com TOPSIS

Plataforma computacional para mensurar indicadores multicritério de vulnerabilidade social relacionados ao acesso, uso e impacto de fontes de energia renovável, utilizando o método TOPSIS.

## Deploy

- **Frontend:** https://frontend-iota-six-17.vercel.app
- **Backend (API):** https://backend-six-alpha-58.vercel.app

Os projetos da Vercel **não estão ligados ao repositório do GitHub**: um push na `main` não publica nada. Para publicar, use a CLI logada na conta dona dos projetos:

```bash
cd backend && vercel --prod --scope nog4     # projeto "backend"  -> backend-six-alpha-58.vercel.app
cd ../frontend && vercel --prod --scope nog4 # projeto "frontend" -> frontend-iota-six-17.vercel.app
```

Variáveis necessárias na Vercel: backend `DATABASE_URL`, `JWT_SECRET` (opcional `CORS_ORIGIN`); frontend `VITE_API_URL` apontando para a URL da API com o sufixo `/api`.

Para publicar automaticamente a cada push, ligue cada projeto ao repositório `Suianne/EnergiaFullstack` em *Settings → Git* no painel da Vercel.

> Os projetos pertencem ao time **NOG** na Vercel. A migration de reset de 09/10/2026 já foi aplicada em produção; deploys seguintes não apagam dados.

O `frontend/vercel.json` redireciona todas as rotas para `index.html` (SPA), para que links diretos como `/registro` funcionem.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 8 + Leaflet + Recharts |
| Backend | Node.js 22 + Express 5 |
| Banco de Dados | PostgreSQL 16 (Neon) |
| ORM | Prisma 7 |
| Autenticação | JWT + bcrypt |
| Fontes de dados | API IBGE (municípios, população, PIB, malhas) + ANEEL/SIGA (usinas renováveis) |
| Relatórios | PDF (pdfkit) e CSV |
| DevOps | Docker + Docker Compose |
| Deploy | Vercel |

## Estrutura do Projeto

```
EnergiaFullstack/
├── frontend/                  # Aplicação React (SPA)
│   ├── src/
│   │   ├── components/        # Layout, MapaCalor, Card, Field, Button, Faixa, KpiCard
│   │   ├── hooks/             # useApp (dados + ranking ao vivo), useAuth (sessão e perfil)
│   │   ├── pages/             # Login, Registro, Dashboard, Topsis, Resultado, Cadastro, Usuarios, Mapa
│   │   ├── services/          # Integração com a API
│   │   ├── styles/            # CSS global
│   │   └── utils/             # Motor TOPSIS do cliente, perfis e UFs
│   └── package.json
├── backend/                   # API REST (Node.js + Express)
│   ├── src/
│   │   ├── controllers/       # Auth, Usuario, Municipio, Criterio, Topsis, Simulacao, Relatorio, Importacao, Admin
│   │   ├── services/          # Regras de negócio, motor TOPSIS, integração IBGE/ANEEL, PDF/CSV
│   │   ├── routes/            # Endpoints
│   │   ├── middleware/        # JWT, recarga do usuário, tratamento de erros
│   │   └── config/            # Conexão Prisma/PostgreSQL
│   ├── prisma/
│   │   ├── schema.prisma      # Modelagem do banco
│   │   └── migrations/        # Migrations (inclui o reset de dados)
│   ├── tests/                 # 83 testes automatizados (sem banco)
│   ├── vercel.json
│   └── package.json
├── docker-compose.yml
└── README.md
```

## Rodar Localmente

### Com Docker (recomendado)

```bash
docker compose up --build
docker compose exec backend npx prisma migrate deploy
```

Acesse:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Banco: PostgreSQL na porta 5432

### Sem Docker

```bash
# Backend
cd backend
npm install
DATABASE_URL=postgresql://user:pass@localhost:5432/energia_db npm run db:migrate
DATABASE_URL=postgresql://user:pass@localhost:5432/energia_db JWT_SECRET=troque-isto npm start

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

Variáveis do backend: `DATABASE_URL` (obrigatória), `JWT_SECRET`, `PORT`, `CORS_ORIGIN`.
Variável do frontend: `VITE_API_URL` (padrão `http://localhost:3001/api`).

## Perfis de Acesso e Cadastro

| Perfil | Pode fazer |
|---|---|
| **ADMINISTRADOR** | Tudo: cadastro/importação de municípios (IBGE + ANEEL), critérios, usuários e níveis de acesso, TOPSIS, PDF/CSV, reset de dados |
| **PESQUISADOR** | Configurar critérios e pesos, ver ranking, mapa e exportar CSV |
| **GESTOR** (Gestor público) | Ver ranking, mapa e exportar o relatório em PDF |

- Qualquer pessoa cria a própria conta em **Criar conta** escolhendo **Gestor público** ou **Pesquisador**.
- O **primeiro usuário** cadastrado no sistema vira **ADMINISTRADOR** automaticamente.
- O perfil ADMINISTRADOR só é concedido por outro administrador na tela **Usuários**, que também permite criar usuários, alterar perfis e remover contas (o sistema nunca fica sem administrador).
- Mudanças de perfil valem imediatamente: o usuário é recarregado do banco a cada requisição.
- Cada perfil vê um menu e um Dashboard diferentes.

## Fluxo de Uso

1. **Criar conta / Login.**
2. **Municípios** (administrador):
   - **Adicionar município**: escolha a UF → a lista de municípios do IBGE e o resumo de usinas renováveis da ANEEL são carregados → escolha o município (ou localize pelo CEP) → a prévia mostra se há geração renovável → **Adicionar**. O município é gravado já com população e PIB per capita (IBGE), potência e nº de usinas renováveis (ANEEL/SIGA) e coordenadas (malha do IBGE).
   - **Importação em lote por UF**: importa todos os municípios do estado com os mesmos dados, em etapas.
   - **Atualizar dados** reconsulta as fontes para um município ou para os pendentes de uma UF.
3. **Configuração TOPSIS** (administrador/pesquisador): ajuste tipo e peso dos critérios e **salve** para que todos usem a mesma configuração.
4. **Ranking**: tabela com Ci, faixa e flag de geração renovável, perfil do município, exportação **CSV** (todos) e **PDF** (administrador/gestor).
5. **Mapa**: camada de calor por Ci ou por critério.

## Semântica do TOPSIS

- **Ci é um índice de vulnerabilidade energética (0 a 1): quanto maior, mais vulnerável o município.** Faixas: Alta (≥ 0,66), Média (≥ 0,33), Baixa.
- Critério **benefício**: quanto maior o valor, mais vulnerável (ex.: população exposta).
- Critério **custo**: quanto maior o valor, menos vulnerável (ex.: PIB per capita, potência renovável instalada, usinas renováveis em operação).
- **Município sem geração renovável constatada pela ANEEL** recebe valor 0 nos critérios de geração (tipo custo) e, portanto, tende ao topo do ranking. A flag `geracaoRenovavel` guarda isso (`true`/`false`); `null` significa que a ANEEL não foi consultada (indisponível no momento) — nesse caso o município **não** é marcado como "sem geração".
- **Município sem dado em algum critério fica fora do ranking** (lista "sem dados"): ausência de dado não é tratada como zero.
- O motor do cliente (pré-visualização ao vivo) e o do servidor (simulações salvas e PDF) aplicam as mesmas regras.

Critérios padrão (criados automaticamente, editáveis):

| Chave | Critério | Tipo | Fonte |
|---|---|---|---|
| `populacao` | População | benefício | IBGE |
| `pib_per_capita` | PIB per capita | custo | IBGE |
| `potencia_renovavel` | Potência renovável instalada (kW) | custo | ANEEL/SIGA |
| `usinas_renovaveis` | Usinas renováveis em operação | custo | ANEEL/SIGA |

## Fontes de Dados Externas

| Fonte | API | Dados utilizados |
|---|---|---|
| **IBGE** | `servicodados.ibge.gov.br` | Municípios por UF, município por código, população estimada (pesquisa 6579), PIB per capita (pesquisa 38/indicador 47001), malha municipal (centroide para o mapa) |
| **ANEEL** | `dadosabertos.aneel.gov.br` (SIGA) | Usinas **em operação** com origem renovável (solar, eólica, biomassa, undi-elétrica e hídrica PCH/CGH), agregadas por município; usina em vários municípios tem a potência rateada igualmente. Cache de 6 h por UF. |

## Reset do Banco de Dados

A migration `20261009120000_reset_dados_e_integridade` **apaga municípios, matriz de decisão, critérios, simulações e rankings** (havia cidades duplicadas) e **mantém os usuários**. Ela é aplicada automaticamente no deploy (`prisma migrate deploy`) e também:

- torna `codigo_ibge` obrigatório e único e cria a unicidade `(uf, nome)`, impedindo novas duplicatas;
- passa as exclusões para cascata (apagar município/critério remove seus valores);
- adiciona `municipios.geracao_renovavel`, `municipios.dados_atualizados_em`, `criterios.chave` e `criterios.fonte`.

Para resetar de novo mais tarde: tela **Municípios → Reset dos dados** (digite `RESETAR`) ou `POST /api/admin/reset-dados` com `{ "confirmacao": "RESETAR" }`. Em ambiente local, `npm run db:reset` recria o banco do zero.

## API — Endpoints

### Autenticação
| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| POST | `/api/auth/registrar` | pública | Cria conta (GESTOR ou PESQUISADOR; 1º usuário vira ADMINISTRADOR). Devolve token |
| POST | `/api/auth/login` | pública | Login (token JWT) |
| GET | `/api/auth/me` | logado | Usuário atual com token renovado |

### Usuários
| Método | Endpoint | Permissão |
|---|---|---|
| GET | `/api/usuarios` | ADMINISTRADOR |
| POST | `/api/usuarios` | ADMINISTRADOR (qualquer perfil) |
| PUT | `/api/usuarios/:id` | ADMINISTRADOR (`{ perfil }`) |
| DELETE | `/api/usuarios/:id` | ADMINISTRADOR |

### Municípios
| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/municipios` | Todos | Lista com `valores` (por critério), `geracaoRenovavel`, coordenadas |
| GET | `/api/municipios/:id` | Todos | |
| POST | `/api/municipios` | ADMINISTRADOR | `{ codigoIbge }` → busca IBGE + ANEEL + coordenadas e grava a matriz |
| PUT | `/api/municipios/:id` | ADMINISTRADOR | Edição manual (`nome`, `populacao`, `idh`, `latitude`, `longitude`) |
| POST | `/api/municipios/:id/atualizar-dados` | ADMINISTRADOR | Reconsulta IBGE + ANEEL (`?forcarAneel=1` ignora o cache) |
| DELETE | `/api/municipios/:id` | ADMINISTRADOR | |

### Fontes externas e importação
| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/importacao/ibge/municipios/:uf` | Todos | Municípios da UF (IBGE) |
| GET | `/api/importacao/aneel/:uf` | Todos | Usinas renováveis em operação agregadas por município |
| POST | `/api/importacao/ibge/municipios/:uf?limite=10` | ADMINISTRADOR | Importa municípios ainda não cadastrados, já com dados (incremental) |
| POST | `/api/importacao/atualizar-dados/:uf?limite=10` | ADMINISTRADOR | Reprocessa municípios sem dados (incremental) |

### Critérios
| Método | Endpoint | Permissão |
|---|---|---|
| GET | `/api/criterios` | Todos |
| POST / PUT / DELETE | `/api/criterios[/:id]` | ADMINISTRADOR, PESQUISADOR |

### TOPSIS e simulações
| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| POST | `/api/topsis/executar` | Todos | Matriz enviada no corpo (`alternativas`, `criterios`, `matriz`) |
| POST | `/api/topsis/executar-banco` | Todos | Municípios e critérios do banco; `{ criterios: [{ id, peso, tipo }] }` opcional. Salva a simulação ligada aos municípios e devolve `ranking` e `excluidos` |
| GET | `/api/simulacoes[/:id]` | Todos | |

### Relatórios
| Método | Endpoint | Permissão |
|---|---|---|
| POST | `/api/relatorios/csv` | Todos |
| GET | `/api/relatorios/:id/pdf` | ADMINISTRADOR, GESTOR |

### Administração
| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/admin/estatisticas` | ADMINISTRADOR | Contagens gerais |
| POST | `/api/admin/reset-dados` | ADMINISTRADOR | `{ "confirmacao": "RESETAR" }` — zera dados, mantém usuários, recria critérios |

## Banco de Dados

Tabelas: `usuarios`, `municipios`, `criterios`, `matriz_decisao`, `simulacoes`, `resultados_ranking`.

`municipios.codigo_ibge` (obrigatório e único) é a chave de ligação com o IBGE; a ANEEL é casada pelo nome do município normalizado (sem acentos) dentro da UF. `matriz_decisao` guarda os valores dos critérios por município e ano de referência, consumidos pelo motor TOPSIS. O schema completo está em `backend/prisma/schema.prisma`.

## Testes

```bash
cd backend
npm test
```

83 testes, sem necessidade de banco (Prisma é substituído por um stub):
- rotas HTTP (autenticação obrigatória, TOPSIS, CSV, PDF e permissões);
- motor TOPSIS (exemplo do roteiro, semântica de vulnerabilidade, exclusão de municípios sem dados);
- integração ANEEL (classificação de fontes, usinas em vários municípios, normalização de nomes);
- regras de usuários (primeiro administrador, cadastro público, proteções do último administrador);
- validações de entrada.

## Equipe

Projeto acadêmico orientado pelo Prof. Me. Celso Barreto.
