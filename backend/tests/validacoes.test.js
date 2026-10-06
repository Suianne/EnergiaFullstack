const test = require('node:test');
const assert = require('node:assert/strict');
const { ErroRequisicao } = require('../src/middleware/errorHandler');
const { gerarCsvRanking } = require('../src/services/relatorio.service');

// ==================== Validações de Município ====================
// Replica a lógica de validação do controller sem importar o Prisma

function validarMunicipio(body) {
  const { nome, uf } = body ?? {};
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroRequisicao('"nome" é obrigatório.');
  }
  if (!uf || typeof uf !== 'string' || uf.length !== 2) {
    throw new ErroRequisicao('"uf" deve ter exatamente 2 caracteres.');
  }
}

test('município: nome vazio lança erro', () => {
  assert.throws(() => validarMunicipio({ nome: '', uf: 'BA' }), ErroRequisicao);
});

test('município: nome ausente lança erro', () => {
  assert.throws(() => validarMunicipio({ uf: 'BA' }), ErroRequisicao);
});

test('município: uf com 3 letras lança erro', () => {
  assert.throws(() => validarMunicipio({ nome: 'Salvador', uf: 'BAH' }), ErroRequisicao);
});

test('município: uf com 1 letra lança erro', () => {
  assert.throws(() => validarMunicipio({ nome: 'Salvador', uf: 'B' }), ErroRequisicao);
});

test('município: body null lança erro', () => {
  assert.throws(() => validarMunicipio(null), ErroRequisicao);
});

test('município: dados válidos não lança erro', () => {
  assert.doesNotThrow(() => validarMunicipio({ nome: 'Salvador', uf: 'BA' }));
});

// ==================== Validações de Critério ====================

const TIPOS_VALIDOS = ['beneficio', 'custo'];

function validarCriterio(body) {
  const { nome, tipo } = body ?? {};
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroRequisicao('"nome" é obrigatório.');
  }
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    throw new ErroRequisicao('"tipo" deve ser "beneficio" ou "custo".');
  }
}

test('critério: nome vazio lança erro', () => {
  assert.throws(() => validarCriterio({ nome: '' }), ErroRequisicao);
});

test('critério: tipo inválido lança erro', () => {
  assert.throws(() => validarCriterio({ nome: 'Irradiação', tipo: 'invalido' }), ErroRequisicao);
});

test('critério: tipo beneficio é aceito', () => {
  assert.doesNotThrow(() => validarCriterio({ nome: 'Irradiação', tipo: 'beneficio' }));
});

test('critério: tipo custo é aceito', () => {
  assert.doesNotThrow(() => validarCriterio({ nome: 'Custo', tipo: 'custo' }));
});

test('critério: sem tipo é aceito (opcional)', () => {
  assert.doesNotThrow(() => validarCriterio({ nome: 'Irradiação' }));
});

// ==================== Validações de Auth ====================

const PERFIS_VALIDOS = ['ADMINISTRADOR', 'PESQUISADOR', 'GESTOR'];

function validarRegistro(body) {
  const { nome, email, senha, perfil } = body ?? {};
  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroRequisicao('"nome" é obrigatório.');
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    throw new ErroRequisicao('"email" inválido.');
  }
  if (!senha || typeof senha !== 'string' || senha.length < 6) {
    throw new ErroRequisicao('"senha" deve ter no mínimo 6 caracteres.');
  }
  if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
    throw new ErroRequisicao(`"perfil" deve ser: ${PERFIS_VALIDOS.join(', ')}.`);
  }
}

function validarLogin(body) {
  const { email, senha } = body ?? {};
  if (!email || typeof email !== 'string') {
    throw new ErroRequisicao('"email" é obrigatório.');
  }
  if (!senha || typeof senha !== 'string') {
    throw new ErroRequisicao('"senha" é obrigatória.');
  }
}

test('registro: nome vazio lança erro', () => {
  assert.throws(() => validarRegistro({ nome: '', email: 'a@b.com', senha: '123456' }), ErroRequisicao);
});

