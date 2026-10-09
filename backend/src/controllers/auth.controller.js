const authService = require('../services/auth.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

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
  if (perfil !== undefined && !PERFIS_VALIDOS.includes(perfil)) {
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

async function registrar(req, res, next) {
  try {
    validarRegistro(req.body);

    const resultado = await authService.registrar({
      nome: req.body.nome.trim(),
      email: req.body.email.trim().toLowerCase(),
      senha: req.body.senha,
      perfil: req.body.perfil,
      codigoAdmin: req.body.codigoAdmin,
    });

    if (resultado.erro) {
      return res.status(409).json({ erro: resultado.erro });
    }

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

    if (resultado.erro) {
      return res.status(401).json({ erro: resultado.erro });
    }

    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function infoRegistro(req, res, next) {
  try {
    res.json(await authService.infoRegistro());
  } catch (err) {
    next(err);
  }
}

module.exports = { registrar, login, infoRegistro };