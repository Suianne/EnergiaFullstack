-- AlterTable
ALTER TABLE "municipios" ADD COLUMN "codigo_ibge" VARCHAR(10);

-- CreateIndex
CREATE UNIQUE INDEX "municipios_codigo_ibge_key" ON "municipios"("codigo_ibge");
