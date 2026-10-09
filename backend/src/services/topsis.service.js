/**
 * Motor TOPSIS
 *
 * Convenção do projeto: Ci é um ÍNDICE DE VULNERABILIDADE energética.
 * Quanto MAIOR o Ci, MAIS vulnerável (maior prioridade de intervenção) é o município.
 *
 * Os critérios são configurados de forma que a solução ideal positiva (A+)
 * represente o perfil de maior vulnerabilidade:
 *   - "beneficio": quanto maior o valor, mais vulnerável (ex.: população exposta);
 *   - "custo":     quanto maior o valor, menos vulnerável (ex.: PIB per capita,
 *                  potência renovável instalada, usinas renováveis em operação).
 *
 * Município sem geração renovável constatada pela ANEEL tem valor 0 nos critérios
 * da ANEEL (tipo "custo") e, portanto, fica no extremo de maior vulnerabilidade
 * nesses critérios. Município SEM DADOS (API não respondeu) não entra na matriz:
 * ausência de dado não é zero. Veja `montarMatrizMunicipios`.
 */

const TIPOS_VALIDOS = ['beneficio', 'custo'];
const TOLERANCIA_PESOS = 1e-6;

// Faixas de vulnerabilidade usadas em relatórios e na interface.
const FAIXAS = [
  { nome: 'Alta', minimo: 0.66 },
  { nome: 'Média', minimo: 0.33 },
  { nome: 'Baixa', minimo: 0 },
];

function faixaVulnerabilidade(ci) {
  return (FAIXAS.find((f) => ci >= f.minimo) || FAIXAS[FAIXAS.length - 1]).nome;
}

class TopsisInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TopsisInputError';
  }
}

function validarEntrada(matriz, pesos, tipos) {
  if (!Array.isArray(matriz) || matriz.length < 2) {
    throw new TopsisInputError('São necessárias ao menos 2 alternativas para o ranking.');
  }
  if (!Array.isArray(pesos) || pesos.length < 1) {
    throw new TopsisInputError('É necessário ao menos 1 critério.');
  }
  const nCriterios = pesos.length;

  if (!Array.isArray(tipos) || tipos.length !== nCriterios) {
    throw new TopsisInputError('A quantidade de tipos deve ser igual à de critérios.');
  }
  tipos.forEach((t, j) => {
    if (!TIPOS_VALIDOS.includes(t)) {
      throw new TopsisInputError(`Tipo inválido no critério ${j + 1}: use "beneficio" ou "custo".`);
    }
  });

  matriz.forEach((linha, i) => {
    if (!Array.isArray(linha) || linha.length !== nCriterios) {
      throw new TopsisInputError(`A alternativa ${i + 1} deve ter ${nCriterios} valor(es).`);
    }
    linha.forEach((v, j) => {
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        throw new TopsisInputError(`Valor inválido na alternativa ${i + 1}, critério ${j + 1}.`);
      }
    });
  });

  pesos.forEach((p, j) => {
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0) {
      throw new TopsisInputError(`Peso inválido no critério ${j + 1}: deve ser um número >= 0.`);
    }
  });
  const soma = pesos.reduce((s, p) => s + p, 0);
  if (Math.abs(soma - 1) > TOLERANCIA_PESOS) {
    throw new TopsisInputError(`Os pesos devem somar 1,0 (soma atual: ${soma.toFixed(6)}).`);
  }
}

/**
 * Normaliza pesos para somarem 1 (ex.: [1, 1, 2] -> [0.25, 0.25, 0.5]).
 */
function normalizarPesos(pesos) {
  if (!Array.isArray(pesos) || pesos.length === 0) {
    throw new TopsisInputError('É necessário ao menos 1 critério.');
  }
  pesos.forEach((p, j) => {
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0) {
      throw new TopsisInputError(`Peso inválido no critério ${j + 1}: deve ser um número >= 0.`);
    }
  });
  const soma = pesos.reduce((s, p) => s + p, 0);
  if (soma <= 0) throw new TopsisInputError('A soma dos pesos deve ser maior que zero.');
  return pesos.map((p) => p / soma);
}

