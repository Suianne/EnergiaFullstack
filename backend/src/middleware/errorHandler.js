const { TopsisInputError } = require('../services/topsis.service');

// Erro lançado quando o JSON da requisição tem formato errado.
class ErroRequisicao extends Error {}

// Conflito com o que já existe no banco (ex.: município ou e-mail repetido).
class ErroConflito extends Error {}

// Ação proibida para quem está tentando (ex.: código de administrador errado).
class ErroAcessoNegado extends Error {}

// IBGE ou ANEEL fora do ar / com resposta inesperada. Nada é gravado quando isso acontece.
class ErroServicoExterno extends Error {}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

function tratarErros(err, req, res, next) {
  if (err instanceof ErroRequisicao || err instanceof TopsisInputError) {
    return res.status(400).json({ erro: err.message });
  }
  if (err instanceof ErroAcessoNegado) {
    return res.status(403).json({ erro: err.message });
  }
  if (err instanceof ErroConflito) {
    return res.status(409).json({ erro: err.message });
  }
  if (err instanceof ErroServicoExterno) {
    return res.status(502).json({ erro: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
}

module.exports = { ErroRequisicao, ErroConflito, ErroAcessoNegado, ErroServicoExterno, rotaNaoEncontrada, tratarErros };