const { gerarCsvRanking, gerarPdfRanking, gerarPdfRankingMunicipios } = require('../services/relatorio.service');
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

const MAX_ITENS_PDF = 10000;
const MAX_TEXTO = 200;

// Corpo esperado: { ranking: [{ posicao, municipio, uf, ci, semGeracao }], criterios: [{ nome, tipo, peso }] }
function validarRankingMunicipios(body) {
  const { ranking, criterios = [] } = body ?? {};

  if (!Array.isArray(ranking) || ranking.length === 0) {
    throw new ErroRequisicao('"ranking" deve ser uma lista com ao menos 1 item.');
  }
  if (ranking.length > MAX_ITENS_PDF) {
    throw new ErroRequisicao(`"ranking" aceita no máximo ${MAX_ITENS_PDF} itens.`);
  }
  if (!Array.isArray(criterios) || criterios.length > 50) {
    throw new ErroRequisicao('"criterios" deve ser uma lista de até 50 itens.');
  }

  const texto = (valor, campo, n) => {
    if (typeof valor !== 'string' || valor.trim() === '') {
      throw new ErroRequisicao(`Item ${n} do ranking: "${campo}" deve ser um texto.`);
    }
    return valor.trim().slice(0, MAX_TEXTO);
  };

  return {
    ranking: ranking.map((item, i) => {
      const n = i + 1;
      if (!item || !eNumero(item.posicao)) {
        throw new ErroRequisicao(`Item ${n} do ranking: "posicao" deve ser um número.`);
      }
      if (!eNumero(item.ci)) {
        throw new ErroRequisicao(`Item ${n} do ranking: "ci" deve ser um número.`);
      }
      return {
        posicao: item.posicao,
        municipio: texto(item.municipio, 'municipio', n),
        uf: typeof item.uf === 'string' ? item.uf.trim().slice(0, 2).toUpperCase() : '',
        ci: item.ci,
        semGeracao: item.semGeracao === true,
      };
    }),
    criterios: criterios.map((c, i) => {
      if (!c || typeof c.nome !== 'string' || !eNumero(c.peso)) {
        throw new ErroRequisicao(`Critério ${i + 1}: informe "nome" (texto) e "peso" (número).`);
      }
      return { nome: c.nome.trim().slice(0, MAX_TEXTO), tipo: c.tipo === 'custo' ? 'custo' : 'beneficio', peso: c.peso };
    }),
  };
}

function gerarPdfMunicipios(req, res, next) {
  try {
    const { ranking, criterios } = validarRankingMunicipios(req.body);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="ranking-municipios.pdf"');

    gerarPdfRankingMunicipios(ranking, criterios, { geradoPor: req.usuario?.nome }).pipe(res);
  } catch (err) {
    next(err);
  }
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

module.exports = { gerarCsv, gerarPdf, gerarPdfMunicipios, validarRankingMunicipios };