const authService = require('../services/auth.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

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
  if (perfil && !authService.PERFIS.includes(perfil)) {
    throw new ErroRequisicao(`"perfil" deve ser: ${authService.PERFIS.join(', ')}.`);
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

function dadosDeRegistro(body) {
  return {
    nome: body.nome.trim(),
    email: body.email.trim().toLowerCase(),
    senha: body.senha,
    perfil: body.perfil || undefined,
  };
}

// Cadastro público (tela "Criar conta"). Perfis permitidos: GESTOR ou PESQUISADOR.
// O primeiro usuário do sistema vira ADMINISTRADOR automaticamente.
async function registrar(req, res, next) {
  try {
    validarRegistro(req.body);
    const resultado = await authService.registrar(dadosDeRegistro(req.body));
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    validarLogin(req.body);
    const resultado = await authService.login({
      email: req.body.email.trim().toLowerCase(),
      senha: req.body.senha,
    });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

// Usuário logado (com token renovado, caso o perfil tenha mudado)
async function me(req, res, next) {
  try {
    res.json(await authService.usuarioAtual(req.usuario.id));
  } catch (err) {
    next(err);
  }
}

module.exports = { registrar, login, me, validarRegistro, dadosDeRegistro };
