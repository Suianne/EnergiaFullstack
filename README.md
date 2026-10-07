# Plataforma de Energia Renovável com TOPSIS

Plataforma computacional para mensurar indicadores multicritério de vulnerabilidade social relacionados ao acesso, uso e impacto de fontes de energia renovável, utilizando o método TOPSIS.

## Deploy

- **Frontend:** https://frontend-iota-six-17.vercel.app
- **Backend (API):** https://backend-six-alpha-58.vercel.app

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite 8 + Leaflet + Recharts |
| Backend | Node.js 22 + Express 5 |
| Banco de Dados | PostgreSQL 16 (Neon) |
| ORM | Prisma 7 |
| Autenticação | JWT + bcrypt |
| Fontes de dados | API IBGE (população, PIB) + ANEEL/SIGA (geração renovável) |
| DevOps | Docker + Docker Compose |
| Deploy | Vercel |

## Estrutura do Projeto

```
EnergiaFullstack/
├── frontend/                  # Aplicação React (SPA)
│   ├── src/
│   │   ├── components/        # Componentes reutilizáveis
│   │   ├── hooks/             # useApp (dados), useAuth (autenticação)
│   │   ├── pages/             # Login, Dashboard, Cadastro, Topsis, Resultado, Mapa
│   │   ├── services/          # Integração com API
│   │   ├── styles/            # CSS global
│   │   └── utils/             # Motor TOPSIS no frontend
│   ├── Dockerfile
│   └── package.json
├── backend/                   # API REST (Node.js + Express)
│   ├── src/
│   │   ├── controllers/       # Auth, Municipio, Criterio, Topsis, Simulacao, Relatorio, Importacao
│   │   ├── services/          # Lógica de negócio + Motor TOPSIS + Integração IBGE/ANEEL
│   │   ├── routes/            # Definição de endpoints
│   │   ├── middleware/        # Autenticação JWT + tratamento de erros
│   │   └── config/            # Conexão Prisma/PostgreSQL
│   ├── prisma/
│   │   └── schema.prisma      # Modelagem do banco de dados
│   ├── tests/                 # 33 testes automatizados
│   ├── Dockerfile
│   ├── vercel.json
│   └── package.json
├── docker-compose.yml         # Orquestração dos 3 containers
└── README.md
```

## Rodar Localmente

### Com Docker (recomendado)

```bash
docker compose up --build
```

Acesse:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001
- Banco: PostgreSQL na porta 5432

Após subir, rode a migration:

```bash
docker compose exec backend npx prisma migrate dev
```

### Sem Docker

```bash
# Backend
cd backend
npm install
DATABASE_URL=postgresql://user:pass@localhost:5432/energia_db npx prisma migrate dev
DATABASE_URL=postgresql://user:pass@localhost:5432/energia_db node src/server.js

# Frontend (em outro terminal)
cd frontend
npm install
npm run dev
```

## Fluxo de Uso (Administrador)

1. **Registrar/Login** — criar conta com perfil ADMINISTRADOR
2. **Importar municípios** — na página Cadastro, informar a UF e clicar "Importar municípios (IBGE)". Os municípios são buscados via API do IBGE e salvos no banco com código IBGE e população.
3. **Popular critérios** — clicar "Popular critérios (IBGE + ANEEL)". O sistema cria 4 critérios padrão e busca dados reais:
   - **População** (IBGE) — população estimada do município
   - **PIB per capita** (IBGE) — riqueza econômica municipal
   - **Potência instalada** (ANEEL/SIGA) — potência de geração renovável em operação (solar, eólica, PCH)
   - **Usinas renováveis** (ANEEL/SIGA) — quantidade de usinas renováveis em operação
4. **Configurar TOPSIS** — ajustar pesos e tipos (benefício/custo) de cada critério
5. **Ver resultados** — Dashboard, Ranking e Mapa com dados reais

## Fontes de Dados Externas