/**
 * Separa os municípios aptos (com valor para TODOS os critérios) dos excluídos
 * e monta a matriz de decisão na ordem dos critérios.
 *
 * @param {{id:number, nome:string, uf?:string, valores:Object}[]} municipios
 * @param {{id:number, nome:string}[]} criterios
 */
function montarMatrizMunicipios(municipios, criterios) {
  const aptos = [];
  const excluidos = [];

  for (const m of municipios) {
    const faltando = criterios.filter((c) => {
      const v = m.valores?.[c.id];
      return v == null || !Number.isFinite(Number(v));
    });
    if (faltando.length) {
      excluidos.push({
        id: m.id,
        nome: m.nome,
        uf: m.uf,
        motivo: `Sem dados para: ${faltando.map((c) => c.nome).join(', ')}.`,
      });
    } else {
      aptos.push(m);
    }
  }

  const matriz = aptos.map((m) => criterios.map((c) => Number(m.valores[c.id])));
  return { aptos, excluidos, matriz };
}

/**
 * @param {number[][]} matriz  linhas = alternativas, colunas = critérios
 * @param {number[]}   pesos   um peso por critério; deve somar 1
 * @param {('beneficio'|'custo')[]} tipos  um tipo por critério
 * @returns {{
 *   ranking: {indice:number, ci:number, distanciaPositiva:number, distanciaNegativa:number, posicao:number}[],
 *   idealPositivo: number[],
 *   idealNegativo: number[]
 * }}  ranking ordenado do maior Ci (posicao 1 = mais vulnerável) ao menor; `indice` é a linha original da matriz.
 */
function topsis(matriz, pesos, tipos) {
  validarEntrada(matriz, pesos, tipos);
  const nCri = pesos.length;

  // Passo 1: normalização vetorial  r_ij = x_ij / sqrt(Σ x_ij²)
  const normas = Array.from({ length: nCri }, (_, j) =>
    Math.sqrt(matriz.reduce((soma, linha) => soma + linha[j] ** 2, 0)),
  );
  const normalizada = matriz.map((linha) =>
    linha.map((x, j) => (normas[j] === 0 ? 0 : x / normas[j])),
  );

  // Passo 2: matriz ponderada  v_ij = w_j * r_ij
  const ponderada = normalizada.map((linha) => linha.map((r, j) => r * pesos[j]));

  // Passos 3 e 4: soluções ideal positiva (A+) e negativa (A-)
  const coluna = (j) => ponderada.map((linha) => linha[j]);
  const idealPositivo = tipos.map((tipo, j) =>
    tipo === 'beneficio' ? Math.max(...coluna(j)) : Math.min(...coluna(j)),
  );
  const idealNegativo = tipos.map((tipo, j) =>
    tipo === 'beneficio' ? Math.min(...coluna(j)) : Math.max(...coluna(j)),
  );

  // Passo 5: distâncias euclidianas a A+ e A-
  const distancia = (linha, referencia) =>
    Math.sqrt(linha.reduce((soma, v, j) => soma + (v - referencia[j]) ** 2, 0));

  // Passo 6: coeficiente de proximidade  Ci = D- / (D+ + D-)
  const resultados = ponderada.map((linha, indice) => {
    const distanciaPositiva = distancia(linha, idealPositivo);
    const distanciaNegativa = distancia(linha, idealNegativo);
    const total = distanciaPositiva + distanciaNegativa;
    // total = 0 só ocorre quando todas as alternativas são idênticas: Ci neutro.
    const ci = total === 0 ? 0.5 : distanciaNegativa / total;
    return { indice, ci, distanciaPositiva, distanciaNegativa };
  });

  // Passo 7: ranking (maior Ci primeiro; empate resolvido pela ordem de entrada)
  const ranking = resultados
    .sort((a, b) => b.ci - a.ci || a.indice - b.indice)
    .map((r, i) => ({ ...r, posicao: i + 1 }));

  return { ranking, idealPositivo, idealNegativo };
}

module.exports = {
  topsis,
  normalizarPesos,
  montarMatrizMunicipios,
  faixaVulnerabilidade,
  FAIXAS,
  TopsisInputError,
  TOLERANCIA_PESOS,
};
