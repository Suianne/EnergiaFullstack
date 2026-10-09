const test = require('node:test');
const assert = require('node:assert/strict');
const { instalarPrismaStub } = require('./helpers/prismaStub');

// O serviço importa o Prisma no topo; estas funções são puras, então basta um stub vazio.
instalarPrismaStub({});

const {
  normalizarNome,
  parseNumeroANEEL,
  extrairMunicipios,
  ehRenovavel,
  agregarRegistrosANEEL,
  validarUF,
  validarCodigoIbge,
  CRITERIOS_PADRAO,
} = require('../src/services/importacao.service');
const { ErroHttp } = require('../src/middleware/errorHandler');

test('normalizarNome remove acentos, caixa e pontuação', () => {
  assert.equal(normalizarNome('Canindé de São Francisco'), 'caninde de sao francisco');
  assert.equal(normalizarNome("Santa Bárbara d'Oeste"), 'santa barbara d oeste');
  assert.equal(normalizarNome('  Feira   de Santana '), 'feira de santana');
});

test('parseNumeroANEEL entende vírgula decimal e ponto de milhar', () => {
  assert.equal(parseNumeroANEEL('3162000,00'), 3162000);
  assert.equal(parseNumeroANEEL('1.234,56'), 1234.56);
  assert.equal(parseNumeroANEEL('12.5'), 12.5);
  assert.equal(parseNumeroANEEL('364'), 364);
  assert.equal(parseNumeroANEEL(''), 0);
  assert.equal(parseNumeroANEEL(null), 0);
  assert.equal(parseNumeroANEEL('abc'), 0);
});

test('extrairMunicipios lê vários municípios do mesmo registro', () => {
  assert.deepEqual(extrairMunicipios('Piranhas - AL, Canindé de São Francisco - SE'), [
    { nome: 'Piranhas', uf: 'AL' },
    { nome: 'Canindé de São Francisco', uf: 'SE' },
  ]);
  assert.deepEqual(extrairMunicipios('Aracaju - SE'), [{ nome: 'Aracaju', uf: 'SE' }]);
  assert.deepEqual(extrairMunicipios(''), []);
  assert.deepEqual(extrairMunicipios('sem uf'), []);
});

test('ehRenovavel classifica pela origem do combustível (e PCH/CGH na hídrica)', () => {
  assert.equal(ehRenovavel({ SigTipoGeracao: 'UFV', DscOrigemCombustivel: 'Solar' }), true);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'EOL', DscOrigemCombustivel: 'Eólica' }), true);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'UTE', DscOrigemCombustivel: 'Biomassa' }), true);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'PCH', DscOrigemCombustivel: 'Hídrica' }), true);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'CGH', DscOrigemCombustivel: 'Hídrica' }), true);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'UHE', DscOrigemCombustivel: 'Hídrica' }), false);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'UTE', DscOrigemCombustivel: 'Fóssil' }), false);
  assert.equal(ehRenovavel({ SigTipoGeracao: 'UTN', DscOrigemCombustivel: 'Nuclear' }), false);
});

