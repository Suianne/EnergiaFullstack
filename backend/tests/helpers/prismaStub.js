// Instala um Prisma falso ANTES de o app/serviços serem carregados,
// para testar rotas e regras de negócio sem banco de dados.
const path = require('node:path');

function instalarPrismaStub(stub) {
  const caminho = path.resolve(__dirname, '..', '..', 'src', 'config', 'database.js');
  require.cache[caminho] = {
    id: caminho,
    filename: caminho,
    loaded: true,
    exports: stub,
    children: [],
    paths: [],
  };
  return stub;
}

function usuarioTeste(perfil = 'ADMINISTRADOR', id = 1) {
  return { id, nome: 'Teste', email: `teste${id}@email.com`, perfil };
}

// Tabela de usuários em memória com a API mínima usada pelos serviços.
function criarStubUsuarios(iniciais = []) {
  const usuarios = iniciais.map((u) => ({ ...u }));
  let proximoId = usuarios.reduce((max, u) => Math.max(max, u.id), 0) + 1;

  const encontrar = (where) =>
    usuarios.find((u) => (where.id !== undefined ? u.id === where.id : u.email === where.email)) || null;
  const filtrar = (where = {}) => usuarios.filter((u) => (where.perfil ? u.perfil === where.perfil : true));
  const projetar = (u, select) => (select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, u[k]])) : { ...u });

  const stub = {
    usuarios,
    // Transação interativa e SQL bruto (lock consultivo) viram no-ops em memória
    $transaction: async (fn) => fn(stub),
    $executeRaw: async () => 0,
    usuario: {
      findUnique: async ({ where, select }) => {
        const u = encontrar(where);
        return u ? projetar(u, select) : null;
      },
      findMany: async ({ select } = {}) => usuarios.map((u) => projetar(u, select)),
      count: async ({ where } = {}) => filtrar(where).length,
      create: async ({ data }) => {
        const u = { id: proximoId++, createdAt: new Date(), ...data };
        usuarios.push(u);
        return { ...u };
      },
      update: async ({ where, data, select }) => {
        const u = encontrar(where);
        if (!u) throw Object.assign(new Error('não encontrado'), { code: 'P2025' });
        Object.assign(u, data);
        return projetar(u, select);
      },
      delete: async ({ where }) => {
        const i = usuarios.findIndex((u) => u.id === where.id);
        if (i < 0) throw Object.assign(new Error('não encontrado'), { code: 'P2025' });
        return usuarios.splice(i, 1)[0];
      },
    },
  };
  return stub;
}

module.exports = { instalarPrismaStub, usuarioTeste, criarStubUsuarios };
