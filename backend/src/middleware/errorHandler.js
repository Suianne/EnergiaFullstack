const { TopsisInputError } = require('../services/topsis.service');

// Erro com status HTTP definido. Serviços lançam este erro para que o controller
// não precise conhecer os detalhes (ex.: 404 "não encontrado", 409 "já existe", 502 API externa).
class ErroHttp extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'ErroHttp';
    this.status = status;
  }
}

// Erro lançado quando o JSON da requisição tem formato errado.
class ErroRequisicao extends ErroHttp {
  constructor(message) {
    super(message, 400);
    this.name = 'ErroRequisicao';
  }
}

function rotaNaoEncontrada(req, res) {
  res.status(404).json({ erro: `Rota não encontrada: ${req.method} ${req.originalUrl}` });
}

function tratarErros(err, req, res, next) {
  if (err instanceof ErroHttp) {
    return res.status(err.status).json({ erro: err.message });
  }
  if (err instanceof TopsisInputError) {
    return res.status(400).json({ erro: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ erro: 'O corpo da requisição não é um JSON válido.' });
  }
  // Violação de unicidade do Prisma (ex.: município já cadastrado)
  if (err.code === 'P2002') {
    return res.status(409).json({ erro: 'Registro duplicado: já existe um item com esses dados.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ erro: 'Registro não encontrado.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
}

module.exports = { ErroHttp, ErroRequisicao, rotaNaoEncontrada, tratarErros };
