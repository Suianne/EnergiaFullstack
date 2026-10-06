const { gerarCsvRanking } = require('../services/relatorio.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

const eNumero = (v) => typeof v === 'number' && Number.isFinite(v);

// O corpo esperado é exatamente o que POST /api/topsis/executar devolve: { ranking: [...] }
function validarRanking(body) {
  const { ranking } = body ?? {};

  if (!Array.isArray(ranking) || ranking.length === 0) {
    throw new ErroRequisicao('"ranking" deve ser uma lista com ao menos 1 item.');
  }
  ranking.forEach((item, i) => {
    const n = i + 1;
    if (!item || !eNumero(item.posicao)) {
      throw new ErroRequisicao(`Item ${n} do ranking: "posicao" deve ser um número.`);
    }
    if (typeof item.alternativa !== 'string' || item.alternativa.trim() === '') {
      throw new ErroRequisicao(`Item ${n} do ranking: "alternativa" deve ser um texto.`);
    }
    for (const campo of ['ci', 'distanciaPositiva', 'distanciaNegativa']) {
      if (!eNumero(item[campo])) {
        throw new ErroRequisicao(`Item ${n} do ranking: "${campo}" deve ser um número.`);
      }
    }
  });
  return ranking;
}

function gerarCsv(req, res) {
  const ranking = validarRanking(req.body);
  const csv = gerarCsvRanking(ranking);

  // Estes dois cabeçalhos fazem o navegador tratar a resposta como um arquivo para baixar.
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="ranking-topsis.csv"');
  res.send(csv);
}

module.exports = { gerarCsv };