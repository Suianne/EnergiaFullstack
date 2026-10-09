const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { instalarFakePrisma } = require('./helpers/fakePrisma');
const prisma = instalarFakePrisma();
const app = require('../src/app');
const { JWT_SECRET } = require('../src/middleware/auth');

let server;
let base;
test.before(() => new Promise((ok) => { server = app.listen(0, () => { base = `http://localhost:${server.address().port}`; ok(); }); }));
test.after(() => server.close());
test.beforeEach(() => { prisma._db.usuarios = []; });

const chamar = (rota, { metodo = 'POST', corpo, token } = {}) =>
  fetch(`${base}${rota}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
const tokenDe = (u) => jwt.sign({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil }, JWT_SECRET);
const registrar = (n, extra = {}) => chamar('/api/auth/registrar', { corpo: { nome: n, email: `${n}@x.com`, senha: '123456', ...extra } });

test('o primeiro cadastro vira ADMINISTRADOR e os seguintes viram GESTOR', async () => {
  const a = await (await registrar('ana')).json();
  const b = await (await registrar('bia')).json();
  assert.equal(a.usuario.perfil, 'ADMINISTRADOR');
  assert.equal(b.usuario.perfil, 'GESTOR');
});

test('cadastro permite escolher Pesquisador ou Gestor; sem perfil vira Gestor', async () => {
  await registrar('ana');
  assert.equal((await (await registrar('pes', { perfil: 'PESQUISADOR' })).json()).usuario.perfil, 'PESQUISADOR');
  assert.equal((await (await registrar('ges', { perfil: 'GESTOR' })).json()).usuario.perfil, 'GESTOR');
  assert.equal((await (await registrar('sem')).json()).usuario.perfil, 'GESTOR');
});

test('Administrador no cadastro exige o código secreto (sem escalonamento de privilégio)', async () => {
  await registrar('ana');
  process.env.CODIGO_ADMIN = 'segredo-123';
  try {
    assert.equal((await registrar('a1', { perfil: 'ADMINISTRADOR' })).status, 403);
    assert.equal((await registrar('a2', { perfil: 'ADMINISTRADOR', codigoAdmin: 'errado' })).status, 403);
    const ok = await registrar('a3', { perfil: 'ADMINISTRADOR', codigoAdmin: 'segredo-123' });
    assert.equal(ok.status, 201);
    assert.equal((await ok.json()).usuario.perfil, 'ADMINISTRADOR');
  } finally {
    delete process.env.CODIGO_ADMIN;
  }
  // sem CODIGO_ADMIN configurado, nem o código "certo" vazio passa
  assert.equal((await registrar('a4', { perfil: 'ADMINISTRADOR', codigoAdmin: '' })).status, 403);
  assert.equal((await registrar('a5', { perfil: 'ROOT' })).status, 400);
});

test('o primeiro cadastro é Administrador mesmo escolhendo outro ator', async () => {
  assert.equal((await (await registrar('ana', { perfil: 'GESTOR' })).json()).usuario.perfil, 'ADMINISTRADOR');
});

test('GET /api/auth/registro-info informa se é o primeiro usuário', async () => {
  const antes = await (await chamar('/api/auth/registro-info', { metodo: 'GET' })).json();
  assert.equal(antes.primeiroUsuario, true);
  await registrar('ana');
  assert.equal((await (await chamar('/api/auth/registro-info', { metodo: 'GET' })).json()).primeiroUsuario, false);
});

test('e-mail repetido dá 409; senha curta dá 400', async () => {
  await registrar('ana');
  assert.equal((await registrar('ana')).status, 409);
  assert.equal((await registrar('c', { senha: '1' })).status, 400);
});

test('gestão de usuários: só ADMINISTRADOR; sem token 401', async () => {
  await registrar('ana');
  const gestor = (await (await registrar('bia')).json()).usuario;
  assert.equal((await chamar('/api/usuarios', { metodo: 'GET' })).status, 401);
  assert.equal((await chamar('/api/usuarios', { metodo: 'GET', token: tokenDe(gestor) })).status, 403);
});

test('administrador promove usuário, mas não rebaixa nem exclui o último administrador', async () => {
  const admin = (await (await registrar('ana')).json()).usuario;
  const gestor = (await (await registrar('bia')).json()).usuario;
  const t = tokenDe(admin);

  const ok = await chamar(`/api/usuarios/${gestor.id}/perfil`, { metodo: 'PATCH', corpo: { perfil: 'PESQUISADOR' }, token: t });
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).perfil, 'PESQUISADOR');

  assert.equal((await chamar(`/api/usuarios/${admin.id}/perfil`, { metodo: 'PATCH', corpo: { perfil: 'GESTOR' }, token: t })).status, 409);
  assert.equal((await chamar(`/api/usuarios/${admin.id}`, { metodo: 'DELETE', token: t })).status, 409);
  assert.equal((await chamar(`/api/usuarios/${gestor.id}/perfil`, { metodo: 'PATCH', corpo: { perfil: 'ROOT' }, token: t })).status, 400);
  assert.equal((await chamar(`/api/usuarios/${gestor.id}`, { metodo: 'DELETE', token: t })).status, 204);
  assert.equal((await chamar('/api/usuarios/999', { metodo: 'DELETE', token: t })).status, 404);
});

test('POST /api/relatorios/pdf devolve um PDF para qualquer usuário logado', async () => {
  await registrar('ana');
  const gestor = (await (await registrar('bia')).json()).usuario;
  const corpo = {
    ranking: [
      { posicao: 1, municipio: 'Camaçari', uf: 'BA', ci: 0.91, semGeracao: true },
      { posicao: 2, municipio: 'Salvador', uf: 'BA', ci: 0.2, semGeracao: false },
    ],
    criterios: [{ nome: 'População', tipo: 'beneficio', peso: 1 }],
  };
  const res = await chamar('/api/relatorios/pdf', { corpo, token: tokenDe(gestor) });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/pdf/);
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(buf.subarray(0, 5).toString(), '%PDF-');

  assert.equal((await chamar('/api/relatorios/pdf', { corpo })).status, 401);
  assert.equal((await chamar('/api/relatorios/pdf', { corpo: { ranking: [] }, token: tokenDe(gestor) })).status, 400);
  assert.equal((await chamar('/api/relatorios/pdf', { corpo: { ranking: [{ posicao: 1, municipio: '', ci: 1 }] }, token: tokenDe(gestor) })).status, 400);
});