-- RESET DOS DADOS DE NEGÓCIO
-- Apaga municípios (com repetições), critérios, matriz de decisão e simulações antigas,
-- porque o TOPSIS foi reformulado e os valores gravados não servem mais.
-- A tabela "usuarios" é preservada para ninguém perder o acesso.
TRUNCATE TABLE "resultados_ranking", "simulacoes", "matriz_decisao", "criterios", "municipios" RESTART IDENTITY CASCADE;

-- Município: código IBGE passa a ser obrigatório (já era único), o que impede repetições.
ALTER TABLE "municipios" ALTER COLUMN "codigo_ibge" SET NOT NULL;

-- Município: dados brutos do IBGE/ANEEL guardados junto do cadastro.
ALTER TABLE "municipios"
  ADD COLUMN "pib_per_capita" DECIMAL(12,2),
  ADD COLUMN "potencia_renovavel_kw" DECIMAL(15,3),
  ADD COLUMN "usinas_renovaveis" INTEGER,
  ADD COLUMN "dados_atualizados_em" TIMESTAMP(3);

-- Critério: código estável para localizar o critério sem depender do nome.
ALTER TABLE "criterios" ADD COLUMN "codigo" VARCHAR(40);
CREATE UNIQUE INDEX "criterios_codigo_key" ON "criterios"("codigo");
