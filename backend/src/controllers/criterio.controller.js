const service = require('../services/criterio.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

const TIPOS_VALIDOS = ['beneficio', 'custo'];

function validarCampos(body) {
  const { nome, tipo } = body ?? {};

  if (!nome || typeof nome !== 'string' || nome.trim() === '') {
    throw new ErroRequisicao('"nome" é obrigatório.');
  }
  if (tipo && !TIPOS_VALIDOS.includes(tipo)) {
    throw new ErroRequisicao('"tipo" deve ser "beneficio" ou "custo".');
  }
}

async function listar(req, res, next) {
  try {
    const criterios = await service.listar();
    res.json(criterios);
  } catch (err) {
    next(err);
  }
}

async function buscarPorId(req, res, next) {
  try {
    const id = Number(req.params.id);
    const criterio = await service.buscarPorId(id);

    if (!criterio) {
      return res.status(404).json({ erro: 'Critério não encontrado.' });
    }
    res.json(criterio);
  } catch (err) {
    next(err);
  }
}

async function criar(req, res, next) {
  try {
    validarCampos(req.body);

    const criterio = await service.criar({
      nome: req.body.nome.trim(),
      descricao: req.body.descricao ?? null,
      tipo: req.body.tipo ?? null,
      peso: req.body.peso ?? 0.0,
      unidade: req.body.unidade ?? null,
    });

    res.status(201).json(criterio);
  } catch (err) {
    next(err);
  }
}

async function atualizar(req, res, next) {
  try {
    validarCampos(req.body);

    const id = Number(req.params.id);
    const criterio = await service.atualizar(id, {
      nome: req.body.nome.trim(),
      descricao: req.body.descricao ?? null,
      tipo: req.body.tipo ?? null,
      peso: req.body.peso ?? 0.0,
      unidade: req.body.unidade ?? null,
    });

    res.json(criterio);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ erro: 'Critério não encontrado.' });
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
      return res.status(404).json({ erro: 'Critério não encontrado.' });
    }
    next(err);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
