const prisma = require('../config/database');

async function listar() {
  const municipios = await prisma.municipio.findMany({
    orderBy: { nome: 'asc' },
    include: { matrizDecisao: { select: { criterioId: true, valor: true } } },
  });

  return municipios.map(({ matrizDecisao, ...m }) => ({
    ...m,
    valores: Object.fromEntries(
      matrizDecisao.filter((md) => md.criterioId).map((md) => [md.criterioId, Number(md.valor)]),
    ),
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
