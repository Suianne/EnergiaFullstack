// Gera relatórios a partir de um ranking JÁ CALCULADO.
// Não sabe de onde o ranking veio (requisição, banco...), por isso serve para qualquer rota.

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

module.exports = { gerarCsvRanking };