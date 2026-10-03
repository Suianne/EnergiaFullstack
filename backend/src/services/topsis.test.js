const test = require('node:test');
const assert = require('node:assert/strict');
const { topsis, TopsisInputError } = require('./topsis.service');

// Exemplo numérico do Cap. 7.3 do roteiro.
// Critérios: C1 custo, C2 benefício, C3 benefício, C4 custo, C5 benefício.
const matriz = [
  [15, 0.8, 980, 0.75, 5.2], // Município A
  [5, 2.1, 1850, 0.62, 5.8], // Município B
  [22, 0.3, 650, 0.89, 4.9], // Município C
];
const pesos = [0.2, 0.2, 0.15, 0.25, 0.2];
const tipos = ['custo', 'beneficio', 'beneficio', 'custo', 'beneficio'];

const perto = (a, b, eps = 1e-3) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('exemplo do roteiro: ranking B > A > C', () => {
  const { ranking } = topsis(matriz, pesos, tipos);
  assert.deepEqual(ranking.map((r) => r.indice), [1, 0, 2]); // B, A, C
  assert.deepEqual(ranking.map((r) => r.posicao), [1, 2, 3]);
});

test('exemplo do roteiro: valores de Ci e distâncias', () => {
  const { ranking } = topsis(matriz, pesos, tipos);
  const [b, a, c] = ranking;
  perto(b.ci, 1);
  perto(a.ci, 0.3361);
  perto(c.ci, 0);
  perto(a.distanciaPositiva, 0.1514);
  perto(a.distanciaNegativa, 0.0766);
});

test('Ci fica sempre entre 0 e 1', () => {
  const { ranking } = topsis(matriz, pesos, tipos);
  for (const r of ranking) assert.ok(r.ci >= 0 && r.ci <= 1);
});

test('critério de custo inverte a preferência', () => {
  const m = [[10], [20]];
  const comoBeneficio = topsis(m, [1], ['beneficio']).ranking[0].indice;
  const comoCusto = topsis(m, [1], ['custo']).ranking[0].indice;
  assert.equal(comoBeneficio, 1);
  assert.equal(comoCusto, 0);
});

test('multiplicar um critério por uma constante não altera o ranking', () => {
  const escalada = matriz.map((l) => [l[0], l[1], l[2] * 1000, l[3], l[4]]);
  const a = topsis(matriz, pesos, tipos).ranking.map((r) => r.indice);
  const b = topsis(escalada, pesos, tipos).ranking.map((r) => r.indice);
  assert.deepEqual(a, b);
});

test('não altera a matriz de entrada', () => {
  const copia = JSON.stringify(matriz);
  topsis(matriz, pesos, tipos);
  assert.equal(JSON.stringify(matriz), copia);
});

test('alternativas idênticas recebem Ci neutro e mantêm a ordem de entrada', () => {
  const { ranking } = topsis([[1, 2], [1, 2]], [0.5, 0.5], ['beneficio', 'custo']);
  assert.deepEqual(ranking.map((r) => r.ci), [0.5, 0.5]);
  assert.deepEqual(ranking.map((r) => r.indice), [0, 1]);
});

test('coluna toda zerada não gera NaN', () => {
  const { ranking } = topsis([[0, 1], [0, 3]], [0.5, 0.5], ['beneficio', 'beneficio']);
  for (const r of ranking) assert.ok(Number.isFinite(r.ci));
});

test('validações de entrada', () => {
  const erro = (fn, trecho) =>
    assert.throws(fn, (e) => e instanceof TopsisInputError && e.message.includes(trecho));

  erro(() => topsis([[1]], [1], ['custo']), '2 alternativas');
  erro(() => topsis(matriz, [0.5, 0.5, 0.5, 0.5, 0.5], tipos), 'somar 1');
  erro(() => topsis(matriz, pesos, ['custo']), 'tipos');
  erro(() => topsis(matriz, pesos, ['x', 'x', 'x', 'x', 'x']), 'Tipo inválido');
  erro(() => topsis([[1, 2], [3]], [0.5, 0.5], ['custo', 'custo']), 'alternativa 2');
  erro(() => topsis([[1, NaN], [3, 4]], [0.5, 0.5], ['custo', 'custo']), 'Valor inválido');
  erro(() => topsis(matriz, [-0.2, 0.4, 0.4, 0.2, 0.2], tipos), 'Peso inválido');
});