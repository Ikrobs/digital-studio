import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";

interface RespostaAnamnese {
  pergunta: string;
  resposta: string;
}

export async function consentFormsRoutes(app: FastifyInstance) {
  // Agrega tudo que já existe automaticamente sobre o lead — perfil
  // extraído da conversa, imagens enviadas, e os termos já preenchidos
  // (se houver) — pra montar a ficha completa no painel/web app.
  app.get("/leads/:id/ficha", async (request, reply) => {
    const { id } = request.params as { id: string };

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        contact: true,
        conversation: { include: { messages: true } },
      },
    });

    if (!lead) return reply.status(404).send({ error: "Lead não encontrado" });

    const consentForms = await prisma.consentForm.findMany({
      where: { contactId: lead.contactId },
      orderBy: { criadoEm: "desc" },
    });

    const imagensEnviadas = lead.conversation.messages
      .filter((m: { autor: string; imagemUrl: string | null }) => m.autor === "cliente" && m.imagemUrl)
      .map((m: { imagemUrl: string | null; criadoEm: Date }) => ({
        imagemUrl: m.imagemUrl,
        enviadaEm: m.criadoEm,
      }));

    return reply.send({
      contactId: lead.contactId,
      lead: {
        id: lead.id,
        tipo: lead.tipo,
        status: lead.status,
        ideia: lead.ideia,
        localCorpo: lead.localCorpo,
        tamanho: lead.tamanho,
        estilo: lead.estilo,
        faixaOrcamento: lead.faixaOrcamento,
      },
      contato: {
        nome: lead.contact.nome,
        telefone: lead.contact.telefone,
        endereco: lead.contact.endereco,
      },
      imagensEnviadas,
      termoConsentimento: consentForms.find((c: { tipo: string }) => c.tipo === "termo_consentimento") ?? null,
      anamnese: consentForms.find((c: { tipo: string }) => c.tipo === "anamnese") ?? null,
    });
  });

  // Salva o termo de consentimento ou a anamnese — sempre preenchidos e
  // assinados pelo próprio cliente, nunca inferidos da conversa.
  app.post("/consent-forms", async (request, reply) => {
    const body = request.body as {
      contactId?: string;
      tipo?: "anamnese" | "termo_consentimento";
      respostas?: RespostaAnamnese[];
      nomeAssinatura?: string;
    };

    if (!body?.contactId || !body?.tipo || !body?.respostas || !body?.nomeAssinatura) {
      return reply.status(400).send({
        error: "contactId, tipo, respostas e nomeAssinatura são obrigatórios",
      });
    }

    const consentForm = await prisma.consentForm.create({
      data: {
        contactId: body.contactId,
        tipo: body.tipo,
        respostasJson: body.respostas as any,
        assinaturaUrl: body.nomeAssinatura, // assinatura eletrônica simples (nome digitado) — ver nota no schema
        ipAssinatura: request.ip,
        assinadoEm: new Date(),
      },
    });

    return reply.send(consentForm);
  });
}
