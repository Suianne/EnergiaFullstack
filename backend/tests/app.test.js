const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { instalarPrismaStub, usuarioTeste } = require('./helpers/prismaStub');

// Banco falso: só o que estas rotas usam (usuário logado + salvar simulação)
const usuario = usuarioTeste('PESQUISADOR');
const simulacoes = [];
instalarPrismaStub({
  usuario: { findUnique: async ({ where }) => (where.id === usuario.id ? { ...usuario } : null) },
  simulacao: {
    create: async ({ data }) => {
      const s = { id: simulacoes.length + 1, ...data, resultadosRanking: data.resultadosRanking.create };
      simulacoes.push(s);
      return s;
    },
  },
});

const app = require('../src/app');
const { JWT_SECRET } = require('../src/middleware/auth');

const exemplo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'topsis_exemplo.json'), 'utf8'));
const token = jwt.sign(usuario, JWT_SECRET, { expiresIn: '1h' });

let server;
let base;

test.before(
  () =>
    new Promise((resolve) => {
      // porta 0 = o sistema escolhe uma porta livre (não conflita com nada)
      server = app.listen(0, () => {
        base = `http://localhost:${server.address().port}`;
        resolve();
      });
    }),
);
test.after(() => server.close());

const post = (corpo, { auth = true } = {}) =>
  fetch(`${base}/api/topsis/executar`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });

test('GET /health responde ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('rotas da API exigem token', async () => {
  const res = await post(exemplo, { auth: false });
  assert.equal(res.status, 401);
});

test('POST /api/topsis/executar devolve o ranking B > A > C com nomes e salva a simulação', async () => {
  const res = await post(exemplo);
  assert.equal(res.status, 200);
  const { ranking, simulacaoId } = await res.json();
  assert.deepEqual(ranking.map((r) => r.alternativa), ['Município B', 'Município A', 'Município C']);
  assert.deepEqual(ranking.map((r) => r.posicao), [1, 2, 3]);
  assert.ok(Math.abs(ranking[1].ci - 0.3361) < 1e-3);

  assert.equal(simulacaoId, simulacoes.length);
  const salva = simulacoes[simulacaoId - 1];
  assert.equal(salva.usuarioId, usuario.id);
  assert.deepEqual(salva.parametros.rankingAlternativas, ['Município B', 'Município A', 'Município C']);
  assert.equal(salva.resultadosRanking.length, 3);
});

test('pesos que não somam 1 dão 400 com mensagem clara', async () => {
  const ruim = structuredClone(exemplo);
  ruim.criterios[0].peso = 0.9;
  const res = await post(ruim);
  assert.equal(res.status, 400);
  assert.match((await res.json()).erro, /somar 1/);
});

test('formato errado dá 400: matriz com linhas a menos', async () => {
  const ruim = structuredClone(exemplo);
  ruim.matriz.pop();
  const res = await post(ruim);
  assert.equal(res.status, 400);
  assert.match((await res.json()).erro, /linha/);
});

test('JSON quebrado dá 400 e rota inexistente dá 404', async () => {
  assert.equal((await post('{ quebrado')).status, 400);
  assert.equal((await fetch(`${base}/nada`)).status, 404);
});

test('usuário que não existe mais no banco recebe 401', async () => {
  const tokenFantasma = jwt.sign({ ...usuario, id: 999 }, JWT_SECRET, { expiresIn: '1h' });
  const res = await fetch(`${base}/api/municipios`, { headers: { Authorization: `Bearer ${tokenFantasma}` } });
  assert.equal(res.status, 401);
});
