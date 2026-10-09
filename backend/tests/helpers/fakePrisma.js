// Prisma falso em memória, só com o que os serviços usam.
// Testa a LÓGICA dos serviços (o que é gravado, em que ordem, o que acontece em erro),
// não o SQL do Prisma. Instalar ANTES de dar require nos serviços.
const path = require('node:path');

function instalarFakePrisma() {
  const db = { usuarios: [], municipios: [], criterios: [], matriz: [] };
  let seq = { u: 0, m: 0, c: 0, x: 0 };
  const achar = (lista, where = {}) =>
    lista.filter((r) =>
      Object.entries(where).every(([k, v]) => {
        if (v && typeof v === 'object' && 'in' in v) return v.in.includes(r[k]);
        if (v && typeof v === 'object' && 'not' in v) return r[k] !== v.not;
        return r[k] === v;
      }),
    );

  const prisma = {
    _db: db,
    usuario: {
      count: async ({ where } = {}) => achar(db.usuarios, where).length,
      findUnique: async ({ where }) => achar(db.usuarios, where)[0] ?? null,
      findMany: async () => [...db.usuarios],
      create: async ({ data }) => {
        if (db.usuarios.some((u) => u.email === data.email)) throw Object.assign(new Error('dup'), { code: 'P2002' });
        const u = { id: ++seq.u, createdAt: new Date(), ...data };
        db.usuarios.push(u);
        return u;
      },
      update: async ({ where, data }) => Object.assign(achar(db.usuarios, where)[0], data),
      delete: async ({ where }) => {
        db.usuarios = db.usuarios.filter((u) => u.id !== where.id);
      },
    },
    municipio: {
      findUnique: async ({ where }) => achar(db.municipios, where)[0] ?? null,
      findMany: async ({ where } = {}) => achar(db.municipios, where),
      create: async ({ data }) => {
        if (db.municipios.some((m) => m.codigoIbge === data.codigoIbge)) throw Object.assign(new Error('dup'), { code: 'P2002' });
        const m = { id: ++seq.m, ...data };
        db.municipios.push(m);
        return m;
      },
      createMany: async ({ data }) => {
        let count = 0;
        for (const d of data) {
          if (db.municipios.some((m) => m.codigoIbge === d.codigoIbge)) continue;
          db.municipios.push({ id: ++seq.m, ...d });
          count++;
        }
        return { count };
      },
      update: async ({ where, data }) => Object.assign(achar(db.municipios, where)[0], data),
    },
    criterio: {
      upsert: async ({ where, create }) => {
        let c = achar(db.criterios, where)[0];
        if (!c) {
          c = { id: ++seq.c, ...create };
          db.criterios.push(c);
        }
        return c;
      },
    },
    matrizDecisao: {
      deleteMany: async ({ where }) => {
        db.matriz = db.matriz.filter((r) => !achar([r], where).length);
      },
      createMany: async ({ data }) => {
        data.forEach((d) => db.matriz.push({ id: ++seq.x, ...d }));
        return { count: data.length };
      },
    },
    $transaction: async (arg) => (Array.isArray(arg) ? Promise.all(arg) : arg(prisma)),
  };

  const alvo = path.resolve(__dirname, '../../src/config/database.js');
  require.cache[alvo] = { id: alvo, filename: alvo, loaded: true, exports: prisma };
  return prisma;
}

// fetch falso: rotas por trecho da URL.
function instalarFetch(rotas) {
  const original = global.fetch;
  global.fetch = async (url) => {
    for (const [trecho, resposta] of rotas) {
      if (String(url).includes(trecho)) {
        const corpo = typeof resposta === 'function' ? resposta(String(url)) : resposta;
        if (corpo instanceof Error) throw corpo;
        if (corpo && corpo.__status) return { ok: false, status: corpo.__status, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => corpo };
      }
    }
    throw new Error(`fetch sem rota: ${url}`);
  };
  return () => { global.fetch = original; };
}

module.exports = { instalarFakePrisma, instalarFetch };
