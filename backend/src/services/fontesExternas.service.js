// Acesso ao IBGE e à ANEEL + regras que transformam esses dados nos critérios do TOPSIS.
// Regra de ouro: se uma fonte falhar, lança ErroServicoExterno. Nunca devolve "vazio" no lugar de erro,
// porque vazio viraria zero na matriz e um município com ANEEL fora do ar pareceria "sem geração".

const { ErroServicoExterno } = require('../middleware/errorHandler');

const UF_CODES = {
  AC: '12', AL: '27', AM: '13', AP: '16', BA: '29', CE: '23', DF: '53', ES: '32',
  GO: '52', MA: '21', MG: '31', MS: '50', MT: '51', PA: '15', PB: '25', PE: '26',
  PI: '22', PR: '41', RJ: '33', RN: '24', RO: '11', RR: '14', RS: '43', SC: '42',
  SE: '28', SP: '35', TO: '17',
};

const TIMEOUT_MS = 30000;

/** "São Paulo" -> "SAO PAULO"; "Mogi-Guaçu" e "MOGI GUACU" -> "MOGI GUACU". */
function normalizarNome(nome) {
  return String(nome ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

async function buscarJson(url, fonte) {
  let res;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new ErroServicoExterno(`${fonte} não respondeu (${err.name === 'TimeoutError' ? 'tempo esgotado' : err.message}).`);
  }
  if (!res.ok) throw new ErroServicoExterno(`${fonte} respondeu com erro ${res.status}.`);
  try {
    return await res.json();
  } catch {
    throw new ErroServicoExterno(`${fonte} devolveu uma resposta inválida.`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  IBGE
// ═══════════════════════════════════════════════════════════════

function ufDoRegistroIBGE(m) {
  return (
    m.microrregiao?.mesorregiao?.UF?.sigla ??
    m['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ??
    null
  );
}

async function buscarMunicipiosIBGE(uf) {
  const dados = await buscarJson(
    `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`,
    'IBGE (municípios)',
  );
  return dados.map((m) => ({ ibge: String(m.id), nome: m.nome, uf: ufDoRegistroIBGE(m) ?? uf }));
}

/** Um município pelo código IBGE. Devolve null se o código não existe. */
async function buscarMunicipioIBGE(codigoIbge) {
  const dados = await buscarJson(
    `https://servicodados.ibge.gov.br/api/v1/localidades/municipios/${codigoIbge}`,
    'IBGE (município)',
  );
  const m = Array.isArray(dados) ? dados[0] : dados;
  if (!m || !m.id) return null;
  const uf = ufDoRegistroIBGE(m);
  if (!uf) throw new ErroServicoExterno('IBGE não informou a UF do município.');
  return { ibge: String(m.id), nome: m.nome, uf };
}

/** Indicador do IBGE (API de agregados). `localidades` pode ser uma UF inteira ou um município. */
async function buscarAgregado(tabela, variavel, localidades) {
  const dados = await buscarJson(
    `https://servicodados.ibge.gov.br/api/v3/agregados/${tabela}/periodos/-1/variaveis/${variavel}?localidades=${localidades}`,
    `IBGE (agregado ${tabela})`,
  );
  const resultado = {};
  const series = dados[0]?.resultados?.[0]?.series || [];
  for (const s of series) {
    const id = s.localidade?.id;
    const serie = s.serie || {};
    const ano = Object.keys(serie)
      .filter((k) => serie[k] != null && serie[k] !== '...' && serie[k] !== '-')
      .sort()
      .pop();
    if (!ano) continue;
    const valor = parseFloat(String(serie[ano]).replace(',', '.'));
    if (id && Number.isFinite(valor)) resultado[id] = valor;
  }
  return resultado;
}

// A tabela 5938, variável 37, é o PIB TOTAL em mil reais (não o per capita).
// O per capita é calculado aqui: PIB * 1000 / população.
const PIB_MIL_REAIS = 1000;

async function indicadoresIBGE(localidades) {
  const [populacao, pibMil] = await Promise.all([
    buscarAgregado('6579', '9324', localidades), // população residente estimada
    buscarAgregado('5938', '37', localidades), // PIB a preços correntes (mil R$)
  ]);
  const resultado = {};
  for (const [codigo, pop] of Object.entries(populacao)) {
    const pib = pibMil[codigo];
    resultado[codigo] = {
      populacao: Math.round(pop),
      pibPerCapita: pib != null && pop > 0 ? (pib * PIB_MIL_REAIS) / pop : null,
    };
  }
  return resultado;
}

const indicadoresIBGEPorUF = (uf) => indicadoresIBGE(`N6[N3[${UF_CODES[uf]}]]`);
const indicadoresIBGEPorMunicipio = (codigoIbge) => indicadoresIBGE(`N6[${codigoIbge}]`);

// ═══════════════════════════════════════════════════════════════
//  ANEEL — SIGA (geração renovável em operação)
// ═══════════════════════════════════════════════════════════════

const ANEEL_BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';
const SIGA_RESOURCE = '11ec447d-698d-4ab8-977f-b424d5deee6a';
const TIPOS_RENOVAVEIS = ['UFV', 'EOL', 'PCH', 'CGH', 'CGU'];
const LIMITE_PAGINA = 1000;
const MAX_PAGINAS = 200;
const CACHE_ANEEL_MS = 30 * 60 * 1000;

const cacheAneel = new Map();

/**
 * Soma, por município da UF, a potência (kW) e o nº de usinas renováveis em operação.
 * Usina que atende vários municípios tem a potência dividida entre eles.
 * Retorna { porMunicipio: { NOME_NORMALIZADO: { potenciaKw, usinas } }, registros }.
 */
async function buscarDadosANEEL(uf) {
  const ufSafe = uf.toUpperCase().replace(/[^A-Z]/g, '');
  const emCache = cacheAneel.get(ufSafe);
  if (emCache && Date.now() - emCache.em < CACHE_ANEEL_MS) return emCache.dados;

  const filtros = JSON.stringify({
    SigUFPrincipal: ufSafe,
    DscFaseUsina: 'Operação',
    SigTipoGeracao: TIPOS_RENOVAVEIS,
  });
  const porMunicipio = {};
  let registros = 0;
  let terminou = false;

  for (let pagina = 0; pagina < MAX_PAGINAS && !terminou; pagina++) {
    const url = `${ANEEL_BASE}/datastore_search?resource_id=${SIGA_RESOURCE}&filters=${encodeURIComponent(filtros)}&limit=${LIMITE_PAGINA}&offset=${pagina * LIMITE_PAGINA}`;
    const data = await buscarJson(url, 'ANEEL (SIGA)');
    if (!data.success) throw new ErroServicoExterno('ANEEL (SIGA) recusou a consulta.');
    const lista = data.result?.records || [];
    registros += lista.length;
    acumularRegistrosANEEL(lista, porMunicipio);
    terminou = lista.length < LIMITE_PAGINA;
  }
  if (!terminou) {
    // Dados cortados fariam municípios com geração parecerem "sem geração".
    throw new ErroServicoExterno('ANEEL (SIGA): volume de dados acima do limite; consulta cancelada para não gravar valores incompletos.');
  }

  const dados = { porMunicipio, registros };
  cacheAneel.set(ufSafe, { em: Date.now(), dados });
  return dados;
}

function acumularRegistrosANEEL(registros, porMunicipio) {
  for (const r of registros) {
    if (!TIPOS_RENOVAVEIS.includes(r.SigTipoGeracao)) continue;
    if (r.DscFaseUsina !== 'Operação') continue;

    // "Mun1/Mun2 - UF" -> ["Mun1", "Mun2"]
    const nomes = String(r.DscMuninicpios || '').split(' - ')[0].split('/').map(normalizarNome).filter(Boolean);
    if (nomes.length === 0) continue;

    const potencia = parseFloat(String(r.MdaPotenciaFiscalizadaKw ?? '0').replace(',', '.')) || 0;
    for (const nome of nomes) {
      const atual = (porMunicipio[nome] ??= { potenciaKw: 0, usinas: 0 });
      atual.potenciaKw += potencia / nomes.length;
      atual.usinas += 1;
    }
  }
}

/**
 * Situação do município na ANEEL. Só é chamada com a consulta já concluída com sucesso,
 * então "não aparece" significa de fato "nenhuma geração renovável constatada".
 */
function geracaoDoMunicipio(nome, dadosAneel) {
  return dadosAneel.porMunicipio[normalizarNome(nome)] ?? { potenciaKw: 0, usinas: 0 };
}

// ═══════════════════════════════════════════════════════════════
//  Critérios do TOPSIS
// ═══════════════════════════════════════════════════════════════
// Convenção: MAIOR Ci = MAIOR vulnerabilidade (é assim que o front colore e ordena).
//  - população: quanto mais gente, mais prioridade            -> benefício
//  - PIB per capita: quanto menor, mais vulnerável            -> custo
//  - geração renovável: quanto MENOS geração, mais vulnerável -> custo
//    (município sem geração fica no ideal e sobe no ranking; antes era "benefício"
//     e o município sem geração caía na faixa de menor vulnerabilidade)
// A geração entra POR HABITANTE: o valor absoluto só premiaria cidades grandes.

const CRITERIOS_PADRAO = [
  { codigo: 'populacao', nome: 'População', descricao: 'População residente estimada (IBGE)', tipo: 'beneficio', peso: 0.25, unidade: 'hab' },
  { codigo: 'pib_per_capita', nome: 'PIB per capita', descricao: 'PIB municipal / população (IBGE)', tipo: 'custo', peso: 0.25, unidade: 'R$' },
  { codigo: 'potencia_renovavel_per_capita', nome: 'Potência renovável por habitante', descricao: 'Potência instalada de geração renovável em operação / população (ANEEL/SIGA)', tipo: 'custo', peso: 0.25, unidade: 'W/hab' },
  { codigo: 'usinas_renovaveis_100mil', nome: 'Usinas renováveis por 100 mil hab.', descricao: 'Usinas renováveis em operação por 100 mil habitantes (ANEEL/SIGA)', tipo: 'custo', peso: 0.25, unidade: 'un/100 mil hab' },
];

/**
 * Valores da matriz de decisão de um município, por código de critério.
 * Devolve null quando falta população ou PIB: sem eles o município não entra no TOPSIS
 * (preferível a gravar 0 e distorcer o ranking).
 */
function calcularValoresCriterios({ populacao, pibPerCapita, potenciaKw, usinas }) {
  if (!(populacao > 0) || !Number.isFinite(pibPerCapita)) return null;
  return {
    populacao,
    pib_per_capita: pibPerCapita,
    potencia_renovavel_per_capita: (potenciaKw * 1000) / populacao,
    usinas_renovaveis_100mil: (usinas * 100000) / populacao,
  };
}

/** Município com a ANEEL consultada e nenhuma geração renovável constatada. */
function semGeracaoConstatada({ dadosAtualizadosEm, potenciaRenovavelKw, usinasRenovaveis }) {
  return !!dadosAtualizadosEm && Number(potenciaRenovavelKw) === 0 && Number(usinasRenovaveis) === 0;
}

module.exports = {
  limparCacheAneel: () => cacheAneel.clear(),
  UF_CODES,
  CRITERIOS_PADRAO,
  normalizarNome,
  buscarMunicipiosIBGE,
  buscarMunicipioIBGE,
  indicadoresIBGEPorUF,
  indicadoresIBGEPorMunicipio,
  buscarDadosANEEL,
  acumularRegistrosANEEL,
  geracaoDoMunicipio,
  calcularValoresCriterios,
  semGeracaoConstatada,
};
