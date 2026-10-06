const { gerarCsvRanking, gerarPdfRanking } = require('../services/relatorio.service');
const simulacaoService = require('../services/simulacao.service');
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

async function gerarPdf(req, res, next) {
  try {
    const id = Number(req.params.id);
    const simulacao = await simulacaoService.buscarPorId(id);

    if (!simulacao) {
      return res.status(404).json({ erro: 'Simulação não encontrada.' });
    }

    const ranking = simulacao.resultadosRanking.map((r) => ({
      posicao: r.posicao,
      alternativa: r.municipio?.nome || `Alternativa ${r.posicao}`,
      ci: Number(r.coeficienteCi),
      distanciaPositiva: Number(r.distanciaPositiva),
      distanciaNegativa: Number(r.distanciaNegativa),
    }));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-topsis-${id}.pdf"`);

    const doc = gerarPdfRanking(ranking, simulacao.parametros);
    doc.pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { gerarCsv, gerarPdf };