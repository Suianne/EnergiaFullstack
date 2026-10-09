// Gera relatórios (CSV e PDF) a partir de um ranking JÁ CALCULADO.
// Não sabe de onde o ranking veio (requisição, banco...), por isso serve para qualquer rota.

const PDFDocument = require('pdfkit');
const { faixaVulnerabilidade } = require('./topsis.service');

const SEPARADOR = ';';
const BOM = '\uFEFF'; // marca o arquivo como UTF-8; sem ela o Excel quebra os acentos
const QUEBRA_DE_LINHA = '\r\n';

function formatarNumero(numero, casas = 4) {
  return Number.isFinite(numero) ? numero.toFixed(casas).replace('.', ',') : '-';
}

function formatarInteiro(numero) {
  if (!Number.isFinite(numero)) return '-';
  return String(Math.round(numero)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function escaparCampo(valor) {
  let texto = String(valor);

  // Proteção contra "injeção de fórmula": no Excel, uma célula começando com = + - @
  // pode ser executada como fórmula. Um apóstrofo na frente faz o Excel tratá-la como texto.
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;

  // Se o texto contém ; " ou quebra de linha, vai entre aspas (e aspas internas são dobradas).
  if (/[;"\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`;

  return texto;
}

/**
 * @param {{posicao:number, alternativa:string, ci:number, distanciaPositiva:number, distanciaNegativa:number}[]} ranking
 * @returns {string} conteúdo do arquivo CSV
 */
function gerarCsvRanking(ranking) {
  const cabecalho = ['Posição', 'Alternativa', 'Ci', 'Distância ao ideal (D+)', 'Distância ao pior (D-)'];

  const linhas = ranking.map((r) => [
    r.posicao,
    r.alternativa,
    formatarNumero(r.ci),
    formatarNumero(r.distanciaPositiva),
    formatarNumero(r.distanciaNegativa),
  ]);

  const texto = [cabecalho, ...linhas]
    .map((linha) => linha.map(escaparCampo).join(SEPARADOR))
    .join(QUEBRA_DE_LINHA);

  return BOM + texto + QUEBRA_DE_LINHA;
}

// ═══════════════════════════════════════════════════════════════
//  PDF
// ═══════════════════════════════════════════════════════════════

const CORES = {
  texto: '#1f2937',
  suave: '#6b7280',
  linha: '#d5ddd7',
  cabecalho: '#dff2e5',
  zebra: '#f5f7f5',
  primaria: '#176b3a',
  alta: '#dc2626',
  media: '#d97706',
  baixa: '#16a34a',
};

const corFaixa = (faixa) => ({ Alta: CORES.alta, Média: CORES.media, Baixa: CORES.baixa }[faixa] || CORES.texto);

// Corta o texto para caber na largura da coluna, acrescentando "…".
function truncar(doc, texto, largura) {
  let t = String(texto ?? '');
  if (doc.widthOfString(t) <= largura) return t;
  while (t.length > 1 && doc.widthOfString(`${t}…`) > largura) t = t.slice(0, -1);
  return `${t}…`;
}

/**
 * Desenha uma tabela simples com cabeçalho repetido a cada página.
 * coluna = { titulo, largura, chave | valor(linha), alinhar?, cor?(linha) }
 */
function desenharTabela(doc, colunas, linhas, { alturaLinha = 16, fonte = 8.5 } = {}) {
  const x0 = doc.page.margins.left;
  const larguraTotal = colunas.reduce((s, c) => s + c.largura, 0);
  const limiteY = () => doc.page.height - doc.page.margins.bottom - alturaLinha;

  const cabecalho = () => {
    const y = doc.y;
    doc.save().rect(x0, y, larguraTotal, alturaLinha).fill(CORES.cabecalho).restore();
    doc.font('Helvetica-Bold').fontSize(fonte).fillColor(CORES.texto);
    let x = x0;
    for (const c of colunas) {
      doc.text(c.titulo, x + 3, y + 4, { width: c.largura - 6, align: c.alinhar || 'left', lineBreak: false });
      x += c.largura;
    }
    doc.y = y + alturaLinha;
  };

  if (doc.y > limiteY() - alturaLinha) doc.addPage();
  cabecalho();

  linhas.forEach((linha, i) => {
    if (doc.y > limiteY()) {
      doc.addPage();
      cabecalho();
    }
    const y = doc.y;
    if (i % 2 === 1) doc.save().rect(x0, y, larguraTotal, alturaLinha).fill(CORES.zebra).restore();
    doc.font('Helvetica').fontSize(fonte);
    let x = x0;
    for (const c of colunas) {
      const bruto = typeof c.valor === 'function' ? c.valor(linha) : linha[c.chave];
      const cor = typeof c.cor === 'function' ? c.cor(linha) : CORES.texto;
      const texto = truncar(doc, bruto == null || bruto === '' ? '-' : bruto, c.largura - 6);
      doc.fillColor(cor).text(texto, x + 3, y + 4, { width: c.largura - 6, align: c.alinhar || 'left', lineBreak: false });
      x += c.largura;
    }
    doc.y = y + alturaLinha;
  });

  doc.save().moveTo(x0, doc.y).lineTo(x0 + larguraTotal, doc.y).lineWidth(0.5).strokeColor(CORES.linha).stroke().restore();
  doc.x = x0;
  doc.fillColor(CORES.texto).moveDown(1);
}

function tituloSecao(doc, texto) {
  const x0 = doc.page.margins.left;
  if (doc.y > doc.page.height - doc.page.margins.bottom - 60) doc.addPage();
  doc.x = x0;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(CORES.primaria).text(texto);
  doc.moveDown(0.4);
  doc.font('Helvetica').fontSize(9).fillColor(CORES.texto);
}

function descreverGeracao(valor) {
  if (valor === true) return 'Sim';
  if (valor === false) return 'Não';
  return 'Não consultada';
}

/**
 * Gera um PDF com o ranking TOPSIS.
 *
 * @param {object} relatorio
 * @param {{posicao:number, alternativa:string, uf?:string, ci:number, distanciaPositiva:number,
 *          distanciaNegativa:number, geracaoRenovavel?:boolean|null}[]} relatorio.ranking
 * @param {{nome:string, tipo:string, peso:number, unidade?:string, fonte?:string}[]} [relatorio.criterios]
 * @param {{nome:string, uf?:string, motivo:string}[]} [relatorio.excluidos]
 * @param {{simulacaoId?:number, data?:Date|string, usuario?:string}} [relatorio.meta]
 * @returns {PDFDocument} stream que pode ser enviado direto na resposta HTTP
 */
function gerarPdfRanking({ ranking = [], criterios = [], excluidos = [], meta = {} }) {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
    info: { Title: 'Relatório TOPSIS - Vulnerabilidade energética', Author: 'Plataforma de Energia Renovável' },
  });
  const x0 = doc.page.margins.left;
  const largura = doc.page.width - x0 - doc.page.margins.right;

  // Título
  doc.font('Helvetica-Bold').fontSize(18).fillColor(CORES.primaria)
    .text('Relatório TOPSIS', x0, doc.y, { width: largura, align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor(CORES.suave)
    .text('Ranking de vulnerabilidade social energética dos municípios', { width: largura, align: 'center' });
  doc.moveDown(1.2);

  // Metadados
  const data = meta.data ? new Date(meta.data) : new Date();
  doc.fontSize(9).fillColor(CORES.texto);
  doc.text(`Gerado em: ${data.toLocaleString('pt-BR')}`);
  if (meta.simulacaoId) doc.text(`Simulação nº ${meta.simulacaoId}`);
  if (meta.usuario) doc.text(`Responsável: ${meta.usuario}`);
  doc.text(
    `Municípios no ranking: ${ranking.length}` +
      (excluidos.length ? `   |   Fora do ranking por falta de dados: ${excluidos.length}` : ''),
  );
  doc.moveDown(1);

  // Interpretação
  tituloSecao(doc, 'Como ler o índice Ci');
  doc.text(
    'O Ci varia de 0 a 1 e mede a vulnerabilidade energética: quanto MAIOR o Ci, MAIS vulnerável é o município ' +
      'e maior a prioridade de intervenção. Faixas: Alta (Ci ≥ 0,66), Média (0,33 ≤ Ci < 0,66) e Baixa (Ci < 0,33). ' +
      'Municípios sem geração renovável constatada pela ANEEL/SIGA recebem valor zero nos critérios de geração ' +
      '(tipo custo) e, por isso, tendem às posições mais altas do ranking. Municípios sem dados em algum critério ' +
      'ficam fora do ranking: ausência de dado não é tratada como zero.',
    { width: largura, align: 'justify' },
  );
  doc.moveDown(1);

  // Critérios
  if (criterios.length) {
    tituloSecao(doc, 'Critérios e pesos');
    desenharTabela(doc, [
      { titulo: 'Critério', largura: 200, chave: 'nome' },
      { titulo: 'Tipo', largura: 70, valor: (c) => (c.tipo === 'custo' ? 'Custo' : 'Benefício') },
      { titulo: 'Peso', largura: 60, valor: (c) => formatarNumero(Number(c.peso), 3), alinhar: 'right' },
      { titulo: 'Unidade', largura: 60, chave: 'unidade' },
      { titulo: 'Fonte', largura: 125, chave: 'fonte' },
    ], criterios);
  }

  // Resumo
  if (ranking.length) {
    const mais = ranking[0];
    const menos = ranking[ranking.length - 1];
    const media = ranking.reduce((s, r) => s + r.ci, 0) / ranking.length;
    const porFaixa = ranking.reduce((acc, r) => {
      const f = faixaVulnerabilidade(r.ci);
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});
    const semGeracao = ranking.filter((r) => r.geracaoRenovavel === false).length;

    tituloSecao(doc, 'Resumo');
    doc.text(`Mais vulnerável: ${mais.alternativa}${mais.uf ? ` - ${mais.uf}` : ''} (Ci ${formatarNumero(mais.ci)})`);
    doc.text(`Menos vulnerável: ${menos.alternativa}${menos.uf ? ` - ${menos.uf}` : ''} (Ci ${formatarNumero(menos.ci)})`);
    doc.text(`Ci médio: ${formatarNumero(media)}`);
    doc.text(
      `Faixas: Alta ${formatarInteiro(porFaixa.Alta || 0)}  |  Média ${formatarInteiro(porFaixa['Média'] || 0)}  |  Baixa ${formatarInteiro(porFaixa.Baixa || 0)}`,
    );
    doc.text(`Municípios sem geração renovável constatada (ANEEL): ${formatarInteiro(semGeracao)}`);
    doc.moveDown(1);
  }

  // Ranking
  tituloSecao(doc, 'Ranking');
  desenharTabela(doc, [
    { titulo: '#', largura: 28, chave: 'posicao', alinhar: 'right' },
    { titulo: 'Município', largura: 165, chave: 'alternativa' },
    { titulo: 'UF', largura: 28, chave: 'uf' },
    { titulo: 'Ci', largura: 52, valor: (r) => formatarNumero(r.ci), alinhar: 'right' },
    { titulo: 'Faixa', largura: 50, valor: (r) => faixaVulnerabilidade(r.ci), cor: (r) => corFaixa(faixaVulnerabilidade(r.ci)) },
    { titulo: 'Ger. renovável', largura: 78, valor: (r) => descreverGeracao(r.geracaoRenovavel) },
    { titulo: 'D+', largura: 57, valor: (r) => formatarNumero(r.distanciaPositiva), alinhar: 'right' },
    { titulo: 'D-', largura: 57, valor: (r) => formatarNumero(r.distanciaNegativa), alinhar: 'right' },
  ], ranking);

  // Excluídos
  if (excluidos.length) {
    tituloSecao(doc, 'Fora do ranking (sem dados)');
    desenharTabela(doc, [
      { titulo: 'Município', largura: 165, chave: 'nome' },
      { titulo: 'UF', largura: 28, chave: 'uf' },
      { titulo: 'Motivo', largura: 322, chave: 'motivo' },
    ], excluidos);
  }

  // Rodapé com numeração em todas as páginas
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);
    const margemInferior = doc.page.margins.bottom;
    doc.page.margins.bottom = 0; // evita quebra de página automática ao escrever no rodapé
    doc.font('Helvetica').fontSize(8).fillColor(CORES.suave).text(
      `Plataforma de Energia Renovável — Método TOPSIS   |   Página ${i - paginas.start + 1} de ${paginas.count}`,
      x0,
      doc.page.height - 28,
      { width: largura, align: 'center', lineBreak: false },
    );
    doc.page.margins.bottom = margemInferior;
  }

  doc.end();
  return doc;
}

/**
 * Converte uma simulação salva (com resultadosRanking + municipio) no formato do relatório.
 */
function montarRelatorioDaSimulacao(simulacao) {
  const parametros = simulacao.parametros || {};
  const nomesPorPosicao = Array.isArray(parametros.rankingAlternativas) ? parametros.rankingAlternativas : [];

  const ranking = (simulacao.resultadosRanking || []).map((r) => ({
    posicao: r.posicao,
    alternativa: r.municipio?.nome || nomesPorPosicao[r.posicao - 1] || `Alternativa ${r.posicao}`,
    uf: r.municipio?.uf || '',
    geracaoRenovavel: r.municipio ? r.municipio.geracaoRenovavel : null,
    ci: Number(r.coeficienteCi),
    distanciaPositiva: Number(r.distanciaPositiva),
    distanciaNegativa: Number(r.distanciaNegativa),
  }));

  return {
    ranking,
    criterios: Array.isArray(parametros.criterios) ? parametros.criterios : [],
    excluidos: Array.isArray(parametros.excluidos) ? parametros.excluidos : [],
    meta: { simulacaoId: simulacao.id, data: simulacao.dataExecucao, usuario: simulacao.usuario?.nome },
  };
}

module.exports = { gerarCsvRanking, gerarPdfRanking, montarRelatorioDaSimulacao };
