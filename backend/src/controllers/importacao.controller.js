const service = require('../services/importacao.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

async function listarMunicipiosIBGE(req, res, next) {
  try {
    const { uf } = req.params;

    if (!uf || uf.length !== 2) {
      throw new ErroRequisicao('"uf" deve ter exatamente 2 caracteres.');
    }

    const municipios = await service.buscarMunicipiosIBGE(uf.toUpperCase());
    res.json(municipios);
  } catch (err) {
    next(err);
  }
}

async function importarPorUF(req, res, next) {
  try {
    const { uf } = req.params;

    if (!uf || uf.length !== 2) {
      throw new ErroRequisicao('"uf" deve ter exatamente 2 caracteres.');
    }

    const resultado = await service.importarMunicipiosUF(uf.toUpperCase());
    res.json({
      mensagem: `Importação concluída para ${uf.toUpperCase()}.`,
      ...resultado,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { listarMunicipiosIBGE, importarPorUF };
