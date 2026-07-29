import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { handleTurn, type HistoryTurn, type ImageInput } from "../orchestrator/orchestrator.js";
import type { LeadProfile } from "../types/lead.js";

export async function chatRoutes(app: FastifyInstance) {
  app.post("/chat", async (request, reply) => {
    const body = request.body as {
      telefone?: string;
      mensagem?: string;
      nome?: string;
      imagemBase64?: string;
      imagemMediaType?: string;
    };

    if (!body?.telefone || !body?.mensagem) {
      return reply.status(400).send({ error: "telefone e mensagem são obrigatórios" });
    }

    const image: ImageInput | undefined =
      body.imagemBase64 && body.imagemMediaType
        ? { base64: body.imagemBase64, mediaType: body.imagemMediaType }
        : undefined;

    // 1. Resolve ou cria o Contact
    const contact = await prisma.contact.upsert({
      where: { telefone: body.telefone },
      update: body.nome ? { nome: body.nome } : {},
      create: { telefone: body.telefone, nome: body.nome },
    });

    // 2. Resolve a conversa em andamento, ou abre uma nova
    let conversation = await prisma.conversation.findFirst({
      where: { contactId: contact.id, status: "em_andamento" },
      orderBy: { criadoEm: "desc" },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { contactId: contact.id, canal: "web", status: "em_andamento" },
      });
    }

    // 3. Resolve o lead dessa conversa, ou cria um novo
    let lead = await prisma.lead.findFirst({
      where: { conversationId: conversation.id },
      orderBy: { criadoEm: "desc" },
    });
    if (!lead) {
      lead = await prisma.lead.create({
        data: { contactId: contact.id, conversationId: conversation.id, tipo: "orcamento" },
      });
    }

    // 4. Grava a mensagem do cliente (com imagem, se houver)
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        autor: "cliente",
        conteudo: body.mensagem,
        imagemUrl: image ? `data:${image.mediaType};base64,${image.base64}` : undefined,
      },
    });

    // 5. Reconstrói o histórico a partir do banco
    const messages: { autor: string; conteudo: string }[] = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { criadoEm: "asc" },
    });
    const history: HistoryTurn[] = messages.map(
      (m): HistoryTurn => ({
        role: m.autor === "cliente" ? "user" : "assistant",
        content: m.conteudo,
      })
    );

    const currentProfile: LeadProfile = {
      nome: contact.nome,
      tipo: lead.tipo,
      ideia: lead.ideia,
      localCorpo: lead.localCorpo,
      tamanho: lead.tamanho,
      estilo: lead.estilo,
      faixaOrcamento: lead.faixaOrcamento,
    };

    // 6. Chama o Orchestrator (extração + resposta + opções rápidas)
    const result = await handleTurn(history, currentProfile, image);

    // 7. Grava a resposta da IA
    await prisma.message.create({
      data: { conversationId: conversation.id, autor: "ia", conteudo: result.reply },
    });

    // 8. Persiste o lead_profile atualizado
    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        ideia: result.updatedProfile.ideia ?? undefined,
        localCorpo: result.updatedProfile.localCorpo ?? undefined,
        tamanho: result.updatedProfile.tamanho ?? undefined,
        estilo: result.updatedProfile.estilo ?? undefined,
        faixaOrcamento: result.updatedProfile.faixaOrcamento ?? undefined,
      },
    });

    // 9. Se o nome foi extraído nesse turno, grava no Contact (dado de contato,
    //    não do lead específico — reaproveitável em conversas futuras).
    if (result.updatedProfile.nome && result.updatedProfile.nome !== contact.nome) {
      await prisma.contact.update({
        where: { id: contact.id },
        data: { nome: result.updatedProfile.nome },
      });
    }

    return reply.send({
      reply: result.reply,
      quickOptions: result.quickOptions,
      leadId: updatedLead.id,
      conversationId: conversation.id,
      profile: result.updatedProfile,
    });
  });
}
