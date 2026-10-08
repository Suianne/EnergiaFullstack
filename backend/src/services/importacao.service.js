const prisma = require('../config/database');

// Mapa UF -> Codigo IBGE do estado (usado nas APIs batch)
const UF_CODES = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26',
  PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
  SE: '28', SP: '35', TO: '17',
};

/**
 * Remove acentos e converte para maiúsculas para comparação de nomes.
 * Ex: "São Paulo" -> "SAO PAULO", "SALVADOR" -> "SALVADOR"
 */
function normalizarNome(nome) {
  return nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// ═══════════════════════════════════════════════════════════════
//  IBGE — Municípios e indicadores socioeconômicos
// ═══════════════════════════════════════════════════════════════

async function buscarMunicipiosIBGE(uf) {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Erro ao consultar IBGE: ${res.status}`);
  const dados = await res.json();

  return dados.map((m) => ({
    ibge: String(m.id),
    nome: m.nome,
    uf: m.microrregiao.mesorregiao.UF.sigla,
  }));
}

/**
 * Busca um indicador do IBGE (API agregados) para todos os municípios de uma UF
 * em uma UNICA chamada HTTP. Retorna mapa { codigoIbge: valor }.
 */
async function fetchAgregadoBatch(tabela, variavel, codigoUF) {
  try {
    const url = `https://servicodados.ibge.gov.br/api/v3/agregados/${tabela}/periodos/-1/variaveis/${variavel}?localidades=N6[N3[${codigoUF}]]`;
    const res = await fetch(url);
    if (!res.ok) return {};
    const dados = await res.json();
    const result = {};
    const series = dados[0]?.resultados?.[0]?.series || [];
    for (const s of series) {
      const id = s.localidade?.id;
      const serie = s.serie || {};
      const ultimoAno = Object.keys(serie)
        .filter((k) => serie[k] != null && serie[k] !== '...' && serie[k] !== '-')
        .sort()
        .pop();
      if (!ultimoAno) continue;
      const valor = parseFloat(String(serie[ultimoAno]).replace(',', '.'));
      if (id && Number.isFinite(valor)) result[id] = valor;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * Busca populacao e PIB per capita de todos os municipios de uma UF
 * em apenas 2 chamadas HTTP (uma por indicador).
 * Retorna { populacao: { codigo: valor }, pib: { codigo: valor } }
 */
async function buscarIndicadoresBatchIBGE(uf) {
  const codigoUF = UF_CODES[uf.toUpperCase()];
  if (!codigoUF) return { populacao: {}, pib: {} };

  const [populacao, pib] = await Promise.all([
    fetchAgregadoBatch('6579', '9324', codigoUF),  // Populacao estimada
    fetchAgregadoBatch('5938', '37', codigoUF),     // PIB per capita
  ]);

  return { populacao, pib };
}

/**
 * Busca populacao estimada e PIB per capita de um unico municipio (fallback).
 */
async function buscarIndicadoresIBGE(codigoIbge) {
  const resultado = { populacao: null, pibPerCapita: null };

  try {
    const urlPop = `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${codigoIbge}]`;
    const res = await fetch(urlPop);
    if (res.ok) {
      const dados = await res.json();
      const serie = dados[0]?.resultados?.[0]?.series?.[0]?.serie || {};
      const ultimoAno = Object.keys(serie).sort().pop();
      const pop = ultimoAno ? parseInt(serie[ultimoAno], 10) : null;
      resultado.populacao = Number.isFinite(pop) ? pop : null;
    }
  } catch { /* indicador indisponivel */ }

  try {
    const urlPib = `https://servicodados.ibge.gov.br/api/v1/pesquisas/38/indicadores/47001/resultados/${codigoIbge}`;
    const res = await fetch(urlPib);
    if (res.ok) {
      const dados = await res.json();
      const serie = dados[0]?.res?.[0]?.res || {};
      const ultimoAno = Object.keys(serie).filter((k) => serie[k] != null).sort().pop();
      const pib = ultimoAno ? parseFloat(serie[ultimoAno]) : null;
      resultado.pibPerCapita = Number.isFinite(pib) ? pib : null;
    }
  } catch { /* indicador indisponivel */ }

  return resultado;
}

/**
 * Importa municipios de uma UF do IBGE e salva no banco.
 * Usa batch: 1 chamada para lista de municipios, 1 chamada para populacao,
 * e createMany para inserir tudo de uma vez.
 */
async function importarMunicipiosUF(uf) {
  const ufUpper = uf.toUpperCase();
  const municipiosIBGE = await buscarMunicipiosIBGE(ufUpper);

  // Buscar todos os codigos IBGE ja cadastrados de uma vez
  const existentes = await prisma.municipio.findMany({
    where: { codigoIbge: { in: municipiosIBGE.map((m) => m.ibge) } },
    select: { codigoIbge: true },
  });
  const codigosExistentes = new Set(existentes.map((e) => e.codigoIbge));

  const novos = municipiosIBGE.filter((m) => !codigosExistentes.has(m.ibge));

  if (novos.length === 0) {
    return { importados: 0, ignorados: municipiosIBGE.length, total: municipiosIBGE.length };
  }

  // Buscar populacao em batch (1 chamada HTTP para toda a UF)
  const codigoUF = UF_CODES[ufUpper];
  const populacaoMap = codigoUF ? await fetchAgregadoBatch('6579', '9324', codigoUF) : {};

  // Inserir todos de uma vez com createMany
  const { count: importados } = await prisma.municipio.createMany({
    data: novos.map((m) => ({
      nome: m.nome,
      uf: m.uf,
      codigoIbge: m.ibge,
      populacao: populacaoMap[m.ibge] ?? null,
    })),
    skipDuplicates: true,
  });

  return {
    importados,
    ignorados: municipiosIBGE.length - importados,
    total: municipiosIBGE.length,
  };
}

// ═══════════════════════════════════════════════════════════════
//  ANEEL — SIGA (Sistema de Informacoes de Geracao da ANEEL)
// ═══════════════════════════════════════════════════════════════

const ANEEL_BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';
const SIGA_RESOURCE = '11ec447d-698d-4ab8-977f-b424d5deee6a';
const TIPOS_RENOVAVEIS = ['UFV', 'EOL', 'PCH', 'CGH', 'CGU'];

/**
 * Busca dados de geracao renovavel do SIGA/ANEEL por UF.
 * Retorna mapa NORMALIZADO: { "NOME_NORMALIZADO": { potenciaInstalada, usinasRenovaveis } }
 * A chave usa nome normalizado (sem acentos, maiusculo) para matching robusto.
 */
async function buscarDadosANEEL(uf) {
  try {
    const ufSafe = uf.toUpperCase().replace(/[^A-Z]/g, '');
    const result = {};
    let offset = 0;
    const limit = 1000;

    // Aumentado para 50 paginas para estados grandes como SP
    for (let page = 0; page < 50; page++) {
      const filters = JSON.stringify({ SigUFPrincipal: ufSafe });
      const url = `${ANEEL_BASE}/datastore_search?resource_id=${SIGA_RESOURCE}&filters=${encodeURIComponent(filters)}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      if (!data.success) break;
      const records = data.result?.records || [];

      for (const r of records) {
        if (!TIPOS_RENOVAVEIS.includes(r.SigTipoGeracao)) continue;
        if (r.DscFaseUsina !== 'Operação') continue;

        const descMun = r.DscMuninicpios || '';
        // Separar "Mun1/Mun2 - UF" em municipios individuais
        const partesCidade = descMun.split(' - ')[0].trim();
        const nomesMun = partesCidade.split('/').map((n) => n.trim()).filter(Boolean);
        if (nomesMun.length === 0) continue;

        const potStr = String(r.MdaPotenciaFiscalizadaKw || '0').replace(',', '.');
        const potencia = parseFloat(potStr) || 0;

        for (const nomeMun of nomesMun) {
          // Normalizar nome para matching case/accent insensitive
          const chave = normalizarNome(nomeMun);
          if (!result[chave]) result[chave] = { potenciaInstalada: 0, usinasRenovaveis: 0 };
          result[chave].potenciaInstalada += potencia;
          result[chave].usinasRenovaveis += 1;
        }
      }

      if (records.length < limit) break;
      offset += limit;
    }

    return result;
  } catch (err) {
    console.error('Erro ao buscar dados ANEEL/SIGA:', err.message);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════
//  Popular MatrizDecisao — conecta APIs ao motor TOPSIS
// ═══════════════════════════════════════════════════════════════

const CRITERIOS_PADRAO = [
  { nome: 'População', descricao: 'População estimada (IBGE)', tipo: 'beneficio', peso: 0.25, unidade: 'hab' },
  { nome: 'PIB per capita', descricao: 'PIB per capita municipal (IBGE)', tipo: 'custo', peso: 0.25, unidade: 'R$' },
  { nome: 'Potência instalada GD', descricao: 'Potência instalada de geração renovável em operação (ANEEL/SIGA)', tipo: 'beneficio', peso: 0.25, unidade: 'kW' },
  { nome: 'Unidades geradoras GD', descricao: 'Nº de usinas renováveis em operação (ANEEL/SIGA)', tipo: 'beneficio', peso: 0.25, unidade: 'un' },
];

/**
 * Cria criterios padrao, busca indicadores do IBGE e ANEEL em batch,
 * e grava tudo na tabela MatrizDecisao para alimentar o motor TOPSIS.
 *
 * Diferente da versao anterior, esta funcao:
 * - Usa APIs batch do IBGE (2 chamadas no total, nao N*2)
 * - Normaliza nomes para matching ANEEL (case/accent insensitive)
 * - Processa TODOS os municipios da UF de uma vez
 * - Usa transaction para escrita eficiente no banco
 */
async function popularDados(uf) {
  const ufUpper = uf.toUpperCase();

  // 1. Garantir criterios padrao no banco
  const criterios = [];
  for (const def of CRITERIOS_PADRAO) {
    let c = await prisma.criterio.findFirst({ where: { nome: def.nome } });
    if (!c) c = await prisma.criterio.create({ data: def });
    criterios.push(c);
  }

  // 2. Pegar TODOS os municipios da UF com codigo IBGE
  const municipios = await prisma.municipio.findMany({
    where: { uf: ufUpper, codigoIbge: { not: null } },
  });

  if (municipios.length === 0) {
    return {
      criterios: criterios.length,
      municipiosProcessados: 0,
      municipiosTotal: 0,
      completo: true,
      mensagem: 'Nenhum município cadastrado para essa UF.',
    };
  }

  // 3. Buscar TODOS os dados externos em paralelo (3 chamadas no total)
  const [dadosAneel, indicadoresIBGE] = await Promise.all([
    buscarDadosANEEL(uf),
    buscarIndicadoresBatchIBGE(uf),
  ]);

  // 4. Montar entradas da MatrizDecisao para todos os municipios
  const anoRef = new Date().getFullYear();
  const munIds = municipios.map((m) => m.id);
  const entries = [];
  const popUpdates = [];

  for (const mun of municipios) {
    const populacao = indicadoresIBGE.populacao[mun.codigoIbge] || 0;
    const pibPerCapita = indicadoresIBGE.pib[mun.codigoIbge] || 0;

    // Match ANEEL usando nome normalizado
    const chaveNome = normalizarNome(mun.nome);
    const aneel = dadosAneel[chaveNome] || { potenciaInstalada: 0, usinasRenovaveis: 0 };

    entries.push(
      { municipioId: mun.id, criterioId: criterios[0].id, valor: populacao, anoReferencia: anoRef },
      { municipioId: mun.id, criterioId: criterios[1].id, valor: pibPerCapita, anoReferencia: anoRef },
      { municipioId: mun.id, criterioId: criterios[2].id, valor: aneel.potenciaInstalada, anoReferencia: anoRef },
      { municipioId: mun.id, criterioId: criterios[3].id, valor: aneel.usinasRenovaveis, anoReferencia: anoRef },
    );

    if (populacao) {
      popUpdates.push({ id: mun.id, populacao });
    }
  }

  // 5. Gravar no banco em transaction (delete + createMany = muito mais rapido que N upserts)
  await prisma.$transaction(async (tx) => {
    // Limpar dados antigos do ano corrente para esses municipios
    await tx.matrizDecisao.deleteMany({
      where: { municipioId: { in: munIds }, anoReferencia: anoRef },
    });
    // Inserir todos de uma vez
    await tx.matrizDecisao.createMany({ data: entries });
  });

  // 6. Atualizar populacao nos municipios
  for (const { id, populacao } of popUpdates) {
    await prisma.municipio.update({ where: { id }, data: { populacao } });
  }

  // Contar municipios que ficaram sem ANEEL data (para diagnostico)
  const comAneel = municipios.filter((m) => {
    const chave = normalizarNome(m.nome);
    return dadosAneel[chave] != null;
  }).length;

  return {
    criterios: criterios.length,
    municipiosProcessados: municipios.length,
    municipiosRestantes: 0,
    completo: true,
    fontes: {
      ibge: [
        `população (${Object.keys(indicadoresIBGE.populacao).length} municípios)`,
        `PIB per capita (${Object.keys(indicadoresIBGE.pib).length} municípios)`,
      ],
      aneel: [
        `SIGA - geração renovável (${Object.keys(dadosAneel).length} municípios com usinas, ${comAneel} matched)`,
      ],
    },
  };
}

module.exports = {
  buscarMunicipiosIBGE,
  buscarIndicadoresIBGE,
  buscarIndicadoresBatchIBGE,
  importarMunicipiosUF,
  buscarDadosANEEL,
  popularDados,
};
