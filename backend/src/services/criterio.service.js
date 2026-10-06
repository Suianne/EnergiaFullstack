const prisma = require('../config/database');

async function listar() {
  return prisma.criterio.findMany({ orderBy: { nome: 'asc' } });
}

async function buscarPorId(id) {
  return prisma.criterio.findUnique({ where: { id } });
}

async function criar(dados) {
  return prisma.criterio.create({ data: dados });
}

async function atualizar(id, dados) {
  return prisma.criterio.update({ where: { id }, data: dados });
}

async function remover(id) {
  return prisma.criterio.delete({ where: { id } });
}

module.exports = { listar, buscarPorId, criar, atualizar, remover };