test('registro: email sem @ lança erro', () => {
  assert.throws(() => validarRegistro({ nome: 'Teste', email: 'invalido', senha: '123456' }), ErroRequisicao);
});

test('registro: senha curta lança erro', () => {
  assert.throws(() => validarRegistro({ nome: 'Teste', email: 'a@b.com', senha: '123' }), ErroRequisicao);
});

test('registro: perfil inválido lança erro', () => {
  assert.throws(() => validarRegistro({ nome: 'Teste', email: 'a@b.com', senha: '123456', perfil: 'SUPERADMIN' }), ErroRequisicao);
});

test('registro: dados válidos sem perfil não lança erro', () => {
  assert.doesNotThrow(() => validarRegistro({ nome: 'Teste', email: 'a@b.com', senha: '123456' }));
});

test('registro: perfil ADMINISTRADOR é aceito', () => {
  assert.doesNotThrow(() => validarRegistro({ nome: 'Teste', email: 'a@b.com', senha: '123456', perfil: 'ADMINISTRADOR' }));
});

test('login: email vazio lança erro', () => {
  assert.throws(() => validarLogin({ email: '', senha: '123456' }), ErroRequisicao);
});

test('login: senha vazia lança erro', () => {
  assert.throws(() => validarLogin({ email: 'a@b.com', senha: '' }), ErroRequisicao);
});

test('login: dados válidos não lança erro', () => {
  assert.doesNotThrow(() => validarLogin({ email: 'a@b.com', senha: '123456' }));
});

// ==================== Validações de Relatório CSV ====================

const eNumero = (v) => typeof v === 'number' && Number.isFinite(v);

function validarRanking(body) {
  const { ranking } = body ?? {};
  if (!Array.isArray(ranking) || ranking.length === 0) {
    throw new ErroRequisicao('"ranking" deve ser uma lista com ao menos 1 item.');
  }
  ranking.forEach((item, i) => {
    const n = i + 1;
    if (!item || !eNumero(item.posicao)) {
      throw new ErroRequisicao(`Item ${n} do ranking: "posicao" deve ser um número.`);
    }
    if (typeof item.alternativa !== 'string' || item.alternativa.trim() === '') {
      throw new ErroRequisicao(`Item ${n} do ranking: "alternativa" deve ser um texto.`);
    }
    for (const campo of ['ci', 'distanciaPositiva', 'distanciaNegativa']) {
      if (!eNumero(item[campo])) {
        throw new ErroRequisicao(`Item ${n} do ranking: "${campo}" deve ser um número.`);
      }
    }
  });
}

test('ranking: lista vazia lança erro', () => {
  assert.throws(() => validarRanking({ ranking: [] }), ErroRequisicao);
});

test('ranking: ci não numérico lança erro', () => {
  assert.throws(() => validarRanking({
    ranking: [{ posicao: 1, alternativa: 'A', ci: 'texto', distanciaPositiva: 0, distanciaNegativa: 0 }],
  }), ErroRequisicao);
});

test('ranking: dados válidos não lança erro', () => {
  assert.doesNotThrow(() => validarRanking({
    ranking: [{ posicao: 1, alternativa: 'Município A', ci: 0.75, distanciaPositiva: 0.1, distanciaNegativa: 0.3 }],
  }));
});

test('CSV gerado a partir de ranking válido tem formato correto', () => {
  const ranking = [
    { posicao: 1, alternativa: 'Município B', ci: 1, distanciaPositiva: 0, distanciaNegativa: 0.225 },
    { posicao: 2, alternativa: 'Município A', ci: 0.336, distanciaPositiva: 0.151, distanciaNegativa: 0.077 },
  ];
  const csv = gerarCsvRanking(ranking);
  assert.ok(csv.startsWith('\uFEFF'));
  const linhas = csv.trim().split('\r\n');
  assert.equal(linhas.length, 3);
  assert.ok(linhas[0].includes('Posição'));
  assert.ok(linhas[1].includes('Município B'));
});
