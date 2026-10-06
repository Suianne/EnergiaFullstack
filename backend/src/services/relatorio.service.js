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

module.exports = { gerarCsvRanking, gerarPdfRanking };