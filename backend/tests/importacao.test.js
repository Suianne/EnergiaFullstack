const test = require('node:test');
const assert = require('node:assert/strict');
const { instalarFakePrisma, instalarFetch } = require('./helpers/fakePrisma');
const prisma = instalarFakePrisma();
const importacao = require('../src/services/importacao.service');
const { limparCacheAneel } = require('../src/services/fontesExternas.service');
const { ErroConflito, ErroRequisicao, ErroServicoExterno } = require('../src/middleware/errorHandler');

const ibgeMun = (id, nome) => ({ id, nome, microrregiao: { mesorregiao: { UF: { sigla: 'BA' } } } });
const serie = (porCodigo) => [{ resultados: [{ series: Object.entries(porCodigo).map(([id, v]) => ({ localidade: { id }, serie: { 2023: String(v) } })) }] }];

function rotas({ aneel } = {}) {
  return [
    ['localidades/estados/BA/municipios', [ibgeMun(2927408, 'Salvador'), ibgeMun(2910800, 'Feira de Santana'), ibgeMun(2905701, 'Camaçari')]],
    ['localidades/municipios/2927408', ibgeMun(2927408, 'Salvador')],
    ['localidades/municipios/2910800', ibgeMun(2910800, 'Feira de Santana')],
    ['agregados/6579', serie({ 2927408: 2400000, 2910800: 600000, 2905701: 300000 })],
    // PIB total em mil R$: Salvador 100 bi, Feira 12 bi, Camaçari 30 bi
    ['agregados/5938', serie({ 2927408: 100000000, 2910800: 12000000, 2905701: 30000000 })],
    ['aneel', aneel ?? { success: true, result: { records: [
      { SigTipoGeracao: 'UFV', DscFaseUsina: 'Operação', DscMuninicpios: 'Salvador - BA', MdaPotenciaFiscalizadaKw: '1200' },
      { SigTipoGeracao: 'CGH', DscFaseUsina: 'Operação', DscMuninicpios: 'FEIRA DE SANTANA - BA', MdaPotenciaFiscalizadaKw: '300' },
    ] } }],
  ];
}

test.beforeEach(() => {
  limparCacheAneel();
  Object.assign(prisma._db, { municipios: [], criterios: [], matriz: [] });
});

test('importar estado cria municípios JÁ com dados IBGE+ANEEL; sem geração fica marcado', async () => {
  const restaurar = instalarFetch(rotas());
  try {
    const r = await importacao.importarMunicipiosUF('ba');
    assert.equal(r.importados, 3);
    assert.equal(r.completos, 3);
    assert.equal(r.semGeracaoRenovavel, 1); // Camaçari não aparece na ANEEL
    assert.equal(prisma._db.criterios.length, 4);
    assert.equal(prisma._db.matriz.length, 12); // 3 municípios x 4 critérios

    const cam = prisma._db.municipios.find((m) => m.nome === 'Camaçari');
    assert.equal(cam.potenciaRenovavelKw, 0);
    assert.equal(cam.usinasRenovaveis, 0);
    assert.ok(cam.dadosAtualizadosEm);
    assert.equal(cam.pibPerCapita, 100000); // 30e6 mil R$ * 1000 / 300.000 hab

    const sal = prisma._db.municipios.find((m) => m.nome === 'Salvador');
    const critPot = prisma._db.criterios.find((c) => c.codigo === 'potencia_renovavel_per_capita');
    const linha = prisma._db.matriz.find((x) => x.municipioId === sal.id && x.criterioId === critPot.id);
    assert.ok(Math.abs(linha.valor - 0.5) < 1e-9); // 1200 kW = 1.200.000 W / 2.400.000 hab
  } finally { restaurar(); }
});

test('importar de novo não duplica municípios nem linhas da matriz', async () => {
  const restaurar = instalarFetch(rotas());
  try {
    await importacao.importarMunicipiosUF('BA');
    const r = await importacao.importarMunicipiosUF('BA');
    assert.equal(r.importados, 0);
    assert.equal(prisma._db.municipios.length, 3);
    assert.equal(prisma._db.matriz.length, 12);
    assert.equal(prisma._db.criterios.length, 4);
  } finally { restaurar(); }
});

test('ANEEL fora do ar: nada é gravado (nem município, nem zeros)', async () => {
  const restaurar = instalarFetch(rotas({ aneel: { __status: 500 } }));
  try {
    await assert.rejects(() => importacao.importarMunicipiosUF('BA'), ErroServicoExterno);
    assert.equal(prisma._db.municipios.length, 0);
    assert.equal(prisma._db.matriz.length, 0);
  } finally { restaurar(); }
});

test('cadastrar município grava o município e os dados na mesma operação', async () => {
  const restaurar = instalarFetch(rotas());
  try {
    const r = await importacao.cadastrarMunicipio('2910800');
    assert.equal(r.completo, true);
    assert.equal(r.municipio.nome, 'Feira de Santana'); // nome vem do IBGE
    assert.equal(prisma._db.matriz.length, 4);
    assert.equal(r.semGeracaoRenovavel, false);
  } finally { restaurar(); }
});

test('cadastrar município repetido (código ou nome) dá conflito; código inválido dá erro', async () => {
  const restaurar = instalarFetch(rotas());
  try {
    await importacao.cadastrarMunicipio('2910800');
    await assert.rejects(() => importacao.cadastrarMunicipio('2910800'), ErroConflito);
    // mesmo nome/UF com outro código (cadastro manual antigo, grafia diferente)
    prisma._db.municipios.push({ id: 99, nome: 'SALVADOR', uf: 'BA', codigoIbge: '0000001' });
    await assert.rejects(() => importacao.cadastrarMunicipio('2927408'), ErroConflito);
    await assert.rejects(() => importacao.cadastrarMunicipio('123'), ErroRequisicao);
  } finally { restaurar(); }
});

test('cadastrar município com ANEEL fora do ar não cria nada', async () => {
  const restaurar = instalarFetch(rotas({ aneel: new Error('rede') }));
  try {
    await assert.rejects(() => importacao.cadastrarMunicipio('2927408'), ErroServicoExterno);
    assert.equal(prisma._db.municipios.length, 0);
  } finally { restaurar(); }
});

test('município sem PIB/população no IBGE é cadastrado com aviso e sem linhas na matriz', async () => {
  const r0 = rotas();
  const sem = r0.map(([t, v]) => (t === 'agregados/5938' ? [t, serie({})] : [t, v]));
  const restaurar = instalarFetch(sem);
  try {
    const r = await importacao.cadastrarMunicipio('2910800');
    assert.equal(r.completo, false);
    assert.ok(r.aviso);
    assert.equal(prisma._db.matriz.length, 0);
  } finally { restaurar(); }
});

test('UF inexistente é rejeitada', async () => {
  await assert.rejects(() => importacao.importarMunicipiosUF('XX'), ErroRequisicao);
});
