const prisma = require('../config/database');
const { ErroRequisicao, ErroConflito } = require('../middleware/errorHandler');
const fontes = require('./fontesExternas.service');

const { UF_CODES, CRITERIOS_PADRAO, normalizarNome } = fontes;

function validarUF(uf) {
  const ufUpper = String(uf ?? '').toUpperCase();
  if (!UF_CODES[ufUpper]) throw new ErroRequisicao(`UF inválida: "${uf}".`);
  return ufUpper;
}

/** Cria os critérios padrão na primeira vez; depois só os localiza (preserva pesos editados). */
async function garantirCriterios() {
  const porCodigo = {};
  for (const def of CRITERIOS_PADRAO) {
    porCodigo[def.codigo] = await prisma.criterio.upsert({
      where: { codigo: def.codigo },
      update: {},
      create: def,
    });
  }
  return porCodigo;
}

/**
 * Decide, SEM tocar no banco, o que gravar para um município:
 * os dados brutos (IBGE + ANEEL) e as linhas da matriz de decisão.
 */
function planejarGravacao(municipio, indicadores, aneel, criterios, ano) {
  const ind = indicadores[municipio.codigoIbge];
  const geracao = fontes.geracaoDoMunicipio(municipio.nome, aneel);
  const potenciaKw = Math.round(geracao.potenciaKw * 1000) / 1000;

  const valores = ind
    ? fontes.calcularValoresCriterios({
        populacao: ind.populacao,
        pibPerCapita: ind.pibPerCapita,
        potenciaKw,
        usinas: geracao.usinas,
      })
    : null;

  return {
    dados: {
      ...(ind ? { populacao: ind.populacao } : {}),
      pibPerCapita: ind?.pibPerCapita != null ? Math.round(ind.pibPerCapita * 100) / 100 : null,
      potenciaRenovavelKw: potenciaKw,
      usinasRenovaveis: geracao.usinas,
      dadosAtualizadosEm: new Date(),
    },
    linhas: valores
      ? CRITERIOS_PADRAO.map((c) => ({ criterioId: criterios[c.codigo].id, valor: valores[c.codigo], anoReferencia: ano }))
      : [],
    completo: valores !== null,
    semGeracao: geracao.usinas === 0 && potenciaKw === 0,
  };
}

/** Grava os dados de vários municípios de uma vez (uma única transação). */
async function gravarLote(municipios, indicadores, aneel) {
  const criterios = await garantirCriterios();
  const ano = new Date().getFullYear();
  const planos = municipios.map((m) => ({ m, ...planejarGravacao(m, indicadores, aneel, criterios, ano) }));

  await prisma.$transaction([
    prisma.matrizDecisao.deleteMany({ where: { municipioId: { in: municipios.map((m) => m.id) } } }),
    ...planos.map((p) => prisma.municipio.update({ where: { id: p.m.id }, data: p.dados })),
    prisma.matrizDecisao.createMany({
      data: planos.flatMap((p) => p.linhas.map((l) => ({ ...l, municipioId: p.m.id }))),
    }),
  ]);

  // Nomes que a ANEEL trouxe e não casaram com nenhum município da UF (ajuda a achar divergência de grafia).
  const nomesDaUF = new Set(municipios.map((m) => normalizarNome(m.nome)));
  const naoCasados = Object.keys(aneel.porMunicipio).filter((n) => !nomesDaUF.has(n));

  return {
    municipiosProcessados: municipios.length,
    completos: planos.filter((p) => p.completo).length,
    semDadosIBGE: planos.filter((p) => !p.completo).length,
    semGeracaoRenovavel: planos.filter((p) => p.semGeracao).length,
    aneel: {
      registrosLidos: aneel.registros,
      municipiosComUsinas: Object.keys(aneel.porMunicipio).length,
      nomesNaoCasados: naoCasados.slice(0, 10),
    },
  };
}

async function carregarFontesUF(uf) {
  const [indicadores, aneel] = await Promise.all([fontes.indicadoresIBGEPorUF(uf), fontes.buscarDadosANEEL(uf)]);
  return { indicadores, aneel };
}

// ═══════════════════════════════════════════════════════════════
//  Estado inteiro: importa os municípios E já traz os dados IBGE/ANEEL
// ═══════════════════════════════════════════════════════════════

