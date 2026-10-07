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
│   │   ├── services/          # Integração com API + dados mock
│   │   ├── styles/            # CSS global
│   │   └── utils/             # Motor TOPSIS no frontend
│   ├── Dockerfile
│   └── package.json
├── backend/                   # API REST (Node.js + Express)
│   ├── src/
│   │   ├── controllers/       # Auth, Municipio, Criterio, Topsis, Simulacao, Relatorio, Importacao
│   │   ├── services/          # Lógica de negócio + Motor TOPSIS
│   │   ├── routes/            # Definição de endpoints
│   │   ├── middleware/        # Autenticação JWT + tratamento de erros
│   │   └── config/            # Conexão Prisma/PostgreSQL
│   ├── prisma/
│   │   └── schema.prisma      # Modelagem do banco de dados
│   ├── tests/                 # 43 testes automatizados
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

### Importação (autenticado)
| Método | Endpoint | Permissão |
|---|---|---|
| GET | `/api/importacao/ibge/municipios/:uf` | Todos |
| POST | `/api/importacao/ibge/municipios/:uf` | ADMINISTRADOR |

## Perfis de Acesso

| Perfil | Pode fazer |
|---|---|
| **ADMINISTRADOR** | Acesso total — cadastro de municípios, critérios, TOPSIS, relatórios, importação |
| **PESQUISADOR** | Configurar critérios, executar TOPSIS, ver resultados e mapa |
| **GESTOR** | Executar TOPSIS, ver resultados, gerar relatórios PDF |

## Banco de Dados

Tabelas: `usuarios`, `municipios`, `criterios`, `matriz_decisao`, `simulacoes`, `resultados_ranking`

O schema completo está em `backend/prisma/schema.prisma`.

## Testes

```bash
cd backend
node --test tests/auth.test.js tests/topsis.test.js tests/validacoes.test.js
```

43 testes cobrindo:
- Autenticação e controle de permissões (10 testes)
- Motor TOPSIS — corretude matemática (9 testes)
- Validações de entrada — municípios, critérios, auth, relatórios (24 testes)

## Equipe

Projeto acadêmico orientado pelo Prof. Me. Celso Barreto.
