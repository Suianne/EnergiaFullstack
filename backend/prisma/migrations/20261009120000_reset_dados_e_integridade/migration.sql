/*
  Reset dos dados e reforço de integridade.

  - Apaga municípios (havia cidades duplicadas), matriz de decisão, critérios e simulações.
    Os usuários são preservados.
  - codigo_ibge passa a ser obrigatório e o nome do município passa a ser único por UF,
    impedindo novas duplicatas.
  - Exclusões passam a ser em cascata (apagar município/critério remove seus valores).
  - Novas colunas: municipios.geracao_renovavel (null = ANEEL não consultada,
    false = sem usina renovável em operação, true = possui), municipios.dados_atualizados_em,
    criterios.chave (identificador estável dos critérios padrão) e criterios.fonte.
*/

-- Reset dos dados (usuários preservados)
TRUNCATE TABLE "resultados_ranking", "simulacoes", "matriz_decisao", "municipios", "criterios" RESTART IDENTITY CASCADE;

-- DropForeignKey
ALTER TABLE "matriz_decisao" DROP CONSTRAINT "matriz_decisao_criterio_id_fkey";

-- DropForeignKey
ALTER TABLE "matriz_decisao" DROP CONSTRAINT "matriz_decisao_municipio_id_fkey";

-- DropForeignKey
ALTER TABLE "resultados_ranking" DROP CONSTRAINT "resultados_ranking_municipio_id_fkey";

-- DropForeignKey
ALTER TABLE "resultados_ranking" DROP CONSTRAINT "resultados_ranking_simulacao_id_fkey";

-- AlterTable
ALTER TABLE "criterios" ADD COLUMN     "chave" VARCHAR(50),
ADD COLUMN     "fonte" VARCHAR(50);

-- AlterTable
ALTER TABLE "matriz_decisao" ALTER COLUMN "municipio_id" SET NOT NULL,
ALTER COLUMN "criterio_id" SET NOT NULL,
ALTER COLUMN "ano_referencia" SET NOT NULL;

-- AlterTable
ALTER TABLE "municipios" ADD COLUMN     "dados_atualizados_em" TIMESTAMP(3),
ADD COLUMN     "geracao_renovavel" BOOLEAN,
ALTER COLUMN "codigo_ibge" SET NOT NULL;

-- AlterTable
ALTER TABLE "resultados_ranking" ALTER COLUMN "simulacao_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "criterios_chave_key" ON "criterios"("chave");

-- CreateIndex
CREATE UNIQUE INDEX "municipios_uf_nome_key" ON "municipios"("uf", "nome");

-- AddForeignKey
ALTER TABLE "matriz_decisao" ADD CONSTRAINT "matriz_decisao_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriz_decisao" ADD CONSTRAINT "matriz_decisao_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "criterios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_simulacao_id_fkey" FOREIGN KEY ("simulacao_id") REFERENCES "simulacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (município apagado vira NULL nas simulações antigas; o nome fica em parametros)
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
