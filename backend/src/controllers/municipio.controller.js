const service = require('../services/municipio.service');
const importacaoService = require('../services/importacao.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

function validarCampos(body) {
  const { nome, uf } = body ?? {};

  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroRequisicao('"nome" é obrigatório.');
  }
  if (!uf || typeof uf !== 'string' || uf.length !== 2) {
    throw new ErroRequisicao('"uf" deve ter exatamente 2 caracteres.');
  }
}

async function listar(req, res, next) {
  try {
    const municipios = await service.listar();
    res.json(municipios);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const id = Number(req.params.id);
    const municipio = await service.buscarPorId(id);

    if (!municipio) {
      return res.status(404).json({ erro: 'Município não encontrado.' });
    }
    res.json(municipio);
  } catch (err) {
    next(err);
  }
}

// Cadastro de município: o IBGE confirma código, nome e UF, e os dados do IBGE/ANEEL
// são buscados na mesma operação. Se alguma fonte falhar, nada é gravado.
async function criar(req, res, next) {
  try {
    const codigoIbge = String(req.body?.codigoIbge ?? '').trim();
    if (!/^\d{7}$/.test(codigoIbge)) {
      throw new ErroRequisicao('"codigoIbge" é obrigatório e deve ter 7 dígitos.');
    }

    const resultado = await importacaoService.cadastrarMunicipio(codigoIbge);
    res.status(201).json(resultado);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    validarCampos(req.body);

    const id = Number(req.params.id);
    const municipio = await service.atualizar(id, {
      nome: req.body.nome.trim(),
      uf: req.body.uf.toUpperCase(),
      codigoIbge: req.body.codigoIbge || undefined,
      populacao: req.body.populacao ?? null,
      idh: req.body.idh ?? null,
      latitude: req.body.latitude ?? null,
      longitude: req.body.longitude ?? null,
    });

    res.json(municipio);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Município não encontrado.' });
    }
    next(err);
  }
}

async function remover(req, res, next) {
  try {
    const id = Number(req.params.id);
    await service.remover(id);
    res.status(204).end();
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Município não encontrado.' });
    }
    next(err);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
