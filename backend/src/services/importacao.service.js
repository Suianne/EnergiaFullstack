// Integração com as fontes externas (IBGE e ANEEL/SIGA) e gravação dos dados
// na MatrizDecisao, que alimenta o motor TOPSIS.
//
// Regra central: todo município cadastrado (manual ou em lote) já nasce com os
// dados das APIs. Se a ANEEL estiver fora do ar, o município fica com
// geracaoRenovavel = null ("não consultado") e NÃO é marcado como "sem geração";
// o valor 0 só é gravado quando a ANEEL respondeu e não há usina renovável.

const prisma = require('../config/database');
const { ErroHttp } = require('../middleware/errorHandler');
const { INCLUDE_VALORES, mapearMunicipio } = require('./municipio.mapper');

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api';
const ANEEL_BASE = 'https://dadosabertos.aneel.gov.br/api/3/action';
// Resource do SIGA (Sistema de Informações de Geração da ANEEL) com todas as usinas do Brasil
const SIGA_RESOURCE = '11ec447d-698d-4ab8-977f-b424d5deee6a';
const ANEEL_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 horas
const CONCORRENCIA = 3; // municípios processados em paralelo na importação em lote

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

// ═══════════════════════════════════════════════════════════════
//  Utilitários
// ═══════════════════════════════════════════════════════════════

function validarUF(uf) {
  const sigla = String(uf || '').trim().toUpperCase();
  if (!UFS.includes(sigla)) throw new ErroHttp(`UF inválida: "${uf}".`, 400);
  return sigla;
}

function validarCodigoIbge(codigo) {
  const texto = String(codigo ?? '').trim();
  if (!/^\d{7}$/.test(texto)) throw new ErroHttp('"codigoIbge" deve ter exatamente 7 dígitos.', 400);
  return texto;
}

// "Canindé de São Francisco" -> "caninde de sao francisco" (para casar nomes entre IBGE e ANEEL)
function normalizarNome(nome) {
  return String(nome || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// A ANEEL devolve números como "3162000,00" (vírgula decimal) ou "3162000".
function parseNumeroANEEL(valor) {
  if (valor == null) return 0;
  const texto = String(valor).trim();
  if (!texto) return 0;
  const numero = texto.includes(',')
    ? parseFloat(texto.replace(/\./g, '').replace(',', '.'))
    : parseFloat(texto);
  return Number.isFinite(numero) ? numero : 0;
}

async function fetchJson(url, { timeoutMs = 25000, descricao = 'API externa', accept = 'application/json' } = {}) {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controle.signal, headers: { Accept: accept } });
    if (!res.ok) throw new ErroHttp(`${descricao} respondeu HTTP ${res.status}.`, 502);
    return await res.json();
  } catch (err) {
    if (err instanceof ErroHttp) throw err;
    const motivo = err.name === 'AbortError' ? 'tempo de resposta esgotado' : err.message;
    throw new ErroHttp(`${descricao} indisponível (${motivo}).`, 502);
  } finally {
    clearTimeout(timer);
  }
}

async function processarEmLotes(itens, tamanho, fn) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(fn));
  }
}

// ═══════════════════════════════════════════════════════════════
//  IBGE — Municípios, indicadores e coordenadas
// ═══════════════════════════════════════════════════════════════

