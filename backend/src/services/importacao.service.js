const prisma = require('../config/database');

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
 * Busca população estimada e PIB per capita de um município na API do IBGE.
 */
async function buscarIndicadoresIBGE(codigoIbge) {
  const resultado = { populacao: null, pibPerCapita: null };

  // População estimada (pesquisa 6579, variável 9324)
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
  } catch { /* indicador indisponível */ }

  // PIB per capita (pesquisa 5938, variável 38)
  try {
    const urlPib = `https://servicodados.ibge.gov.br/api/v3/agregados/5938/periodos/-1/variaveis/38?localidades=N6[${codigoIbge}]`;
    const res = await fetch(urlPib);
    if (res.ok) {
      const dados = await res.json();
      const serie = dados[0]?.resultados?.[0]?.series?.[0]?.serie || {};
      const ultimoAno = Object.keys(serie).sort().pop();
      const pib = ultimoAno ? parseFloat(serie[ultimoAno]) : null;
      resultado.pibPerCapita = Number.isFinite(pib) ? pib : null;
    }
  } catch { /* indicador indisponível */ }

  return resultado;
}

/**
 * Importa municípios de uma UF do IBGE e salva no banco.
 * Pula municípios que já existem (mesmo código IBGE).
 */
async function importarMunicipiosUF(uf) {
  const municipiosIBGE = await buscarMunicipiosIBGE(uf.toUpperCase());

  let importados = 0;
  let ignorados = 0;

  for (const m of municipiosIBGE) {
    const existe = await prisma.municipio.findFirst({
      where: { codigoIbge: m.ibge },
    });

    if (existe) {
      ignorados++;
      continue;
    }

    const indicadores = await buscarIndicadoresIBGE(m.ibge);

    await prisma.municipio.create({
      data: {
        nome: m.nome,
        uf: m.uf,
        codigoIbge: m.ibge,
        populacao: indicadores.populacao,
      },
    });

    importados++;
  }

  return { importados, ignorados, total: municipiosIBGE.length };
}

// ═══════════════════════════════════════════════════════════════
//  ANEEL — Geração Distribuída (dados abertos CKAN)
// ═══════════════════════════════════════════════════════════════

const ANEEL_BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';
const ANEEL_GD_DATASET = 'relacao-de-empreendimentos-de-geracao-distribuida';

/**
 * Busca dados agregados de Geração Distribuída (GD) da ANEEL por UF.
 * Retorna mapa: { codigoIbge: { potenciaInstalada, unidadesGeradoras } }
 */
