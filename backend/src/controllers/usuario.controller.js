const service = require('../services/usuario.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

function lerId(req) {
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

async function alterarPerfil(req, res, next) {
  try {
    const id = lerId(req);
    const { perfil } = req.body ?? {};
    if (!service.PERFIS.includes(perfil)) {
      throw new ErroRequisicao(`"perfil" deve ser: ${service.PERFIS.join(', ')}.`);
    }
    const usuario = await service.alterarPerfil(id, perfil);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json(usuario);
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    const removido = await service.remover(lerId(req), req.usuario.id);
    if (!removido) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, alterarPerfil, remover };
