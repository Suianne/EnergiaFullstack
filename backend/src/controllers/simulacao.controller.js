const service = require('../services/simulacao.service');

async function listar(req, res, next) {
  try {
    const simulacoes = await service.listar();
    res.json(simulacoes);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const id = Number(req.params.id);
    const simulacao = await service.buscarPorId(id);

    if (!simulacao) {
      return res.status(404).json({ erro: 'Simulação não encontrada.' });
    }
    res.json(simulacao);
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, buscarPorId };
