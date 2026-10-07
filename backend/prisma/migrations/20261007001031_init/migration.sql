-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('ADMINISTRADOR', 'PESQUISADOR', 'GESTOR');

-- CreateTable
CREATE TABLE "usuarios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(200) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "perfil" "Perfil" NOT NULL DEFAULT 'PESQUISADOR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "uf" CHAR(2) NOT NULL,
    "populacao" INTEGER,
    "idh" DECIMAL(4,3),
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "criterios" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "tipo" VARCHAR(10),
    "peso" DECIMAL(5,4) DEFAULT 0.0,
    "unidade" VARCHAR(50),

    CONSTRAINT "criterios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matriz_decisao" (
    "id" SERIAL NOT NULL,
    "municipio_id" INTEGER,
    "criterio_id" INTEGER,
    "valor" DECIMAL(15,4) NOT NULL,
    "ano_referencia" INTEGER,

    CONSTRAINT "matriz_decisao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulacoes" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER,
    "data_execucao" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "parametros" JSONB,
    "status" VARCHAR(20) DEFAULT 'concluida',

    CONSTRAINT "simulacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultados_ranking" (
    "id" SERIAL NOT NULL,
    "simulacao_id" INTEGER,
    "municipio_id" INTEGER,
    "coeficiente_ci" DECIMAL(10,8),
    "distancia_positiva" DECIMAL(10,8),
    "distancia_negativa" DECIMAL(10,8),
    "posicao" INTEGER,

    CONSTRAINT "resultados_ranking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "matriz_decisao_municipio_id_criterio_id_ano_referencia_key" ON "matriz_decisao"("municipio_id", "criterio_id", "ano_referencia");

-- AddForeignKey
ALTER TABLE "matriz_decisao" ADD CONSTRAINT "matriz_decisao_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matriz_decisao" ADD CONSTRAINT "matriz_decisao_criterio_id_fkey" FOREIGN KEY ("criterio_id") REFERENCES "criterios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulacoes" ADD CONSTRAINT "simulacoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_simulacao_id_fkey" FOREIGN KEY ("simulacao_id") REFERENCES "simulacoes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultados_ranking" ADD CONSTRAINT "resultados_ranking_municipio_id_fkey" FOREIGN KEY ("municipio_id") REFERENCES "municipios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