async function importarMunicipiosUF(uf) {
  const ufUpper = validarUF(uf);

  // Tudo que é externo é buscado ANTES de gravar: se IBGE ou ANEEL falharem, o banco não muda.
  const [municipiosIBGE, { indicadores, aneel }] = await Promise.all([
    fontes.buscarMunicipiosIBGE(ufUpper),
    carregarFontesUF(ufUpper),
  ]);

  const existentes = await prisma.municipio.findMany({
    where: { codigoIbge: { in: municipiosIBGE.map((m) => m.ibge) } },
    select: { codigoIbge: true },
  });
  const jaCadastrados = new Set(existentes.map((e) => e.codigoIbge));
  const novos = municipiosIBGE.filter((m) => !jaCadastrados.has(m.ibge));

  if (novos.length > 0) {
    await prisma.municipio.createMany({
      data: novos.map((m) => ({ nome: m.nome, uf: ufUpper, codigoIbge: m.ibge })),
      skipDuplicates: true,
    });
  }

  const todos = await prisma.municipio.findMany({ where: { uf: ufUpper } });
  const dados = await gravarLote(todos, indicadores, aneel);

  return {
    importados: novos.length,
    ignorados: municipiosIBGE.length - novos.length,
    total: municipiosIBGE.length,
    ...dados,
  };
}

/** Atualiza IBGE + ANEEL de municípios já cadastrados da UF. */
async function atualizarDadosUF(uf) {
  const ufUpper = validarUF(uf);
  const municipios = await prisma.municipio.findMany({ where: { uf: ufUpper } });
  if (municipios.length === 0) {
    throw new ErroRequisicao(`Nenhum município cadastrado em ${ufUpper}. Importe o estado primeiro.`);
  }
  const { indicadores, aneel } = await carregarFontesUF(ufUpper);
  return gravarLote(municipios, indicadores, aneel);
}

// ═══════════════════════════════════════════════════════════════
//  Um município: só é cadastrado junto com os dados IBGE/ANEEL
// ═══════════════════════════════════════════════════════════════

async function cadastrarMunicipio(codigoIbge) {
  if (!/^\d{7}$/.test(String(codigoIbge ?? ''))) {
    throw new ErroRequisicao('"codigoIbge" deve ter 7 dígitos.');
  }

  if (await prisma.municipio.findUnique({ where: { codigoIbge } })) {
    throw new ErroConflito('Município já cadastrado.');
  }

  // O IBGE é a fonte do nome e da UF: evita grafia diferente gerando repetição.
  const ibge = await fontes.buscarMunicipioIBGE(codigoIbge);
  if (!ibge) throw new ErroRequisicao('Código IBGE não encontrado.');

  const mesmaUF = await prisma.municipio.findMany({ where: { uf: ibge.uf }, select: { nome: true } });
  if (mesmaUF.some((m) => normalizarNome(m.nome) === normalizarNome(ibge.nome))) {
    throw new ErroConflito(`${ibge.nome}/${ibge.uf} já está cadastrado.`);
  }

  const [indicadores, aneel] = await Promise.all([
    fontes.indicadoresIBGEPorMunicipio(codigoIbge),
    fontes.buscarDadosANEEL(ibge.uf),
  ]);

  const criterios = await garantirCriterios();
  const plano = planejarGravacao(
    { nome: ibge.nome, codigoIbge: ibge.ibge },
    indicadores,
    aneel,
    criterios,
    new Date().getFullYear(),
  );

  const municipio = await prisma.$transaction(async (tx) => {
    const criado = await tx.municipio.create({
      data: { nome: ibge.nome, uf: ibge.uf, codigoIbge: ibge.ibge, ...plano.dados },
    });
    if (plano.linhas.length > 0) {
      await tx.matrizDecisao.createMany({
        data: plano.linhas.map((l) => ({ ...l, municipioId: criado.id })),
      });
    }
    return criado;
  });

  return {
    municipio,
    completo: plano.completo,
    semGeracaoRenovavel: plano.semGeracao,
    aviso: plano.completo
      ? null
      : 'Município cadastrado, mas o IBGE não tem população/PIB para ele; ele não entra no ranking até esses dados existirem.',
  };
}

module.exports = {
  listarMunicipiosIBGE: (uf) => fontes.buscarMunicipiosIBGE(validarUF(uf)),
  importarMunicipiosUF,
  atualizarDadosUF,
  cadastrarMunicipio,
  // exportadas para teste
  planejarGravacao,
};
