const { topsis, normalizarPesos, montarMatrizMunicipios } = require('../services/topsis.service');
const simulacaoService = require('../services/simulacao.service');
const municipioService = require('../services/municipio.service');
const criterioService = require('../services/criterio.service');
const { ErroRequisicao } = require('../middleware/errorHandler');

const TIPOS = ['beneficio', 'custo'];

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

// TOPSIS com matriz enviada na requisição (uso livre / acadêmico)
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

    const simulacao = await simulacaoService.salvar({
      usuarioId: req.usuario?.id ?? null,
      parametros: {
        origem: 'matriz',
        alternativas,
        criterios,
        matriz,
        rankingAlternativas: rankingFormatado.map((r) => r.alternativa),
      },
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

// Pesos/tipos enviados pelo cliente sobrescrevem os do banco (sem persistir).
function validarAjustes(body) {
  const lista = body?.criterios;
  if (lista === undefined) return new Map();
  if (!Array.isArray(lista)) throw new ErroRequisicao('"criterios" deve ser uma lista de { id, peso, tipo }.');

  const ajustes = new Map();
  lista.forEach((c, i) => {
    const id = Number(c?.id);
    if (!Number.isInteger(id)) throw new ErroRequisicao(`Critério ${i + 1}: "id" inválido.`);
    if (c.peso !== undefined && (typeof c.peso !== 'number' || !Number.isFinite(c.peso) || c.peso < 0)) {
      throw new ErroRequisicao(`Critério ${i + 1}: "peso" deve ser um número >= 0.`);
    }
    if (c.tipo !== undefined && !TIPOS.includes(c.tipo)) {
      throw new ErroRequisicao(`Critério ${i + 1}: "tipo" deve ser "beneficio" ou "custo".`);
    }
    ajustes.set(id, { peso: c.peso, tipo: c.tipo });
  });
  return ajustes;
}

/**
 * TOPSIS com os municípios e critérios do banco.
 * - Critérios com peso 0 não entram.
 * - Municípios sem valor em algum critério ficam fora (lista "excluidos").
 * - A simulação é salva ligada aos municípios e ao usuário.
 */
async function executarBanco(req, res, next) {
  try {
    const ajustes = validarAjustes(req.body);

    const [municipios, criteriosDb] = await Promise.all([municipioService.listar(), criterioService.listar()]);

    const criterios = criteriosDb
      .map((c) => {
        const ajuste = ajustes.get(c.id) || {};
        return {
          id: c.id,
          chave: c.chave,
          nome: c.nome,
          unidade: c.unidade,
          fonte: c.fonte,
          tipo: ajuste.tipo ?? c.tipo ?? 'beneficio',
          peso: Number(ajuste.peso ?? c.peso ?? 0),
        };
      })
      .filter((c) => c.peso > 0);

    if (criterios.length === 0) {
      throw new ErroRequisicao('Nenhum critério com peso maior que zero.');
    }

    const pesos = normalizarPesos(criterios.map((c) => c.peso));
    const criteriosUsados = criterios.map((c, j) => ({ ...c, peso: +pesos[j].toFixed(6) }));
    const { aptos, excluidos, matriz } = montarMatrizMunicipios(municipios, criterios);

    if (aptos.length < 2) {
      throw new ErroRequisicao(
        `São necessários ao menos 2 municípios com dados completos (há ${aptos.length}; ${excluidos.length} sem dados).`,
      );
    }

    const { ranking } = topsis(matriz, pesos, criterios.map((c) => c.tipo));

    const rankingFormatado = ranking.map((r) => {
      const m = aptos[r.indice];
      return {
        posicao: r.posicao,
        municipioId: m.id,
        alternativa: m.nome,
        uf: m.uf,
        geracaoRenovavel: m.geracaoRenovavel,
        ci: r.ci,
        distanciaPositiva: r.distanciaPositiva,
        distanciaNegativa: r.distanciaNegativa,
        valores: criterios.map((c) => m.valores[c.id]),
      };
    });

    const simulacao = await simulacaoService.salvar({
      usuarioId: req.usuario?.id ?? null,
      parametros: {
        origem: 'banco',
        criterios: criteriosUsados,
        alternativas: aptos.map((m) => m.nome),
        rankingAlternativas: rankingFormatado.map((r) => r.alternativa),
        excluidos,
      },
      resultados: ranking.map((r) => ({
        municipioId: aptos[r.indice].id,
        ci: r.ci,
        distanciaPositiva: r.distanciaPositiva,
        distanciaNegativa: r.distanciaNegativa,
        posicao: r.posicao,
      })),
    });

    res.json({ simulacaoId: simulacao.id, criterios: criteriosUsados, ranking: rankingFormatado, excluidos });
  } catch (err) {
    next(err);
  }
}

module.exports = { executar, executarBanco };
