const service = require('../services/admin.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

const PALAVRA_CONFIRMACAO = 'RESETAR';

// Apaga municípios, critérios, matriz e simulações (usuários preservados).
// Exige confirmação explícita no corpo para evitar cliques acidentais.
async function resetarDados(req, res, next) {
  try {
    if (req.body?.confirmacao !== PALAVRA_CONFIRMACAO) {
      throw new ErroRequisicao(`Para resetar os dados envie { "confirmacao": "${PALAVRA_CONFIRMACAO}" }.`);
    }
    const resultado = await service.resetarDados();
    res.json({
      mensagem: 'Dados apagados. Municípios, critérios, matriz de decisão e simulações foram zerados; usuários mantidos.',
      ...resultado,
    });
  } catch (err) {
    next(err);
  }
}

async function estatisticas(req, res, next) {
  try {
    res.json(await service.estatisticas());
  } catch (err) {
    next(err);
  }
}

module.exports = { resetarDados, estatisticas, PALAVRA_CONFIRMACAO };
