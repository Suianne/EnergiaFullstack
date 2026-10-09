const prisma = require('../config/database');
const { INCLUDE_VALORES, mapearMunicipio } = require('./municipio.mapper');
const importacao = require('./importacao.service');

async function listar() {
  const municipios = await prisma.municipio.findMany({
    orderBy: [{ uf: 'asc' }, { nome: 'asc' }],
    include: INCLUDE_VALORES,
  });
  return municipios.map(mapearMunicipio);
}

async function buscarPorId(id) {
  const municipio = await prisma.municipio.findUnique({ where: { id }, include: INCLUDE_VALORES });
  return municipio ? mapearMunicipio(municipio) : null;
}

// O cadastro sempre passa pelo IBGE + ANEEL: nome, UF, população, PIB, geração renovável e coordenadas.
async function criar({ codigoIbge }) {
  return importacao.cadastrarMunicipio({ codigoIbge });
}

// Edição manual de campos que as APIs não cobrem (ou para corrigir coordenadas).
async function atualizar(id, dados) {
  await prisma.municipio.update({ where: { id }, data: dados });
  return buscarPorId(id);
}

async function atualizarDados(id, opcoes) {
  return importacao.atualizarDadosMunicipio(id, opcoes);
}

async function remover(id) {
  return prisma.municipio.delete({ where: { id } });
}

module.exports = { listar, buscarPorId, criar, atualizar, atualizarDados, remover };
