const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { instalarPrismaStub, usuarioTeste } = require('./helpers/prismaStub');

const ranking = [
  { posicao: 1, alternativa: 'Município B', ci: 1, distanciaPositiva: 0, distanciaNegativa: 0.22518515 },
  { posicao: 2, alternativa: 'Município A', ci: 0.33605793, distanciaPositiva: 0.1514, distanciaNegativa: 0.0766 },
];

// Simulação salva "no banco" para a rota de PDF
const simulacaoSalva = {
  id: 7,
  dataExecucao: new Date('2026-10-09T12:00:00Z'),
  parametros: {
    origem: 'banco',
    criterios: [
      { nome: 'População', tipo: 'beneficio', peso: 0.5, unidade: 'hab', fonte: 'IBGE' },
      { nome: 'Potência renovável instalada', tipo: 'custo', peso: 0.5, unidade: 'kW', fonte: 'ANEEL' },
    ],
    excluidos: [{ nome: 'Cidade Sem Dados', uf: 'BA', motivo: 'Sem dados para: População.' }],
  },
  usuario: { id: 2, nome: 'Gestora', email: 'gestora@email.com' },
  resultadosRanking: [
    { posicao: 1, coeficienteCi: '0.91000000', distanciaPositiva: '0.01', distanciaNegativa: '0.10', municipio: { nome: 'Campo Formoso', uf: 'BA', geracaoRenovavel: false } },
    { posicao: 2, coeficienteCi: '0.20000000', distanciaPositiva: '0.08', distanciaNegativa: '0.02', municipio: { nome: 'Juazeiro', uf: 'BA', geracaoRenovavel: true } },
  ],
};

const usuarios = {
  1: usuarioTeste('GESTOR', 1),
  2: usuarioTeste('PESQUISADOR', 2),
};
instalarPrismaStub({
  usuario: { findUnique: async ({ where }) => usuarios[where.id] || null },
  simulacao: { findUnique: async ({ where }) => (where.id === simulacaoSalva.id ? simulacaoSalva : null) },
});

const app = require('../src/app');
const { JWT_SECRET } = require('../src/middleware/auth');
const { gerarCsvRanking, gerarPdfRanking, montarRelatorioDaSimulacao } = require('../src/services/relatorio.service');

const tokenGestor = jwt.sign(usuarios[1], JWT_SECRET, { expiresIn: '1h' });
const tokenPesquisador = jwt.sign(usuarios[2], JWT_SECRET, { expiresIn: '1h' });

// ---------- Unitários: CSV ----------

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

// ---------- Unitários: PDF ----------

function pdfParaBuffer(doc) {
  return new Promise((resolve, reject) => {
    const partes = [];
    doc.on('data', (c) => partes.push(c));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
}

test('montarRelatorioDaSimulacao usa nome/UF do município e a flag de geração renovável', () => {
  const relatorio = montarRelatorioDaSimulacao(simulacaoSalva);
  assert.equal(relatorio.ranking.length, 2);
  assert.deepEqual(relatorio.ranking[0], {
    posicao: 1, alternativa: 'Campo Formoso', uf: 'BA', geracaoRenovavel: false,
    ci: 0.91, distanciaPositiva: 0.01, distanciaNegativa: 0.1,
  });
  assert.equal(relatorio.criterios.length, 2);
  assert.equal(relatorio.excluidos.length, 1);
  assert.equal(relatorio.meta.simulacaoId, 7);
  assert.equal(relatorio.meta.usuario, 'Gestora');
});

test('montarRelatorioDaSimulacao cai para os nomes das alternativas quando não há município', () => {
  const relatorio = montarRelatorioDaSimulacao({
    id: 1,
    parametros: { rankingAlternativas: ['B', 'A'] },
    resultadosRanking: [
      { posicao: 1, coeficienteCi: '1', distanciaPositiva: '0', distanciaNegativa: '1', municipio: null },
      { posicao: 2, coeficienteCi: '0', distanciaPositiva: '1', distanciaNegativa: '0', municipio: null },
    ],
  });
  assert.deepEqual(relatorio.ranking.map((r) => r.alternativa), ['B', 'A']);
  assert.equal(relatorio.ranking[0].geracaoRenovavel, null);
});

test('gerarPdfRanking produz um PDF válido com várias páginas quando o ranking é grande', async () => {
  const grande = Array.from({ length: 120 }, (_, i) => ({
    posicao: i + 1,
    alternativa: `Município ${i + 1}`,
    uf: 'BA',
    ci: 1 - i / 120,
    distanciaPositiva: i / 120,
    distanciaNegativa: 1 - i / 120,
    geracaoRenovavel: i % 3 === 0 ? false : i % 3 === 1 ? true : null,
  }));
  const doc = gerarPdfRanking({
    ranking: grande,
    criterios: simulacaoSalva.parametros.criterios,
    excluidos: simulacaoSalva.parametros.excluidos,
    meta: { simulacaoId: 1, usuario: 'Teste' },
  });
  const buffer = await pdfParaBuffer(doc);
  assert.ok(buffer.length > 5000, 'PDF muito pequeno');
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  // 120 linhas de 16pt não cabem em uma página A4: tem de haver mais de uma
  const paginas = buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || [];
  assert.ok(paginas.length >= 2, `esperava >= 2 páginas, achou ${paginas.length}`);
});

// ---------- Integração: as rotas HTTP ----------

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

const post = (corpo, token = tokenGestor) =>
  fetch(`${base}/api/relatorios/csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
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

test('POST /api/relatorios/csv sem token dá 401', async () => {
  assert.equal((await post({ ranking }, null)).status, 401);
});

test('ranking ausente, vazio ou com item inválido dá 400', async () => {
  assert.equal((await post({})).status, 400);
  assert.equal((await post({ ranking: [] })).status, 400);
  const res = await post({ ranking: [{ posicao: 1, alternativa: 'A', ci: 'x', distanciaPositiva: 0, distanciaNegativa: 0 }] });
  assert.equal(res.status, 400);
  assert.match((await res.json()).erro, /"ci"/);
});

test('GET /api/relatorios/:id/pdf devolve PDF para GESTOR', async () => {
  const res = await fetch(`${base}/api/relatorios/7/pdf`, { headers: { Authorization: `Bearer ${tokenGestor}` } });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  assert.match(res.headers.get('content-disposition'), /relatorio-topsis-7\.pdf/);
  const buffer = Buffer.from(await res.arrayBuffer());
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
});

test('GET /api/relatorios/:id/pdf: PESQUISADOR recebe 403 e simulação inexistente 404', async () => {
  const proibido = await fetch(`${base}/api/relatorios/7/pdf`, { headers: { Authorization: `Bearer ${tokenPesquisador}` } });
  assert.equal(proibido.status, 403);
  const inexistente = await fetch(`${base}/api/relatorios/999/pdf`, { headers: { Authorization: `Bearer ${tokenGestor}` } });
  assert.equal(inexistente.status, 404);
});
