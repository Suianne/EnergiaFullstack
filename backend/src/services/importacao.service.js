const prisma = require('../config/database');

const IBGE_MUNICIPIOS_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';
const IBGE_MUNICIPIO_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/municipios';

/**
 * Busca todos os municípios de uma UF na API do IBGE.
 * @param {string} uf - Sigla do estado (ex: "BA")
 * @returns {Promise<Array>} Lista de municípios com id IBGE, nome e UF
 */
async function buscarMunicipiosIBGE(uf) {
  const url = `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Erro ao consultar IBGE: ${res.status}`);
  }

  const dados = await res.json();

  return dados.map((m) => ({
    ibge: String(m.id),
    nome: m.nome,
    uf: m.microrregiao.mesorregiao.UF.sigla,
  }));
}

/**
 * Busca indicadores socioeconômicos de um município na API do IBGE.
 * Usa a API de pesquisas do IBGE (Censo/PNAD).
 * @param {string} codigoIbge - Código IBGE do município (7 dígitos)
 */
async function buscarIndicadoresIBGE(codigoIbge) {
  // População estimada (pesquisa 6579, variável 9324)
  const urlPop = `https://servicodados.ibge.gov.br/api/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${codigoIbge}]`;

  try {
    const res = await fetch(urlPop);
    if (!res.ok) return { populacao: null };

    const dados = await res.json();
    const resultados = dados[0]?.resultados?.[0]?.series?.[0]?.serie || {};
    const ultimoAno = Object.keys(resultados).sort().pop();
    const populacao = ultimoAno ? parseInt(resultados[ultimoAno], 10) : null;

    return { populacao: Number.isFinite(populacao) ? populacao : null };
  } catch {
    return { populacao: null };
  }
}

/**
 * Importa municípios de uma UF do IBGE e salva no banco.
 * Pula municípios que já existem (mesmo nome + uf).
 * @param {string} uf - Sigla do estado
 * @returns {{ importados: number, ignorados: number }}
 */
async function importarMunicipiosUF(uf) {
  const municipiosIBGE = await buscarMunicipiosIBGE(uf.toUpperCase());

  let importados = 0;
  let ignorados = 0;

  for (const m of municipiosIBGE) {
    const existe = await prisma.municipio.findFirst({
      where: { nome: m.nome, uf: m.uf },
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
        populacao: indicadores.populacao,
      },
    });

    importados++;
  }

  return { importados, ignorados, total: municipiosIBGE.length };
}

module.exports = { buscarMunicipiosIBGE, buscarIndicadoresIBGE, importarMunicipiosUF };
