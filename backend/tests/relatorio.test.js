const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const { gerarCsvRanking } = require('../src/services/relatorio.service');

const ranking = [
  { posicao: 1, alternativa: 'Município B', ci: 1, distanciaPositiva: 0, distanciaNegativa: 0.22518515 },
  { posicao: 2, alternativa: 'Município A', ci: 0.33605793, distanciaPositiva: 0.1514, distanciaNegativa: 0.0766 },
];

// ---------- Unitários: a função que gera o texto ----------

test('CSV começa com BOM, usa ; e vírgula decimal', () => {
  const csv = gerarCsvRanking(ranking);
  assert.ok(csv.startsWith('\uFEFFPosição;Alternativa;Ci;'));
  const linhas = csv.trim().split('\r\n');
  assert.equal(linhas.length, 3); // cabeçalho + 2 linhas
  assert.equal(linhas[1], '1;Município B;1,0000;0,0000;0,2252');
  assert.equal(linhas[2], '2;Município A;0,3361;0,1514;0,0766');
});

test('campos com ; ou aspas são colocados entre aspas', () => {
  const csv = gerarCsvRanking([
    { posicao: 1, alternativa: 'Vila "Nova"; BA', ci: 0.5, distanciaPositiva: 0.1, distanciaNegativa: 0.1 },
  ]);
  assert.ok(csv.includes('"Vila ""Nova""; BA"'));
});

test('nomes que começam com fórmula do Excel são neutralizados', () => {
  const csv = gerarCsvRanking([
    { posicao: 1, alternativa: '=HYPERLINK("http://x")', ci: 0.5, distanciaPositiva: 0.1, distanciaNegativa: 0.1 },
  ]);
  assert.ok(!csv.includes(';=HYPERLINK'));
  assert.ok(csv.includes(";\"'=HYPERLINK"));
});

// ---------- Integração: a rota HTTP ----------

let server;
let base;
test.before(
  () =>
    new Promise((resolve) => {
      server = app.listen(0, () => {
        base = `http://localhost:${server.address().port}`;
        resolve();
      });
    }),
);
test.after(() => server.close());

const post = (corpo) =>
  fetch(`${base}/api/relatorios/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

test('POST /api/relatorios/csv devolve um arquivo CSV para download', async () => {
  const res = await post({ ranking });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="ranking-topsis\.csv"/);
  const texto = await res.text();
  assert.ok(texto.includes('Município B'));
});

test('ranking ausente, vazio ou com item inválido dá 400', async () => {
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ ranking: [] })).status, 400);
  const res = await post({ ranking: [{ posicao: 1, alternativa: 'A', ci: 'x', distanciaPositiva: 0, distanciaNegativa: 0 }] });
  assert.equal(res.status, 400);
  assert.match((await res.json()).erro, /"ci"/);
});