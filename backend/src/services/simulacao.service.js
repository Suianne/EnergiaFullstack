const prisma = require('../config/database');

async function listar() {
  return prisma.simulacao.findMany({
    orderBy: { dataExecucao: 'desc' },
    include: {
      usuario: { select: { id: true, nome: true, email: true } },
      _count: { select: { resultadosRanking: true } },
    },
  });
}

async function buscarPorId(id) {
  return prisma.simulacao.findUnique({
    where: { id },
    include: {
      resultadosRanking: {
        orderBy: { posicao: 'asc' },
        include: { municipio: true },
      },
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });
}

async function salvar(dados) {
  return prisma.simulacao.create({
    data: {
      parametros: dados.parametros,
      status: 'concluida',
      usuarioId: dados.usuarioId ?? null,
      resultadosRanking: {
        create: dados.resultados.map((r) => ({
          municipioId: r.municipioId ?? null,
          coeficienteCi: r.ci,
          distanciaPositiva: r.distanciaPositiva,
          distanciaNegativa: r.distanciaNegativa,
          posicao: r.posicao,
        })),
      },
    },
    include: {
      resultadosRanking: { orderBy: { posicao: 'asc' } },
    },
  });
}

module.exports = { listar, buscarPorId, salvar };
