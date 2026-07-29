// expTable.js
// ⚠️ LEGADO: desde que a API oficial do Wartale passou a fornecer `exp` e
// `expPercentage` exatos por personagem, o scraper.js NÃO usa mais este
// arquivo para o ranking Top Level. Deixado aqui só como referência/backup
// caso a API fique fora do ar e seja necessário voltar pra estimativa.
// Carrega a tabela de EXP (exp-table.json) e oferece funções auxiliares.
// Fonte oficial: https://wartale.com/gameguides/exp-table-r64/ (níveis até 171 confirmados pela Wartale)
// Níveis 172+ são ESTIMADOS por extrapolação (x1.2 por nível) até a Wartale publicar os valores reais.

const fs = require("fs");
const path = require("path");

const EXP_TABLE = JSON.parse(
  fs.readFileSync(path.join(__dirname, "exp-table.json"), "utf-8")
);

function toTri(rawExp) {
  return rawExp / 1e12;
}

function triBetweenLevels(levelA, levelB) {
  const a = EXP_TABLE[levelA];
  const b = EXP_TABLE[levelB];
  if (!a || !b) return null;
  return +(toTri(b.total) - toTri(a.total)).toFixed(3);
}

module.exports = { EXP_TABLE, toTri, triBetweenLevels };