| Fonte | API | Dados utilizados |
|---|---|---|
| **IBGE** | `servicodados.ibge.gov.br` | Municípios por UF, população estimada (pesquisa 6579), PIB per capita (pesquisa 38/indicador 47001) |
| **ANEEL** | `dadosabertos.aneel.gov.br` (SIGA) | Usinas de geração em operação — potência fiscalizada e contagem por município, filtradas por fontes renováveis (UFV, EOL, PCH, CGH) |

## API — Endpoints

### Autenticação (pública)
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/auth/registrar` | Registrar novo usuário |
| POST | `/api/auth/login` | Login (retorna token JWT) |

### Municípios (autenticado)
| Método | Endpoint | Permissão |
|---|---|---|
| GET | `/api/municipios` | Todos |
| GET | `/api/municipios/:id` | Todos |
| POST | `/api/municipios` | ADMINISTRADOR |
| PUT | `/api/municipios/:id` | ADMINISTRADOR |
| DELETE | `/api/municipios/:id` | ADMINISTRADOR |

### Critérios (autenticado)
| Método | Endpoint | Permissão |
|---|---|---|
| GET | `/api/criterios` | Todos |
| POST | `/api/criterios` | ADMINISTRADOR, PESQUISADOR |
| PUT | `/api/criterios/:id` | ADMINISTRADOR, PESQUISADOR |
| DELETE | `/api/criterios/:id` | ADMINISTRADOR, PESQUISADOR |

### TOPSIS (autenticado)
| Método | Endpoint | Permissão |
|---|---|---|
| POST | `/api/topsis/executar` | Todos |

### Simulações (autenticado)
| Método | Endpoint | Permissão |
|---|---|---|
| GET | `/api/simulacoes` | Todos |
| GET | `/api/simulacoes/:id` | Todos |

### Relatórios (autenticado)
| Método | Endpoint | Permissão |
|---|---|---|
| POST | `/api/relatorios/csv` | Todos |
| GET | `/api/relatorios/:id/pdf` | ADMINISTRADOR, GESTOR |

### Importação e Dados Externos (autenticado)
| Método | Endpoint | Permissão | Descrição |
|---|---|---|---|
| GET | `/api/importacao/ibge/municipios/:uf` | Todos | Consultar municípios do IBGE |
| POST | `/api/importacao/ibge/municipios/:uf` | ADMINISTRADOR | Importar municípios da UF para o banco |
| POST | `/api/importacao/popular-dados/:uf` | ADMINISTRADOR | Popular MatrizDecisao com dados IBGE + ANEEL |

## Perfis de Acesso

| Perfil | Pode fazer |
|---|---|
| **ADMINISTRADOR** | Acesso total — cadastro de municípios, critérios, importação IBGE/ANEEL, TOPSIS, relatórios |
| **PESQUISADOR** | Configurar critérios, executar TOPSIS, ver resultados e mapa |
| **GESTOR** | Executar TOPSIS, ver resultados, gerar relatórios PDF |

## Banco de Dados

Tabelas: `usuarios`, `municipios`, `criterios`, `matriz_decisao`, `simulacoes`, `resultados_ranking`

O campo `codigo_ibge` na tabela `municipios` é a chave de ligação com as APIs externas (IBGE e ANEEL). A tabela `matriz_decisao` armazena os valores dos critérios por município, alimentados pelas APIs e consumidos pelo motor TOPSIS.

O schema completo está em `backend/prisma/schema.prisma`.

## Testes

```bash
cd backend
node --test tests/auth.test.js tests/topsis.test.js tests/validacoes.test.js
```

33 testes cobrindo:
- Autenticação e controle de permissões (10 testes)
- Motor TOPSIS — corretude matemática (9 testes)
- Validações de entrada — municípios, critérios, auth, relatórios (14 testes)

## Equipe

Projeto acadêmico orientado pelo Prof. Me. Celso Barreto.