function extrairUfIBGE(m) {
  return (
    m?.microrregiao?.mesorregiao?.UF?.sigla ||
    m?.['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla ||
    null
  );
}

async function buscarMunicipiosIBGE(uf) {
  const sigla = validarUF(uf);
  const dados = await fetchJson(`${IBGE_BASE}/v1/localidades/estados/${sigla}/municipios`, {
    descricao: 'IBGE (municípios)',
  });
  return dados
    .map((m) => ({ codigoIbge: String(m.id), nome: m.nome, uf: extrairUfIBGE(m) || sigla }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

// Devolve { codigoIbge, nome, uf } ou null quando o código não existe.
async function buscarMunicipioIBGE(codigoIbge) {
  const codigo = validarCodigoIbge(codigoIbge);
  const dados = await fetchJson(`${IBGE_BASE}/v1/localidades/municipios/${codigo}`, {
    descricao: 'IBGE (município)',
  });
  const m = Array.isArray(dados) ? dados[0] : dados;
  if (!m || !m.id) return null;
  return { codigoIbge: String(m.id), nome: m.nome, uf: extrairUfIBGE(m) };
}

/**
 * População estimada e PIB per capita de um município.
 * Indicador indisponível vem como null (não como 0): "sem dado" é diferente de "zero".
 */
async function buscarIndicadoresIBGE(codigoIbge) {
  const codigo = validarCodigoIbge(codigoIbge);
  const resultado = { populacao: null, anoPopulacao: null, pibPerCapita: null, anoPib: null, avisos: [] };

  const [pop, pib] = await Promise.all([
    // População estimada (pesquisa 6579, variável 9324)
    fetchJson(`${IBGE_BASE}/v3/agregados/6579/periodos/-1/variaveis/9324?localidades=N6[${codigo}]`, {
      descricao: 'IBGE (população)',
    }).catch((err) => {
      resultado.avisos.push(err.message);
      return null;
    }),
    // PIB per capita — API de Pesquisas (pesquisa 38, indicador 47001)
    fetchJson(`${IBGE_BASE}/v1/pesquisas/38/indicadores/47001/resultados/${codigo}`, {
      descricao: 'IBGE (PIB per capita)',
    }).catch((err) => {
      resultado.avisos.push(err.message);
      return null;
    }),
  ]);

  const seriePop = pop?.[0]?.resultados?.[0]?.series?.[0]?.serie || {};
  const anoPop = Object.keys(seriePop).filter((k) => seriePop[k] != null && seriePop[k] !== '...').sort().pop();
  if (anoPop) {
    const valor = parseInt(seriePop[anoPop], 10);
    if (Number.isFinite(valor)) {
      resultado.populacao = valor;
      resultado.anoPopulacao = Number(anoPop);
    }
  }

  const seriePib = pib?.[0]?.res?.[0]?.res || {};
  const anoPib = Object.keys(seriePib).filter((k) => seriePib[k] != null && seriePib[k] !== '-').sort().pop();
  if (anoPib) {
    const valor = parseFloat(seriePib[anoPib]);
    if (Number.isFinite(valor)) {
      resultado.pibPerCapita = valor;
      resultado.anoPib = Number(anoPib);
    }
  }

  return resultado;
}

/**
 * Coordenadas aproximadas (centro da malha do município) para o mapa.
 * Usa a malha em qualidade mínima (poucos vértices, ~0,5 KB).
 */
async function buscarCoordenadasIBGE(codigoIbge) {
  const codigo = validarCodigoIbge(codigoIbge);
  const geo = await fetchJson(
    `${IBGE_BASE}/v3/malhas/municipios/${codigo}?formato=application/vnd.geo+json&qualidade=minima`,
    { descricao: 'IBGE (malha)', accept: 'application/vnd.geo+json' },
  );
  const geometria = geo?.features?.[0]?.geometry ?? geo?.geometry;
  if (!geometria?.coordinates) return null;

  const pontos = [];
  const coletar = (c) => (typeof c[0] === 'number' ? pontos.push(c) : c.forEach(coletar));
  coletar(geometria.coordinates);
  if (!pontos.length) return null;

  const latitude = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
  const longitude = pontos.reduce((s, p) => s + p[0], 0) / pontos.length;
  return { latitude: +latitude.toFixed(6), longitude: +longitude.toFixed(6) };
}

// ═══════════════════════════════════════════════════════════════
//  ANEEL — SIGA (usinas de geração)
// ═══════════════════════════════════════════════════════════════

// Fonte renovável segundo a origem do combustível informada pela ANEEL.
// Hidrelétricas só contam quando são pequenas centrais (PCH) ou centrais geradoras (CGH);
// grandes usinas (UHE) ficam de fora.
function ehRenovavel(registro) {
  const origem = normalizarNome(registro.DscOrigemCombustivel);
  const tipo = String(registro.SigTipoGeracao || '').toUpperCase();
  if (['eolica', 'solar', 'biomassa', 'undi eletrica'].includes(origem)) return true;
  if (origem === 'hidrica' && ['PCH', 'CGH'].includes(tipo)) return true;
  return false;
}

function classificarFonte(registro) {
  const origem = normalizarNome(registro.DscOrigemCombustivel);
  if (origem === 'solar') return 'solar';
  if (origem === 'eolica') return 'eolica';
  if (origem === 'hidrica') return 'hidrica';
  if (origem === 'biomassa') return 'biomassa';
  return 'outras';
}

// "Piranhas - AL, Canindé de São Francisco - SE" -> [{ nome, uf }, { nome, uf }]
function extrairMunicipios(descricao) {
  return String(descricao || '')
    .split(',')
    .map((parte) => {
      const i = parte.lastIndexOf(' - ');
      if (i < 0) return null;
      return { nome: parte.slice(0, i).trim(), uf: parte.slice(i + 3).trim().toUpperCase() };
    })
    .filter((m) => m && m.nome && /^[A-Z]{2}$/.test(m.uf));
}

function fontesVazias() {
  return { solar: 0, eolica: 0, hidrica: 0, biomassa: 0, outras: 0 };
}

/**
 * Agrega os registros do SIGA por município da UF.
 * - Só usinas renováveis em operação.
 * - Usina que abrange vários municípios: a potência é rateada igualmente entre eles
 *   e a usina conta 1 para cada um.
 */
function agregarRegistrosANEEL(registros, uf) {
  const sigla = validarUF(uf);
  const porMunicipio = {};
  let usinasRenovaveis = 0;

  for (const r of registros) {
    if (normalizarNome(r.DscFaseUsina) !== 'operacao') continue;
    if (!ehRenovavel(r)) continue;

    const municipios = extrairMunicipios(r.DscMuninicpios);
    if (!municipios.length) continue;

    usinasRenovaveis += 1;
    const potencia = parseNumeroANEEL(r.MdaPotenciaFiscalizadaKw);
    const quota = potencia / municipios.length;
    const fonte = classificarFonte(r);

    for (const m of municipios) {
      if (m.uf !== sigla) continue;
      const chave = normalizarNome(m.nome);
      const atual = porMunicipio[chave] || (porMunicipio[chave] = {
        nome: m.nome, potenciaKw: 0, usinas: 0, fontes: fontesVazias(),
      });
      atual.potenciaKw += quota;
      atual.usinas += 1;
      atual.fontes[fonte] += 1;
    }
  }

  for (const m of Object.values(porMunicipio)) m.potenciaKw = +m.potenciaKw.toFixed(2);
  return { porMunicipio, usinasRenovaveis };
}

const cacheAneel = new Map();

/**
 * Busca (com cache de 6h por UF) e agrega as usinas renováveis em operação da UF.
 * Lança ErroHttp 502 se a ANEEL não responder — quem chama decide o que fazer.
 */
async function buscarDadosANEEL(uf, { forcar = false } = {}) {
  const sigla = validarUF(uf);
  const emCache = cacheAneel.get(sigla);
  if (!forcar && emCache && emCache.expiraEm > Date.now()) return emCache.dados;

  const registros = [];
  const limit = 1000;
  const filters = encodeURIComponent(JSON.stringify({ SigUFPrincipal: sigla, DscFaseUsina: 'Operação' }));

  for (let pagina = 0, offset = 0; pagina < 40; pagina++, offset += limit) {
    const url = `${ANEEL_BASE}/datastore_search?resource_id=${SIGA_RESOURCE}&filters=${filters}&limit=${limit}&offset=${offset}`;
    const data = await fetchJson(url, { descricao: 'ANEEL/SIGA' });
    if (!data.success) throw new ErroHttp('ANEEL/SIGA devolveu uma resposta sem sucesso.', 502);
    const lote = data.result?.records || [];
    registros.push(...lote);
    if (lote.length < limit) break;
  }

  const dados = {
    uf: sigla,
    ...agregarRegistrosANEEL(registros, sigla),
    registrosConsultados: registros.length,
    consultadoEm: new Date().toISOString(),
  };
  cacheAneel.set(sigla, { dados, expiraEm: Date.now() + ANEEL_CACHE_TTL_MS });
  return dados;
}

function dadosAneelDoMunicipio(dadosAneel, nome) {
  return dadosAneel?.porMunicipio?.[normalizarNome(nome)] || null;
}

function limparCacheANEEL() {
  cacheAneel.clear();
}

// ═══════════════════════════════════════════════════════════════
//  Critérios padrão
// ═══════════════════════════════════════════════════════════════

// Semântica do projeto: Ci mede VULNERABILIDADE energética (maior Ci = mais vulnerável).
// - beneficio: quanto maior o valor, maior a vulnerabilidade (ex.: população exposta).
// - custo: quanto maior o valor, menor a vulnerabilidade (ex.: PIB, geração renovável).
const CRITERIOS_PADRAO = [
  {
    chave: 'populacao',
    nome: 'População',
    descricao: 'População residente estimada (IBGE). Quanto maior, mais pessoas expostas.',
    tipo: 'beneficio',
    peso: 0.25,
    unidade: 'hab',
    fonte: 'IBGE',
  },
  {
    chave: 'pib_per_capita',
    nome: 'PIB per capita',
    descricao: 'PIB per capita municipal (IBGE). Quanto menor, maior a vulnerabilidade.',
    tipo: 'custo',
    peso: 0.25,
    unidade: 'R$',
    fonte: 'IBGE',
  },
  {
    chave: 'potencia_renovavel',
    nome: 'Potência renovável instalada',
    descricao: 'Potência fiscalizada das usinas renováveis em operação (ANEEL/SIGA). Quanto menor, maior a vulnerabilidade.',
    tipo: 'custo',
    peso: 0.25,
    unidade: 'kW',
    fonte: 'ANEEL',
  },
  {
    chave: 'usinas_renovaveis',
    nome: 'Usinas renováveis em operação',
    descricao: 'Quantidade de usinas renováveis em operação (ANEEL/SIGA). Quanto menor, maior a vulnerabilidade.',
    tipo: 'custo',
    peso: 0.25,
    unidade: 'un',
    fonte: 'ANEEL',
  },
];

/**
 * Garante que os critérios padrão existam. Não sobrescreve peso/tipo editados pelo usuário.
 * Devolve um mapa { chave: criterio }.
 */
async function garantirCriteriosPadrao() {
  const criterios = {};
  for (const def of CRITERIOS_PADRAO) {
    let c = await prisma.criterio.findUnique({ where: { chave: def.chave } });
    if (!c) {
      // Critério legado criado só pelo nome (antes da coluna "chave")
      const legado = await prisma.criterio.findFirst({ where: { nome: def.nome, chave: null } });
      c = legado
        ? await prisma.criterio.update({ where: { id: legado.id }, data: { chave: def.chave, fonte: def.fonte } })
        : await prisma.criterio.create({ data: def });
    }
    criterios[def.chave] = c;
  }
  return criterios;
}

// ═══════════════════════════════════════════════════════════════
//  Coleta e gravação dos dados de um município
// ═══════════════════════════════════════════════════════════════

/**
 * Busca tudo o que a MatrizDecisao precisa para um município.
 * `dadosAneel` é o agregado da UF (null quando a ANEEL está indisponível).
 */
async function coletarDadosMunicipio({ codigoIbge, nome, latitude, longitude }, dadosAneel) {
  const avisos = [];
  // Coordenadas já existentes (inclusive corrigidas à mão) são mantidas: só busca quando faltam.
  const precisaCoordenadas = latitude == null || longitude == null;

  const [indicadores, coordenadas] = await Promise.all([
    buscarIndicadoresIBGE(codigoIbge).catch((err) => {
      avisos.push(`IBGE (indicadores): ${err.message}`);
      return { populacao: null, pibPerCapita: null, anoPopulacao: null, anoPib: null, avisos: [] };
    }),
    precisaCoordenadas
      ? buscarCoordenadasIBGE(codigoIbge).catch((err) => {
        avisos.push(`IBGE (coordenadas): ${err.message}`);
        return null;
      })
      : Promise.resolve({ latitude: Number(latitude), longitude: Number(longitude) }),
  ]);
  avisos.push(...(indicadores.avisos || []));

  let aneel = null;
  if (dadosAneel) {
    aneel = dadosAneelDoMunicipio(dadosAneel, nome) || { nome, potenciaKw: 0, usinas: 0, fontes: fontesVazias() };
  }

  return { indicadores, coordenadas, aneel, avisos };
}

/**
 * Grava a coleta na MatrizDecisao (ano de referência = ano atual) e atualiza o município.
 * Só grava os critérios que tiveram resposta; os demais ficam "sem dado".
 */
async function gravarDadosMunicipio(municipio, coleta, criterios) {
  const anoReferencia = new Date().getFullYear();
  const valores = [];

  if (coleta.indicadores.populacao != null) valores.push([criterios.populacao.id, coleta.indicadores.populacao]);
  if (coleta.indicadores.pibPerCapita != null) valores.push([criterios.pib_per_capita.id, coleta.indicadores.pibPerCapita]);
  if (coleta.aneel) {
    valores.push([criterios.potencia_renovavel.id, coleta.aneel.potenciaKw]);
    valores.push([criterios.usinas_renovaveis.id, coleta.aneel.usinas]);
  }

  const upserts = valores.map(([criterioId, valor]) =>
    prisma.matrizDecisao.upsert({
      where: { municipioId_criterioId_anoReferencia: { municipioId: municipio.id, criterioId, anoReferencia } },
      update: { valor },
      create: { municipioId: municipio.id, criterioId, valor, anoReferencia },
    }),
  );

  const atualizacao = prisma.municipio.update({
    where: { id: municipio.id },
    data: {
      populacao: coleta.indicadores.populacao ?? municipio.populacao ?? null,
      latitude: coleta.coordenadas?.latitude ?? municipio.latitude ?? null,
      longitude: coleta.coordenadas?.longitude ?? municipio.longitude ?? null,
      geracaoRenovavel: coleta.aneel ? coleta.aneel.usinas > 0 : municipio.geracaoRenovavel ?? null,
      dadosAtualizadosEm: new Date(),
    },
  });

  await prisma.$transaction([...upserts, atualizacao]);
}

async function carregarMunicipio(id) {
  const m = await prisma.municipio.findUnique({ where: { id }, include: INCLUDE_VALORES });
  return m ? mapearMunicipio(m) : null;
}

function resumoColeta(coleta) {
  return {
    populacao: coleta.indicadores.populacao,
    pibPerCapita: coleta.indicadores.pibPerCapita,
    coordenadas: coleta.coordenadas,
    aneel: coleta.aneel
      ? { potenciaKw: coleta.aneel.potenciaKw, usinas: coleta.aneel.usinas, fontes: coleta.aneel.fontes }
      : null,
  };
}

const AVISO_ANEEL = 'ANEEL/SIGA indisponível no momento: a geração renovável não foi consultada. Use "Atualizar dados" mais tarde.';

/**
 * Cadastra um município pelo código IBGE já com os dados do IBGE e da ANEEL.
 */
async function cadastrarMunicipio({ codigoIbge }) {
  const codigo = validarCodigoIbge(codigoIbge);

  const existente = await prisma.municipio.findUnique({ where: { codigoIbge: codigo } });
  if (existente) throw new ErroHttp(`Município já cadastrado: ${existente.nome} - ${existente.uf}.`, 409);

  const ibge = await buscarMunicipioIBGE(codigo);
  if (!ibge) throw new ErroHttp('Código IBGE não encontrado.', 404);
  if (!ibge.uf) throw new ErroHttp('IBGE não informou a UF do município.', 502);

  const avisos = [];
  const [criterios, dadosAneel] = await Promise.all([
    garantirCriteriosPadrao(),
    buscarDadosANEEL(ibge.uf).catch((err) => {
      avisos.push(`${AVISO_ANEEL} (${err.message})`);
      return null;
    }),
  ]);

  const coleta = await coletarDadosMunicipio(ibge, dadosAneel);
  const municipio = await prisma.municipio.create({
    data: { nome: ibge.nome, uf: ibge.uf, codigoIbge: ibge.codigoIbge },
  });
  await gravarDadosMunicipio(municipio, coleta, criterios);

  return {
    municipio: await carregarMunicipio(municipio.id),
    coleta: resumoColeta(coleta),
    avisos: [...avisos, ...coleta.avisos],
  };
}

/**
 * Reconsulta IBGE e ANEEL para um município já cadastrado.
 */
async function atualizarDadosMunicipio(id, { forcarAneel = false } = {}) {
  const municipio = await prisma.municipio.findUnique({ where: { id } });
  if (!municipio) throw new ErroHttp('Município não encontrado.', 404);

  const avisos = [];
  const [criterios, dadosAneel] = await Promise.all([
    garantirCriteriosPadrao(),
    buscarDadosANEEL(municipio.uf, { forcar: forcarAneel }).catch((err) => {
      avisos.push(`${AVISO_ANEEL} (${err.message})`);
      return null;
    }),
  ]);

  const coleta = await coletarDadosMunicipio(municipio, dadosAneel);
  await gravarDadosMunicipio(municipio, coleta, criterios);

  return {
    municipio: await carregarMunicipio(id),
    coleta: resumoColeta(coleta),
    avisos: [...avisos, ...coleta.avisos],
  };
}

// ═══════════════════════════════════════════════════════════════
//  Importação em lote por UF
// ═══════════════════════════════════════════════════════════════

/**
 * Importa os municípios da UF que ainda não estão no banco, já com dados IBGE + ANEEL.
 * Processa no máximo `limite` por chamada (evita estourar o tempo limite do Vercel);
 * o cliente chama repetidamente até `completo` ser true.
 */
async function importarMunicipiosUF(uf, limite = 10) {
  const sigla = validarUF(uf);
  const lista = await buscarMunicipiosIBGE(sigla);
  const existentes = new Set(
    (await prisma.municipio.findMany({ where: { uf: sigla }, select: { codigoIbge: true } })).map((m) => m.codigoIbge),
  );
  const pendentes = lista.filter((m) => !existentes.has(m.codigoIbge));
  const lote = pendentes.slice(0, limite);

  const base = { uf: sigla, totalIbge: lista.length, jaExistiam: existentes.size, importados: 0, erros: [], avisos: [] };
  if (!lote.length) return { ...base, restantes: 0, completo: true };

  const [criterios, dadosAneel] = await Promise.all([
    garantirCriteriosPadrao(),
    buscarDadosANEEL(sigla).catch((err) => {
      base.avisos.push(`${AVISO_ANEEL} (${err.message})`);
      return null;
    }),
  ]);

  await processarEmLotes(lote, CONCORRENCIA, async (m) => {
    try {
      const coleta = await coletarDadosMunicipio(m, dadosAneel);
      const municipio = await prisma.municipio.create({
        data: { nome: m.nome, uf: m.uf, codigoIbge: m.codigoIbge },
      });
      await gravarDadosMunicipio(municipio, coleta, criterios);
      base.importados += 1;
    } catch (err) {
      base.erros.push({ municipio: m.nome, erro: err.message });
    }
  });

  const restantes = pendentes.length - base.importados;
  return { ...base, restantes, completo: restantes === 0 };
}

/**
 * Reprocessa municípios da UF que estão sem algum dado (ANEEL não consultada
 * ou critério sem valor). Também incremental.
 */
async function atualizarDadosUF(uf, limite = 10) {
  const sigla = validarUF(uf);
  const criterios = await garantirCriteriosPadrao();
  const idsCriterios = Object.values(criterios).map((c) => c.id);

  const incluirValores = { matrizDecisao: { select: { criterioId: true } } };
  const estaPendente = (m) =>
    m.geracaoRenovavel === null || idsCriterios.some((id) => !m.matrizDecisao.some((v) => v.criterioId === id));

  const municipios = await prisma.municipio.findMany({
    where: { uf: sigla },
    include: incluirValores,
    orderBy: { nome: 'asc' },
  });
  const pendentes = municipios.filter(estaPendente);
  const lote = pendentes.slice(0, limite);

  const base = {
    uf: sigla, total: municipios.length, pendentes: pendentes.length, atualizados: 0, semMudanca: 0, erros: [], avisos: [],
  };
  if (!lote.length) return { ...base, restantes: 0, completo: true };

  const dadosAneel = await buscarDadosANEEL(sigla).catch((err) => {
    base.avisos.push(`${AVISO_ANEEL} (${err.message})`);
    return null;
  });

  await processarEmLotes(lote, CONCORRENCIA, async (m) => {
    try {
      const coleta = await coletarDadosMunicipio(m, dadosAneel);
      await gravarDadosMunicipio(m, coleta, criterios);
      // Só conta como atualizado quem deixou de estar pendente; se as fontes não
      // responderam, o município continua pendente e o cliente não fica em loop.
      const depois = await prisma.municipio.findUnique({ where: { id: m.id }, include: incluirValores });
      if (depois && !estaPendente(depois)) base.atualizados += 1;
      else base.semMudanca += 1;
    } catch (err) {
      base.erros.push({ municipio: m.nome, erro: err.message });
    }
  });

  const restantes = pendentes.length - base.atualizados;
  return { ...base, restantes, completo: restantes === 0 };
}

module.exports = {
  UFS,
  CRITERIOS_PADRAO,
  validarUF,
  validarCodigoIbge,
  normalizarNome,
  parseNumeroANEEL,
  ehRenovavel,
  extrairMunicipios,
  agregarRegistrosANEEL,
  buscarMunicipiosIBGE,
  buscarMunicipioIBGE,
  buscarIndicadoresIBGE,
  buscarCoordenadasIBGE,
  buscarDadosANEEL,
  dadosAneelDoMunicipio,
  limparCacheANEEL,
  garantirCriteriosPadrao,
  cadastrarMunicipio,
  atualizarDadosMunicipio,
  importarMunicipiosUF,
  atualizarDadosUF,
};
