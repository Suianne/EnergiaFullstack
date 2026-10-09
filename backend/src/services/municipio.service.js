const prisma = require('../config/database');
const { semGeracaoConstatada } = require('./fontesExternas.service');

// Se houver mais de um ano para o mesmo critério, vale o mais recente.
function valoresMaisRecentes(matrizDecisao) {
  const porCriterio = new Map();
  for (const md of matrizDecisao) {
    if (!md.criterioId) continue;
    const atual = porCriterio.get(md.criterioId);
    if (!atual || (md.anoReferencia ?? 0) > (atual.anoReferencia ?? 0)) porCriterio.set(md.criterioId, md);
  }
  return Object.fromEntries([...porCriterio].map(([id, md]) => [id, Number(md.valor)]));
}

async function listar() {
  const municipios = await prisma.municipio.findMany({
    orderBy: { nome: 'asc' },
    include: { matrizDecisao: { select: { criterioId: true, valor: true, anoReferencia: true } } },
  });

  return municipios.map(({ matrizDecisao, ...m }) => ({
    ...m,
    potenciaRenovavelKw: m.potenciaRenovavelKw == null ? null : Number(m.potenciaRenovavelKw),
    pibPerCapita: m.pibPerCapita == null ? null : Number(m.pibPerCapita),
    latitude: m.latitude == null ? null : Number(m.latitude),
    longitude: m.longitude == null ? null : Number(m.longitude),
    semGeracaoRenovavel: semGeracaoConstatada(m),
    valores: valoresMaisRecentes(matrizDecisao),
  }));
}

async function buscarPorId(id) {
  return prisma.municipio.findUnique({ where: { id } });
}

async function criar(dados) {
  return prisma.municipio.create({ data: dados });
}

async function atualizar(id, dados) {
  return prisma.municipio.update({ where: { id }, data: dados });
}

async function remover(id) {
  return prisma.municipio.delete({ where: { id } });
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
