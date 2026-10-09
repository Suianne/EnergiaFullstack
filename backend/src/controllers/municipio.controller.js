const service = require('../services/municipio.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

const eNumero = (v) => typeof v === 'number' && Number.isFinite(v);

function validarCodigoIbge(body) {
  // aceita "codigoIbge" (padrão) ou "ibge" (compatibilidade com o formulário antigo)
  const codigo = String(body?.codigoIbge ?? body?.ibge ?? '').trim();
  if (!/^\d{7}$/.test(codigo)) {
    throw new ErroRequisicao('"codigoIbge" é obrigatório e deve ter 7 dígitos.');
  }
  return codigo;
}

// Edição manual: só campos que as APIs não cobrem ou que precisem de correção.
function validarEdicao(body) {
  const dados = {};
  const b = body ?? {};

  if (b.nome !== undefined) {
    if (typeof b.nome !== 'string' || b.nome.trim() === '') throw new ErroRequisicao('"nome" inválido.');
    dados.nome = b.nome.trim();
  }
  for (const campo of ['latitude', 'longitude', 'idh']) {
    if (b[campo] !== undefined) {
      if (b[campo] !== null && !eNumero(b[campo])) throw new ErroRequisicao(`"${campo}" deve ser um número.`);
      dados[campo] = b[campo];
    }
  }
  if (b.populacao !== undefined) {
    if (b.populacao !== null && (!Number.isInteger(b.populacao) || b.populacao < 0)) {
      throw new ErroRequisicao('"populacao" deve ser um inteiro >= 0.');
    }
    dados.populacao = b.populacao;
  }
  if (eNumero(dados.latitude) && (dados.latitude < -90 || dados.latitude > 90)) {
    throw new ErroRequisicao('"latitude" deve estar entre -90 e 90.');
  }
  if (eNumero(dados.longitude) && (dados.longitude < -180 || dados.longitude > 180)) {
    throw new ErroRequisicao('"longitude" deve estar entre -180 e 180.');
  }
  if (Object.keys(dados).length === 0) {
    throw new ErroRequisicao('Informe ao menos um campo: nome, populacao, idh, latitude ou longitude.');
  }
  return dados;
}

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

async function buscarPorId(req, res, next) {
  try {
    const municipio = await service.buscarPorId(idDaRota(req));
    if (!municipio) return res.status(404).json({ erro: 'Município não encontrado.' });
    res.json(municipio);
  } catch (err) {
    next(err);
  }
}

// Cadastro pelo código IBGE: nome, UF, população, PIB, geração renovável (ANEEL)
// e coordenadas são buscados automaticamente.
async function criar(req, res, next) {
  try {
    const codigoIbge = validarCodigoIbge(req.body);
    const resultado = await service.criar({ codigoIbge });
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    const dados = validarEdicao(req.body);
    const municipio = await service.atualizar(idDaRota(req), dados);
    res.json(municipio);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Município não encontrado.' });
    next(err);
  }
}

// Reconsulta IBGE + ANEEL para o município
async function atualizarDados(req, res, next) {
  try {
    const forcarAneel = ['1', 'true'].includes(String(req.query.forcarAneel || ''));
    const resultado = await service.atualizarDados(idDaRota(req), { forcarAneel });
    res.json(resultado);
  } catch (err) {
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    await service.remover(idDaRota(req));
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ erro: 'Município não encontrado.' });
    next(err);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, atualizarDados, remover, validarEdicao, validarCodigoIbge };