const registros = [
  // renovável em operação, 1 município
  { SigTipoGeracao: 'UFV', DscOrigemCombustivel: 'Solar', DscFaseUsina: 'Operação', MdaPotenciaFiscalizadaKw: '1000', DscMuninicpios: 'Juazeiro - BA' },
  // renovável em operação, 2 municípios (potência rateada)
  { SigTipoGeracao: 'EOL', DscOrigemCombustivel: 'Eólica', DscFaseUsina: 'Operação', MdaPotenciaFiscalizadaKw: '30000,00', DscMuninicpios: 'Caetité - BA, Guanambi - BA' },
  // renovável mas em construção: ignorada
  { SigTipoGeracao: 'UFV', DscOrigemCombustivel: 'Solar', DscFaseUsina: 'Construção', MdaPotenciaFiscalizadaKw: '5000', DscMuninicpios: 'Juazeiro - BA' },
  // fóssil em operação: ignorada
  { SigTipoGeracao: 'UTE', DscOrigemCombustivel: 'Fóssil', DscFaseUsina: 'Operação', MdaPotenciaFiscalizadaKw: '8000', DscMuninicpios: 'Juazeiro - BA' },
  // grande hidrelétrica: ignorada
  { SigTipoGeracao: 'UHE', DscOrigemCombustivel: 'Hídrica', DscFaseUsina: 'Operação', MdaPotenciaFiscalizadaKw: '3162000', DscMuninicpios: 'Piranhas - AL, Canindé de São Francisco - SE' },
  // renovável em operação em outra UF: não entra no agregado da BA
  { SigTipoGeracao: 'PCH', DscOrigemCombustivel: 'Hídrica', DscFaseUsina: 'Operação', MdaPotenciaFiscalizadaKw: '2000', DscMuninicpios: 'Piranhas - AL, Paulo Afonso - BA' },
];

test('agregarRegistrosANEEL soma só renováveis em operação, rateia potência e filtra pela UF', () => {
  const { porMunicipio, usinasRenovaveis } = agregarRegistrosANEEL(registros, 'BA');

  assert.equal(usinasRenovaveis, 3); // UFV Juazeiro, EOL Caetité/Guanambi, PCH Piranhas/Paulo Afonso
  assert.deepEqual(Object.keys(porMunicipio).sort(), ['caetite', 'guanambi', 'juazeiro', 'paulo afonso']);

  assert.equal(porMunicipio.juazeiro.potenciaKw, 1000);
  assert.equal(porMunicipio.juazeiro.usinas, 1);
  assert.equal(porMunicipio.juazeiro.fontes.solar, 1);

  assert.equal(porMunicipio.caetite.potenciaKw, 15000);
  assert.equal(porMunicipio.guanambi.potenciaKw, 15000);
  assert.equal(porMunicipio.caetite.fontes.eolica, 1);

  // metade da PCH vai para Paulo Afonso; Piranhas (AL) fica de fora do agregado da BA
  assert.equal(porMunicipio['paulo afonso'].potenciaKw, 1000);
  assert.equal(porMunicipio['paulo afonso'].fontes.hidrica, 1);
  assert.equal(porMunicipio.piranhas, undefined);
});

test('agregarRegistrosANEEL casa nomes com acento diferente do IBGE', () => {
  const { porMunicipio } = agregarRegistrosANEEL(
    [{ SigTipoGeracao: 'UFV', DscOrigemCombustivel: 'Solar', DscFaseUsina: 'Operação', MdaPotenciaFiscalizadaKw: '10', DscMuninicpios: 'CAETITE - BA' }],
    'ba',
  );
  assert.ok(porMunicipio[normalizarNome('Caetité')]);
});

test('validarUF e validarCodigoIbge rejeitam entradas inválidas com 400', () => {
  assert.equal(validarUF('ba'), 'BA');
  assert.throws(() => validarUF('XX'), (e) => e instanceof ErroHttp && e.status === 400);
  assert.throws(() => validarUF(''), ErroHttp);
  assert.equal(validarCodigoIbge(2927408), '2927408');
  assert.throws(() => validarCodigoIbge('123'), (e) => e instanceof ErroHttp && e.status === 400);
});

test('critérios padrão: geração renovável é "custo" (menos geração = mais vulnerável)', () => {
  const porChave = Object.fromEntries(CRITERIOS_PADRAO.map((c) => [c.chave, c]));
  assert.equal(porChave.potencia_renovavel.tipo, 'custo');
  assert.equal(porChave.usinas_renovaveis.tipo, 'custo');
  assert.equal(porChave.pib_per_capita.tipo, 'custo');
  assert.equal(porChave.populacao.tipo, 'beneficio');
  const soma = CRITERIOS_PADRAO.reduce((s, c) => s + c.peso, 0);
  assert.ok(Math.abs(soma - 1) < 1e-9);
});
