const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const app = require('../src/app');

const exemplo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'topsis_exemplo.json'), 'utf8'));

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

const post = (corpo) =>
  fetch(`${base}/api/topsis/executar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo),
  });

test('GET /health responde ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('POST /api/topsis/executar devolve o ranking B > A > C com nomes', async () => {
  const res = await post(exemplo);
  assert.equal(res.status, 200);
  const { ranking } = await res.json();
  assert.deepEqual(ranking.map((r) => r.alternativa), ['Município B', 'Município A', 'Município C']);
  assert.deepEqual(ranking.map((r) => r.posicao), [1, 2, 3]);
  assert.ok(Math.abs(ranking[1].ci - 0.3361) < 1e-3);
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