const test = require('node:test');
const assert = require('node:assert/strict');
const { instalarFakePrisma, instalarFetch } = require('./helpers/fakePrisma');
instalarFakePrisma();
const f = require('../src/services/fontesExternas.service');
const { topsis } = require('../src/services/topsis.service');
const { ErroServicoExterno } = require('../src/middleware/errorHandler');

test('normalizarNome ignora acento, caixa, hífen e apóstrofo', () => {
  assert.equal(f.normalizarNome('São Paulo'), 'SAO PAULO');
  assert.equal(f.normalizarNome('Mogi-Guaçu'), f.normalizarNome('MOGI GUACU'));
  assert.equal(f.normalizarNome("Olho d'Água"), f.normalizarNome('OLHO D ÁGUA'));
});

test('ANEEL: usina em vários municípios divide a potência; só renovável em operação conta', () => {
  const acc = {};
  f.acumularRegistrosANEEL([
    { SigTipoGeracao: 'EOL', DscFaseUsina: 'Operação', DscMuninicpios: 'Sento Sé/Casa Nova - BA', MdaPotenciaFiscalizadaKw: '1000,5' },
    { SigTipoGeracao: 'UFV', DscFaseUsina: 'Operação', DscMuninicpios: 'Sento Sé - BA', MdaPotenciaFiscalizadaKw: '500' },
    { SigTipoGeracao: 'UTE', DscFaseUsina: 'Operação', DscMuninicpios: 'Sento Sé - BA', MdaPotenciaFiscalizadaKw: '9999' },
    { SigTipoGeracao: 'UFV', DscFaseUsina: 'Construção', DscMuninicpios: 'Sento Sé - BA', MdaPotenciaFiscalizadaKw: '9999' },
  ], acc);
  assert.equal(acc['SENTO SE'].usinas, 2);
  assert.ok(Math.abs(acc['SENTO SE'].potenciaKw - 1000.25) < 1e-9);
  assert.equal(acc['CASA NOVA'].usinas, 1);
});

test('sem população/PIB não há valores (município fica fora do TOPSIS em vez de virar zero)', () => {
  assert.equal(f.calcularValoresCriterios({ populacao: 0, pibPerCapita: 10, potenciaKw: 0, usinas: 0 }), null);
  assert.equal(f.calcularValoresCriterios({ populacao: 1000, pibPerCapita: null, potenciaKw: 0, usinas: 0 }), null);
  const v = f.calcularValoresCriterios({ populacao: 2000, pibPerCapita: 15000, potenciaKw: 10, usinas: 2 });
  assert.equal(v.potencia_renovavel_per_capita, 5); // 10 kW = 10.000 W / 2.000 hab
  assert.equal(v.usinas_renovaveis_100mil, 100);
});

test('semGeracaoConstatada exige consulta feita e zeros; "nunca consultado" não conta', () => {
  assert.equal(f.semGeracaoConstatada({ dadosAtualizadosEm: new Date(), potenciaRenovavelKw: 0, usinasRenovaveis: 0 }), true);
  assert.equal(f.semGeracaoConstatada({ dadosAtualizadosEm: null, potenciaRenovavelKw: null, usinasRenovaveis: null }), false);
  assert.equal(f.semGeracaoConstatada({ dadosAtualizadosEm: new Date(), potenciaRenovavelKw: '12.5', usinasRenovaveis: 1 }), false);
});

test('TOPSIS: com os critérios padrão, município SEM geração fica mais vulnerável (Ci maior)', () => {
  const tipos = f.CRITERIOS_PADRAO.map((c) => c.tipo);
  const pesos = f.CRITERIOS_PADRAO.map((c) => c.peso);
  // Dois municípios idênticos em população e PIB; só a geração difere.
  const base = { populacao: 20000, pibPerCapita: 18000 };
  const semGeracao = f.calcularValoresCriterios({ ...base, potenciaKw: 0, usinas: 0 });
  const comGeracao = f.calcularValoresCriterios({ ...base, potenciaKw: 4000, usinas: 12 });
  const outro = f.calcularValoresCriterios({ populacao: 90000, pibPerCapita: 30000, potenciaKw: 900, usinas: 3 });
  const ordem = (v) => f.CRITERIOS_PADRAO.map((c) => v[c.codigo]);
  const { ranking } = topsis([ordem(semGeracao), ordem(comGeracao), ordem(outro)], pesos, tipos);
  const ci = (i) => ranking.find((r) => r.indice === i).ci;
  assert.ok(ci(0) > ci(1), `sem geração (${ci(0)}) deveria ter Ci maior que com geração (${ci(1)})`);
});

const resp = (records) => ({ success: true, result: { records } });
const rec = (n) => Array.from({ length: n }, () => ({ SigTipoGeracao: 'UFV', DscFaseUsina: 'Operação', DscMuninicpios: 'X - BA', MdaPotenciaFiscalizadaKw: '1' }));

test('ANEEL fora do ar: lança erro em vez de devolver "sem geração"', async () => {
  const restaurar = instalarFetch([['aneel', { __status: 503 }]]);
  try {
    await assert.rejects(() => f.buscarDadosANEEL('ZZ'), ErroServicoExterno);
  } finally { restaurar(); }
});

test('ANEEL com várias páginas soma tudo; resposta success=false é erro', async () => {
  let chamadas = 0;
  let restaurar = instalarFetch([['aneel', (url) => {
    chamadas++;
    return resp(url.includes('offset=0') ? rec(1000) : rec(5));
  }]]);
  try {
    const d = await f.buscarDadosANEEL('PA');
    assert.equal(chamadas, 2);
    assert.equal(d.porMunicipio.X.usinas, 1005);
  } finally { restaurar(); }

  restaurar = instalarFetch([['aneel', { success: false }]]);
  try {
    await assert.rejects(() => f.buscarDadosANEEL('PB'), ErroServicoExterno);
  } finally { restaurar(); }
});
