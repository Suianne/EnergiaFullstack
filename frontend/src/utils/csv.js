// Geração de CSV no cliente com as mesmas proteções do backend (relatorio.service.js):
// separador ";", BOM para o Excel reconhecer UTF-8, aspas quando necessário e
// neutralização de "injeção de fórmula" (células começando com = + - @).

const SEPARADOR = ';'
const QUEBRA_DE_LINHA = '\r\n'
const BOM = String.fromCharCode(0xfeff)

export function escaparCampo(valor) {
  let texto = String(valor ?? '')
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`
  if (/[;"\n\r]/.test(texto)) texto = `"${texto.replace(/"/g, '""')}"`
  return texto
}

export const numeroCsv = (n, casas = 4) => (Number.isFinite(n) ? n.toFixed(casas).replace('.', ',') : '')

/**
 * @param {string[]} cabecalho
 * @param {Array<Array<string|number>>} linhas
 * @returns {Blob} arquivo pronto para download
 */
export function gerarCsv(cabecalho, linhas) {
  const texto = [cabecalho, ...linhas].map((l) => l.map(escaparCampo).join(SEPARADOR)).join(QUEBRA_DE_LINHA)
  return new Blob([BOM + texto + QUEBRA_DE_LINHA], { type: 'text/csv;charset=utf-8' })
}
