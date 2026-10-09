const test = require('node:test');
const assert = require('node:assert/strict');
const { instalarPrismaStub, criarStubUsuarios } = require('./helpers/prismaStub');

// Banco em memória: começa vazio para testar o bootstrap do primeiro administrador.
const stub = instalarPrismaStub(criarStubUsuarios([]));

const authService = require('../src/services/auth.service');
const usuarioService = require('../src/services/usuario.service');
const { ErroHttp } = require('../src/middleware/errorHandler');

const erroHttp = (status) => (e) => e instanceof ErroHttp && e.status === status;

test('o primeiro usuário cadastrado vira ADMINISTRADOR mesmo pedindo outro perfil', async () => {
  const r = await authService.registrar({ nome: 'Primeira', email: 'primeira@email.com', senha: '123456', perfil: 'GESTOR' });
  assert.equal(r.usuario.perfil, 'ADMINISTRADOR');
  assert.equal(r.primeiroUsuario, true);
  assert.ok(r.token);
});

test('cadastro público aceita GESTOR/PESQUISADOR (padrão GESTOR) e recusa ADMINISTRADOR', async () => {
  const gestor = await authService.registrar({ nome: 'G', email: 'g@email.com', senha: '123456' });
  assert.equal(gestor.usuario.perfil, 'GESTOR');
  assert.equal(gestor.primeiroUsuario, false);

  const pesq = await authService.registrar({ nome: 'P', email: 'p@email.com', senha: '123456', perfil: 'PESQUISADOR' });
  assert.equal(pesq.usuario.perfil, 'PESQUISADOR');

  await assert.rejects(
    authService.registrar({ nome: 'X', email: 'x@email.com', senha: '123456', perfil: 'ADMINISTRADOR' }),
    erroHttp(403),
  );
});

test('email duplicado dá 409', async () => {
  await assert.rejects(
    authService.registrar({ nome: 'G2', email: 'g@email.com', senha: '123456' }),
    erroHttp(409),
  );
});

test('login confere a senha e devolve token', async () => {
  const ok = await authService.login({ email: 'g@email.com', senha: '123456' });
  assert.ok(ok.token);
  assert.equal(ok.usuario.email, 'g@email.com');
  await assert.rejects(authService.login({ email: 'g@email.com', senha: 'errada' }), erroHttp(401));
  await assert.rejects(authService.login({ email: 'ninguem@email.com', senha: '123456' }), erroHttp(401));
});

test('administrador pode criar outro ADMINISTRADOR', async () => {
  const u = await usuarioService.criar({ nome: 'Admin 2', email: 'admin2@email.com', senha: '123456', perfil: 'ADMINISTRADOR' });
  assert.equal(u.perfil, 'ADMINISTRADOR');
  assert.equal(u.senha, undefined, 'senha não pode vazar');
});

test('alterar perfil: válido funciona; perfil inválido dá 400', async () => {
  const gestor = stub.usuarios.find((u) => u.email === 'g@email.com');
  const r = await usuarioService.atualizarPerfil(gestor.id, 'PESQUISADOR', { solicitanteId: 1 });
  assert.equal(r.perfil, 'PESQUISADOR');
  await assert.rejects(usuarioService.atualizarPerfil(gestor.id, 'SUPER', { solicitanteId: 1 }), erroHttp(400));
  await assert.rejects(usuarioService.atualizarPerfil(999, 'GESTOR', { solicitanteId: 1 }), erroHttp(404));
});

test('administrador não pode rebaixar a si mesmo nem excluir a própria conta', async () => {
  await assert.rejects(usuarioService.atualizarPerfil(1, 'GESTOR', { solicitanteId: 1 }), erroHttp(400));
  await assert.rejects(usuarioService.remover(1, { solicitanteId: 1 }), erroHttp(400));
});

test('o sistema nunca fica sem administrador', async () => {
  const admin2 = stub.usuarios.find((u) => u.email === 'admin2@email.com');

  // Há 2 admins: rebaixar o segundo é permitido
  const r = await usuarioService.atualizarPerfil(admin2.id, 'GESTOR', { solicitanteId: 1 });
  assert.equal(r.perfil, 'GESTOR');

  // Agora só resta o admin 1: outro admin (hipotético, id 50) não pode rebaixá-lo nem excluí-lo
  await assert.rejects(usuarioService.atualizarPerfil(1, 'GESTOR', { solicitanteId: 50 }), erroHttp(400));
  await assert.rejects(usuarioService.remover(1, { solicitanteId: 50 }), erroHttp(400));

  // Excluir um não-admin funciona
  await usuarioService.remover(admin2.id, { solicitanteId: 1 });
  assert.equal(stub.usuarios.find((u) => u.id === admin2.id), undefined);
});

test('listar não expõe a senha', async () => {
  const lista = await usuarioService.listar();
  assert.ok(lista.length >= 2);
  for (const u of lista) assert.equal(u.senha, undefined);
});