async function buscarDadosANEEL(uf) {
  try {
    // 1. Descobrir resource_id do dataset GD
    const pkgRes = await fetch(`${ANEEL_BASE}/package_show?id=${ANEEL_GD_DATASET}`);
    if (!pkgRes.ok) throw new Error(`ANEEL indisponível (${pkgRes.status})`);
    const pkg = await pkgRes.json();
    const resource = pkg.result?.resources?.find((r) => r.datastore_active);
    if (!resource) throw new Error('Recurso ANEEL GD não encontrado no datastore');

    // 2. Tentar agregação SQL (mais eficiente)
    const ufSafe = uf.toUpperCase().replace(/[^A-Z]/g, '');
    const sql = `SELECT "CodMunicipioIbge", SUM(CAST("MdaPotenciaInstaladaKW" AS float)) as potencia, COUNT(*) as unidades FROM "${resource.id}" WHERE "SigUF" = '${ufSafe}' GROUP BY "CodMunicipioIbge"`;

    const sqlRes = await fetch(`${ANEEL_BASE}/datastore_search_sql?sql=${encodeURIComponent(sql)}`);
    if (sqlRes.ok) {
      const data = await sqlRes.json();
      if (data.success) {
        const result = {};
        for (const row of data.result?.records || []) {
          const code = String(row.CodMunicipioIbge || '');
          if (code) {
            result[code] = {
              potenciaInstalada: Math.round(Number(row.potencia) || 0),
              unidadesGeradoras: Number(row.unidades) || 0,
            };
          }
        }
        return result;
      }
    }

    // 3. Fallback: busca paginada
    const result = {};
    let offset = 0;
    const limit = 5000;

    for (let page = 0; page < 20; page++) {
      const filters = JSON.stringify({ SigUF: ufSafe });
      const url = `${ANEEL_BASE}/datastore_search?resource_id=${resource.id}&filters=${encodeURIComponent(filters)}&limit=${limit}&offset=${offset}`;
      const res = await fetch(url);
      if (!res.ok) break;
      const data = await res.json();
      const records = data.result?.records || [];

      for (const r of records) {
        const code = String(r.CodMunicipioIbge || '');
        if (!code) continue;
        if (!result[code]) result[code] = { potenciaInstalada: 0, unidadesGeradoras: 0 };
        result[code].potenciaInstalada += Number(r.MdaPotenciaInstaladaKW || 0);
        result[code].unidadesGeradoras += 1;
      }

      if (records.length < limit) break;
      offset += limit;
    }

    return result;
  } catch (err) {
    console.error('Erro ao buscar dados ANEEL:', err.message);
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════
//  Popular MatrizDecisao — conecta APIs ao motor TOPSIS
// ═══════════════════════════════════════════════════════════════

const CRITERIOS_PADRAO = [
  { nome: 'População', descricao: 'População estimada (IBGE)', tipo: 'beneficio', peso: 0.25, unidade: 'hab' },
  { nome: 'PIB per capita', descricao: 'PIB per capita municipal (IBGE)', tipo: 'custo', peso: 0.25, unidade: 'R$' },
  { nome: 'Potência instalada GD', descricao: 'Potência instalada de geração distribuída (ANEEL)', tipo: 'beneficio', peso: 0.25, unidade: 'kW' },
  { nome: 'Unidades geradoras GD', descricao: 'Nº de unidades de geração distribuída (ANEEL)', tipo: 'beneficio', peso: 0.25, unidade: 'un' },
];

/**
 * Cria critérios padrão (se não existirem), busca indicadores do IBGE e ANEEL,
 * e grava tudo na tabela MatrizDecisao para alimentar o motor TOPSIS.
 *
 * @param {string} uf - Sigla do estado
 * @param {number} [limite=10] - Máx. municípios por chamada (evita timeout no Vercel)
 */
async function popularDados(uf, limite = 10) {
  // 1. Garantir critérios padrão no banco
  const criterios = [];
  for (const def of CRITERIOS_PADRAO) {
    let c = await prisma.criterio.findFirst({ where: { nome: def.nome } });
    if (!c) c = await prisma.criterio.create({ data: def });
    criterios.push(c);
  }

  // 2. Pegar municípios sem dados na MatrizDecisao (processamento incremental)
  const municipios = await prisma.municipio.findMany({
    where: {
      uf: uf.toUpperCase(),
      codigoIbge: { not: null },
      matrizDecisao: { none: {} },
    },
    take: limite,
  });

  if (municipios.length === 0) {
    // Se não há novos, verificar total para feedback
    const total = await prisma.municipio.count({ where: { uf: uf.toUpperCase() } });
    return {
      criterios: criterios.length,
      municipiosProcessados: 0,
      municipiosTotal: total,
      completo: true,
      mensagem: 'Todos os municípios já possuem dados.',
    };
  }

  // 3. Buscar dados ANEEL para a UF inteira (uma chamada)
  const dadosAneel = await buscarDadosANEEL(uf);

  // 4. Processar cada município
  const anoRef = new Date().getFullYear();
  let processados = 0;
  const erros = [];

  for (const mun of municipios) {
    try {
      const ibge = await buscarIndicadoresIBGE(mun.codigoIbge);
      const aneel = dadosAneel[mun.codigoIbge] || { potenciaInstalada: 0, unidadesGeradoras: 0 };

      const valores = [
        { criterioId: criterios[0].id, valor: ibge.populacao || 0 },
        { criterioId: criterios[1].id, valor: ibge.pibPerCapita || 0 },
        { criterioId: criterios[2].id, valor: aneel.potenciaInstalada },
        { criterioId: criterios[3].id, valor: aneel.unidadesGeradoras },
      ];

      for (const v of valores) {
        await prisma.matrizDecisao.upsert({
          where: {
            municipioId_criterioId_anoReferencia: {
              municipioId: mun.id,
              criterioId: v.criterioId,
              anoReferencia: anoRef,
            },
          },
          update: { valor: v.valor },
          create: {
            municipioId: mun.id,
            criterioId: v.criterioId,
            valor: v.valor,
            anoReferencia: anoRef,
          },
        });
      }

      if (ibge.populacao) {
        await prisma.municipio.update({
          where: { id: mun.id },
          data: { populacao: ibge.populacao },
        });
      }

      processados++;
    } catch (err) {
      erros.push({ municipio: mun.nome, erro: err.message });
    }
  }

  const totalRestante = await prisma.municipio.count({
    where: { uf: uf.toUpperCase(), codigoIbge: { not: null }, matrizDecisao: { none: {} } },
  });

  return {
    criterios: criterios.length,
    municipiosProcessados: processados,
    municipiosRestantes: totalRestante,
    completo: totalRestante === 0,
    fontes: {
      ibge: ['população', 'PIB per capita'],
      aneel: [`geração distribuída (${Object.keys(dadosAneel).length} municípios com dados)`],
    },
    erros: erros.length > 0 ? erros : undefined,
  };
}

module.exports = {
  buscarMunicipiosIBGE,
  buscarIndicadoresIBGE,
  importarMunicipiosUF,
  buscarDadosANEEL,
  popularDados,
};
