const { TopsisInputError } = require('../services/topsis.service');

// Erro lançado quando o JSON da requisição tem formato errado.
class ErroRequisicao extends Error {}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

function tratarErros(err, req, res, next) {
  if (err instanceof ErroRequisicao || err instanceof TopsisInputError) {
    return res.status(400).json({ erro: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
}

module.exports = { ErroRequisicao, rotaNaoEncontrada, tratarErros };