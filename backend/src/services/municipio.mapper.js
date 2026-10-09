// Converte o registro do Prisma em um objeto simples para a API:
// Decimals viram números e os valores da MatrizDecisao viram { [criterioId]: valor }.

const INCLUDE_VALORES = {
  matrizDecisao: {
    select: { criterioId: true, valor: true, anoReferencia: true },
    orderBy: { anoReferencia: 'asc' }, // o ano mais recente é gravado por último e prevalece
  },
};

const numeroOuNulo = (v) => (v == null ? null : Number(v));

function mapearMunicipio({ matrizDecisao = [], ...m }) {
  const valores = {};
  const anosReferencia = {};
  for (const v of matrizDecisao) {
    valores[v.criterioId] = Number(v.valor);
    anosReferencia[v.criterioId] = v.anoReferencia;
  }

  return {
    ...m,
    idh: numeroOuNulo(m.idh),
    latitude: numeroOuNulo(m.latitude),
    longitude: numeroOuNulo(m.longitude),
    valores,
    anosReferencia,
    // ANEEL consultada e nenhuma usina renovável em operação encontrada
    semGeracaoRenovavel: m.geracaoRenovavel === false,
    aneelConsultada: m.geracaoRenovavel !== null && m.geracaoRenovavel !== undefined,
  };
}

module.exports = { INCLUDE_VALORES, mapearMunicipio };
