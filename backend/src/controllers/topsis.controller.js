const { topsis } = require('../services/topsis.service');
const simulacaoService = require('../services/simulacao.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

// Confere só o FORMATO do JSON. As regras numéricas (pesos somando 1, tipos válidos...)
// ficam por conta do próprio motor, que já valida e lança TopsisInputError.
function validarCorpo(body) {
  const { alternativas, criterios, matriz } = body ?? {};

  if (!Array.isArray(alternativas) || alternativas.some((a) => typeof a !== 'string' || a.trim() === '')) {
    throw new ErroRequisicao('"alternativas" deve ser uma lista de nomes (textos).');
  }
  if (!Array.isArray(criterios) || criterios.length === 0) {
    throw new ErroRequisicao('"criterios" deve ser uma lista com ao menos 1 critério.');
  }
  criterios.forEach((c, i) => {
    if (!c || typeof c.nome !== 'string' || c.nome.trim() === '') {
      throw new ErroRequisicao(`Critério ${i + 1}: informe o "nome".`);
    }
  });
  if (!Array.isArray(matriz)) {
    throw new ErroRequisicao('"matriz" deve ser uma lista de listas de números.');
  }
  if (matriz.length !== alternativas.length) {
    throw new ErroRequisicao(
      `A matriz tem ${matriz.length} linha(s), mas há ${alternativas.length} alternativa(s).`,
    );
  }
  return { alternativas, criterios, matriz };
}

async function executar(req, res, next) {
  try {
    const { alternativas, criterios, matriz } = validarCorpo(req.body);

    const pesos = criterios.map((c) => c.peso);
    const tipos = criterios.map((c) => c.tipo);
    const { ranking } = topsis(matriz, pesos, tipos);

    const rankingFormatado = ranking.map((r) => ({
      posicao: r.posicao,
      alternativa: alternativas[r.indice],
      ci: r.ci,
      distanciaPositiva: r.distanciaPositiva,
      distanciaNegativa: r.distanciaNegativa,
    }));

    // Salva a simulação no banco de dados
    const simulacao = await simulacaoService.salvar({
      parametros: { alternativas, criterios, matriz },
      resultados: ranking.map((r) => ({
        ci: r.ci,
        distanciaPositiva: r.distanciaPositiva,
        distanciaNegativa: r.distanciaNegativa,
        posicao: r.posicao,
      })),
    });

    res.json({ simulacaoId: simulacao.id, ranking: rankingFormatado });
  } catch (err) {
    next(err);
  }
}

module.exports = { executar };