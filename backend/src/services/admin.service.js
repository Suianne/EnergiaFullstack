// Operações administrativas sobre o banco de dados.
const prisma = require('../config/database');
const importacao = require('./importacao.service');

/**
 * Apaga municípios, matriz de decisão, simulações, rankings e critérios,
 * recriando os critérios padrão em seguida. Usuários são preservados.
 */
async function resetarDados() {
  // Tabelas fixas (sem entrada do usuário), por isso o executeRawUnsafe é seguro aqui.
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "resultados_ranking", "simulacoes", "matriz_decisao", "municipios", "criterios" RESTART IDENTITY CASCADE',
  );
  importacao.limparCacheANEEL();
  const criterios = await importacao.garantirCriteriosPadrao();
  return { criteriosRecriados: Object.keys(criterios).length };
}

async function estatisticas() {
  const [usuarios, municipios, criterios, simulacoes, comGeracao, semGeracao, naoConsultados] = await Promise.all([
    prisma.usuario.count(),
    prisma.municipio.count(),
    prisma.criterio.count(),
    prisma.simulacao.count(),
    prisma.municipio.count({ where: { geracaoRenovavel: true } }),
    prisma.municipio.count({ where: { geracaoRenovavel: false } }),
    prisma.municipio.count({ where: { geracaoRenovavel: null } }),
  ]);
  return { usuarios, municipios, criterios, simulacoes, comGeracao, semGeracao, naoConsultados };
}

module.exports = { resetarDados, estatisticas };
