const service = require('../services/importacao.service');

const LIMITE_PADRAO = 10;
const LIMITE_MAXIMO = 50;

function limiteDaQuery(req) {
  const n = Number(req.query.limite);
  if (!Number.isFinite(n) || n <= 0) return LIMITE_PADRAO;
  return Math.min(Math.floor(n), LIMITE_MAXIMO);
}

// Lista de municípios da UF direto do IBGE (para o seletor da tela de cadastro)
async function listarMunicipiosIBGE(req, res, next) {
  try {
    const uf = service.validarUF(req.params.uf);
    res.json(await service.buscarMunicipiosIBGE(uf));
  } catch (err) {
    next(err);
  }
}

// Resumo da geração renovável da UF (ANEEL/SIGA), agregado por município
async function resumoAneel(req, res, next) {
  try {
    const uf = service.validarUF(req.params.uf);
    const forcar = ['1', 'true'].includes(String(req.query.forcar || ''));
    const dados = await service.buscarDadosANEEL(uf, { forcar });
    const municipios = Object.values(dados.porMunicipio).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    res.json({
      uf: dados.uf,
      usinasRenovaveis: dados.usinasRenovaveis,
      municipiosComGeracao: municipios.length,
      registrosConsultados: dados.registrosConsultados,
      consultadoEm: dados.consultadoEm,
      municipios,
    });
  } catch (err) {
    next(err);
  }
}

// Importa (incrementalmente) os municípios da UF já com dados IBGE + ANEEL
async function importarPorUF(req, res, next) {
  try {
    const uf = service.validarUF(req.params.uf);
    const resultado = await service.importarMunicipiosUF(uf, limiteDaQuery(req));
    const mensagem = resultado.completo
      ? `Importação de ${uf} concluída: ${resultado.importados} importado(s) nesta etapa, ${resultado.jaExistiam} já existiam.`
      : `Importados ${resultado.importados} município(s) de ${uf}. Restam ${resultado.restantes}.`;
    res.json({ mensagem, ...resultado });
  } catch (err) {
    next(err);
  }
}

// Reprocessa municípios da UF que estão sem dados (ANEEL não consultada ou critério sem valor)
async function atualizarDadosPorUF(req, res, next) {
  try {
    const uf = service.validarUF(req.params.uf);
    const resultado = await service.atualizarDadosUF(uf, limiteDaQuery(req));
    const mensagem = resultado.completo
      ? `Dados de ${uf} completos: ${resultado.atualizados} atualizado(s) nesta etapa.`
      : `Atualizados ${resultado.atualizados} município(s) de ${uf}. Restam ${resultado.restantes}.`;
    res.json({ mensagem, ...resultado });
  } catch (err) {
    next(err);
  }
}

module.exports = { listarMunicipiosIBGE, resumoAneel, importarPorUF, atualizarDadosPorUF };
