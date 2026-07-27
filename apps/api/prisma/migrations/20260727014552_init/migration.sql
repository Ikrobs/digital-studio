-- CreateEnum
CREATE TYPE "ChannelType" AS ENUM ('whatsapp', 'web', 'instagram');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('em_andamento', 'aguardando_cliente', 'qualificado', 'perdido', 'convertido');

-- CreateEnum
CREATE TYPE "LeadTipo" AS ENUM ('orcamento', 'flash', 'duvida');

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "telefone" TEXT,
    "nome" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "canal" "ChannelType" NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'em_andamento',
    "handoff_token" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "tipo" "LeadTipo" NOT NULL DEFAULT 'orcamento',
    "ideia" TEXT,
    "local_corpo" TEXT,
    "tamanho" TEXT,
    "estilo" TEXT,
    "faixa_orcamento" TEXT,
    "referencia_url" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "prioridade" TEXT NOT NULL DEFAULT 'normal',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_pieces" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "estilo" TEXT NOT NULL,
    "local_corpo" TEXT NOT NULL,
    "imagem_url" TEXT NOT NULL,
    "embedding" vector(1536),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_pieces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "lead_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "data_sugerida" TIMESTAMP(3),
    "observacoes" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consent_forms" (
    "id" TEXT NOT NULL,
    "contact_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "respostas_json" JSONB NOT NULL,
    "assinatura_url" TEXT,
    "ip_assinatura" TEXT,
    "assinado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consent_forms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_telefone_key" ON "contacts"("telefone");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_handoff_token_key" ON "conversations"("handoff_token");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_forms" ADD CONSTRAINT "consent_forms_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
