// Gestão de usuários e níveis de acesso — somente ADMINISTRADOR.
const service = require('../services/usuario.service');
const { PERFIS } = require('../services/auth.service');
const { validarRegistro, dadosDeRegistro } = require('./auth.controller');
const { ErroRequisicao } = require('../middleware/errorHandler');

function idDaRota(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new ErroRequisicao('"id" inválido.');
  return id;
}

async function listar(req, res, next) {
  try {
    res.json(await service.listar());
  } catch (err) {
    next(err);
  }
}

// Administrador cria usuário com qualquer perfil (inclusive outro ADMINISTRADOR)
async function criar(req, res, next) {
  try {
    validarRegistro(req.body);
    const usuario = await service.criar(dadosDeRegistro(req.body));
    res.status(201).json(usuario);
  } catch (err) {
    next(err);
  }
}

async function atualizarPerfil(req, res, next) {
  try {
    const { perfil } = req.body ?? {};
    if (!perfil || !PERFIS.includes(perfil)) {
      throw new ErroRequisicao(`"perfil" deve ser: ${PERFIS.join(', ')}.`);
    }
    const usuario = await service.atualizarPerfil(idDaRota(req), perfil, { solicitanteId: req.usuario.id });
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await service.remover(idDaRota(req), { solicitanteId: req.usuario.id });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, criar, atualizarPerfil, remover };
