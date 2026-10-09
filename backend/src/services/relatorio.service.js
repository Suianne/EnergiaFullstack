// Gera relatórios a partir de um ranking JÁ CALCULADO.
// Não sabe de onde o ranking veio (requisição, banco...), por isso serve para qualquer rota.

const PDFDocument = require('pdfkit');

const SEPARADOR = ';'; 
const BOM = '\uFEFF'; // marca o arquivo como UTF-8; sem ela o Excel quebra os acentos
const QUEBRA_DE_LINHA = '\r\n';

function formatarNumero(numero, casas = 4) {
  return numero.toFixed(casas).replace('.', ',');
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

/**
 * Gera um PDF com o ranking TOPSIS.
 * Retorna um stream (PDFDocument) que pode ser enviado direto na resposta HTTP.
 */
function gerarPdfRanking(ranking, parametros) {
  const doc = new PDFDocument({ margin: 50 });

  // Título
  doc.fontSize(18).text('Relatório TOPSIS', { align: 'center' });
  doc.fontSize(10).fillColor('#666666')
    .text(`Vulnerabilidade Social Energética — ${new Date().toLocaleDateString('pt-BR')}`, { align: 'center' });
  doc.moveDown(2);

  // Resumo
  doc.fontSize(12).fillColor('#000000').text('Resumo da simulação', { underline: true });
  doc.moveDown(0.5);
  doc.fontSize(10);
  doc.text(`Total de alternativas: ${ranking.length}`);
  if (ranking.length > 0) {
    const melhor = ranking[0];
    const pior = ranking[ranking.length - 1];
    doc.text(`Menos vulnerável: ${melhor.alternativa || `Alternativa ${melhor.posicao}`} (Ci: ${melhor.ci.toFixed(4)})`);
    doc.text(`Mais vulnerável: ${pior.alternativa || `Alternativa ${pior.posicao}`} (Ci: ${pior.ci.toFixed(4)})`);
  }
  doc.moveDown(1.5);

  // Tabela do ranking
  doc.fontSize(12).fillColor('#000000').text('Ranking', { underline: true });
  doc.moveDown(0.5);

  const colX = [50, 90, 250, 330, 410];
  const colTitulos = ['#', 'Alternativa', 'Ci', 'D+', 'D-'];

  // Cabeçalho da tabela
  doc.fontSize(9).fillColor('#333333');
  colTitulos.forEach((t, i) => doc.text(t, colX[i], doc.y, { continued: i < colTitulos.length - 1 }));
  doc.moveDown(0.3);

  const yLinha = doc.y;
  doc.moveTo(50, yLinha).lineTo(500, yLinha).strokeColor('#cccccc').stroke();
  doc.moveDown(0.3);

  // Linhas do ranking
  doc.fontSize(9).fillColor('#000000');
  ranking.forEach((r) => {
    if (doc.y > 700) doc.addPage();
    const y = doc.y;
    doc.text(String(r.posicao), colX[0], y);
    doc.text(r.alternativa || '-', colX[1], y);
    doc.text(r.ci.toFixed(4), colX[2], y);
    doc.text(r.distanciaPositiva.toFixed(4), colX[3], y);
    doc.text(r.distanciaNegativa.toFixed(4), colX[4], y);
    doc.moveDown(0.2);
  });

  // Rodapé
  doc.moveDown(2);
  doc.fontSize(8).fillColor('#999999')
    .text('Gerado pela Plataforma de Energia Renovável — Método TOPSIS', { align: 'center' });

  doc.end();
  return doc;
}

// ═══════════════════════════════════════════════════════════════
//  PDF do ranking de municípios (o mesmo que aparece na tela de Resultado)
// ═══════════════════════════════════════════════════════════════

// Mesmos limiares do front (utils/topsis.js). Maior Ci = maior vulnerabilidade.
function faixaDoCi(ci) {
  return ci >= 0.66 ? 'Alta' : ci >= 0.33 ? 'Média' : 'Baixa';
}

const COR_FAIXA = { Alta: '#B91C1C', 'Média': '#B45309', Baixa: '#15803D' };
const PAGINA = { margem: 40, largura: 595.28, altura: 841.89 };

/**
 * @param {{posicao:number, municipio:string, uf:string, ci:number, semGeracao:boolean}[]} ranking já ordenado
 * @param {{nome:string, tipo:string, peso:number}[]} criterios
 * @param {{geradoPor?:string}} opcoes
 * @returns {PDFDocument} stream pronto para doc.pipe(res)
 */
function gerarPdfRankingMunicipios(ranking, criterios = [], { geradoPor } = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: PAGINA.margem, bufferPages: true });
  const larguraUtil = PAGINA.largura - PAGINA.margem * 2;
  const limiteY = PAGINA.altura - PAGINA.margem - 30; // sobra espaço para o rodapé

  // ---- Cabeçalho
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#111827')
    .text('Ranking de vulnerabilidade energética', { align: 'center' });
  doc.font('Helvetica').fontSize(10).fillColor('#6B7280')
    .text(`Método TOPSIS · ${new Date().toLocaleDateString('pt-BR')}${geradoPor ? ` · Gerado por ${geradoPor}` : ''}`, { align: 'center' });
  doc.moveDown(1.2);

  // ---- Resumo
  const media = ranking.reduce((soma, r) => soma + r.ci, 0) / ranking.length;
  const semGeracao = ranking.filter((r) => r.semGeracao).length;
  const maior = ranking[0];
  const menor = ranking[ranking.length - 1];
  const rotulo = (r) => `${r.municipio}/${r.uf} (Ci ${r.ci.toFixed(4)})`;

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Resumo');
  doc.moveDown(0.3);
  doc.font('Helvetica').fontSize(10).fillColor('#111827');
  doc.text(`Municípios no ranking: ${ranking.length}`);
  doc.text(`Mais vulnerável: ${rotulo(maior)}`);
  doc.text(`Menos vulnerável: ${rotulo(menor)}`);
  doc.text(`Ci médio: ${media.toFixed(4)}`);
  doc.text(`Municípios sem geração renovável constatada pela ANEEL: ${semGeracao}`);
  doc.moveDown(0.8);

  // ---- Critérios
  if (criterios.length > 0) {
    doc.font('Helvetica-Bold').fontSize(12).text('Critérios e pesos');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10);
    for (const c of criterios) {
      const tipo = c.tipo === 'custo' ? 'custo' : 'benefício';
      doc.text(`• ${c.nome} — ${tipo}, peso ${formatarNumero(c.peso, 2)}`);
    }
    doc.moveDown(0.8);
  }

  // ---- Tabela
  const colunas = [
    { titulo: '#', x: PAGINA.margem, largura: 36 },
    { titulo: 'Município', x: PAGINA.margem + 36, largura: 200 },
    { titulo: 'UF', x: PAGINA.margem + 236, largura: 30 },
    { titulo: 'Ci', x: PAGINA.margem + 266, largura: 60 },
    { titulo: 'Faixa', x: PAGINA.margem + 326, largura: 60 },
    { titulo: 'Geração renovável', x: PAGINA.margem + 386, largura: larguraUtil - 386 },
  ];
  const ALTURA_LINHA = 16;

  const cabecalhoTabela = () => {
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151');
    colunas.forEach((c) => doc.text(c.titulo, c.x, y, { width: c.largura, lineBreak: false }));
    doc.moveTo(PAGINA.margem, y + 13).lineTo(PAGINA.margem + larguraUtil, y + 13).strokeColor('#D1D5DB').stroke();
    doc.y = y + ALTURA_LINHA + 2;
  };

  doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text('Ranking');
  doc.moveDown(0.4);
  cabecalhoTabela();

  ranking.forEach((r, i) => {
    if (doc.y + ALTURA_LINHA > limiteY) {
      doc.addPage();
      cabecalhoTabela(); // repete o cabeçalho em cada página
    }
    const y = doc.y;
    const faixa = faixaDoCi(r.ci);
    if (i % 2 === 1) doc.rect(PAGINA.margem, y - 2, larguraUtil, ALTURA_LINHA).fill('#F3F4F6');

    doc.font('Helvetica').fontSize(9).fillColor('#111827');
    const celula = (col, texto, cor) => {
      doc.fillColor(cor || '#111827').text(texto, colunas[col].x, y, {
        width: colunas[col].largura, lineBreak: false, ellipsis: true,
      });
    };
    celula(0, String(r.posicao));
    celula(1, r.municipio);
    celula(2, r.uf);
    celula(3, r.ci.toFixed(4));
    celula(4, faixa, COR_FAIXA[faixa]);
    celula(5, r.semGeracao ? 'Sem geração constatada' : 'Com geração', r.semGeracao ? '#B91C1C' : '#111827');
    doc.y = y + ALTURA_LINHA;
  });

  // ---- Nota de leitura
  doc.moveDown(1);
  if (doc.y + 40 > limiteY) doc.addPage();
  doc.font('Helvetica').fontSize(8).fillColor('#6B7280').text(
    'Leitura: quanto maior o Ci, maior a vulnerabilidade do município. Faixas: Alta (Ci a partir de 0,66), Média (de 0,33 a 0,66), Baixa (abaixo de 0,33). ' +
    '"Sem geração constatada" indica que a ANEEL (SIGA) não registra usina renovável em operação no município.',
    PAGINA.margem, doc.y, { width: larguraUtil },
  );

  // ---- Rodapé com numeração (depois que o total de páginas é conhecido)
  const paginas = doc.bufferedPageRange();
  for (let i = paginas.start; i < paginas.start + paginas.count; i++) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0; // sem isso, escrever na faixa do rodapé cria uma página em branco
    doc.font('Helvetica').fontSize(8).fillColor('#9CA3AF').text(
      `Plataforma de Energia Renovável · Página ${i - paginas.start + 1} de ${paginas.count}`,
      PAGINA.margem, PAGINA.altura - PAGINA.margem - 8,
      { width: larguraUtil, align: 'center', lineBreak: false },
    );
  }

  doc.end();
  return doc;
}

module.exports = { gerarCsvRanking, gerarPdfRanking, gerarPdfRankingMunicipios, faixaDoCi };