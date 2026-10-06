const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { autenticar, autorizar, JWT_SECRET } = require('../src/middleware/auth');

// Helpers para simular req, res, next do Express
function mockRes() {
  const res = { statusCode: null, body: null };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => { res.body = obj; return res; };
  return res;
}

function tokenValido(perfil = 'PESQUISADOR') {
  return jwt.sign({ id: 1, nome: 'Teste', email: 'teste@email.com', perfil }, JWT_SECRET, { expiresIn: '1h' });
}

// ==================== autenticar ====================

test('autenticar: sem header Authorization retorna 401', () => {
  const req = { headers: {} };
  const res = mockRes();
  autenticar(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.match(res.body.erro, /Token não fornecido/);
});

test('autenticar: header sem "Bearer " retorna 401', () => {
  const req = { headers: { authorization: 'Token abc123' } };
  const res = mockRes();
  autenticar(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.match(res.body.erro, /Token não fornecido/);
});

test('autenticar: token inválido retorna 401', () => {
  const req = { headers: { authorization: 'Bearer token.invalido.aqui' } };
  const res = mockRes();
  autenticar(req, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.match(res.body.erro, /inválido ou expirado/);
});

test('autenticar: token expirado retorna 401', () => {
  const token = jwt.sign({ id: 1, perfil: 'PESQUISADOR' }, JWT_SECRET, { expiresIn: '-1s' });
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();
  autenticar(req, res, () => {});
  assert.equal(res.statusCode, 401);
});

test('autenticar: token válido coloca dados em req.usuario e chama next', () => {
  const token = tokenValido('ADMINISTRADOR');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();
  let nextChamado = false;
  autenticar(req, res, () => { nextChamado = true; });
  assert.ok(nextChamado);
  assert.equal(req.usuario.perfil, 'ADMINISTRADOR');
  assert.equal(req.usuario.email, 'teste@email.com');
});

// ==================== autorizar ====================

test('autorizar: perfil permitido chama next', () => {
  const middleware = autorizar('ADMINISTRADOR', 'PESQUISADOR');
  const req = { usuario: { perfil: 'PESQUISADOR' } };
  const res = mockRes();
  let nextChamado = false;
  middleware(req, res, () => { nextChamado = true; });
  assert.ok(nextChamado);
});

test('autorizar: perfil não permitido retorna 403', () => {
  const middleware = autorizar('ADMINISTRADOR');
  const req = { usuario: { perfil: 'GESTOR' } };
  const res = mockRes();
  middleware(req, res, () => {});
  assert.equal(res.statusCode, 403);
  assert.match(res.body.erro, /Acesso negado/);
});

test('autorizar: sem usuário retorna 403', () => {
  const middleware = autorizar('ADMINISTRADOR');
  const req = {};
  const res = mockRes();
  middleware(req, res, () => {});
  assert.equal(res.statusCode, 403);
});

// ==================== combinação autenticar + autorizar ====================

test('fluxo completo: token GESTOR não pode acessar rota de ADMINISTRADOR', () => {
  const token = tokenValido('GESTOR');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();

  // Passo 1: autenticar
  let autenticado = false;
  autenticar(req, res, () => { autenticado = true; });
  assert.ok(autenticado);

  // Passo 2: autorizar só ADMINISTRADOR
  const middleware = autorizar('ADMINISTRADOR');
  middleware(req, res, () => {});
  assert.equal(res.statusCode, 403);
});

test('fluxo completo: token ADMINISTRADOR passa por autenticar + autorizar', () => {
  const token = tokenValido('ADMINISTRADOR');
  const req = { headers: { authorization: `Bearer ${token}` } };
  const res = mockRes();

  let autenticado = false;
  autenticar(req, res, () => { autenticado = true; });
  assert.ok(autenticado);

  const middleware = autorizar('ADMINISTRADOR');
  let autorizado = false;
  middleware(req, res, () => { autorizado = true; });
  assert.ok(autorizado);
});
