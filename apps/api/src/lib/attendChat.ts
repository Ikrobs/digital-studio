import { prisma } from "../db/client.js";
import { handleTurn, type HistoryTurn, type ImageInput } from "../orchestrator/orchestrator.js";
import type { LeadProfile } from "../types/lead.js";

export interface IncomingMessage {
  telefone: string;
  mensagem: string;
  nome?: string;
  canal: "web" | "whatsapp";
  image?: ImageInput;
}

export interface AttendResult {
  reply: string;
  quickOptions: string[];
  leadId: string;
  conversationId: string;
  profile: LeadProfile;
}

/**
 * Núcleo do atendimento — usado tanto pelo /chat (web) quanto pelo webhook
 * da Evolution API (WhatsApp). Resolve Contact/Conversation/Lead, chama o
 * Orchestrator, persiste tudo. O canal de origem só afeta como a resposta
 * é entregue de volta, não a lógica de conversa em si.
 */
export async function attendIncomingMessage(input: IncomingMessage): Promise<AttendResult> {
  const { telefone, mensagem, nome, canal, image } = input;

  const contact = await prisma.contact.upsert({
    where: { telefone },
    update: nome ? { nome } : {},
    create: { telefone, nome },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, status: "em_andamento" },
    orderBy: { criadoEm: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { contactId: contact.id, canal, status: "em_andamento" },
    });
  }

  let lead = await prisma.lead.findFirst({
    where: { conversationId: conversation.id },
    orderBy: { criadoEm: "desc" },
  });
  if (!lead) {
    lead = await prisma.lead.create({
      data: { contactId: contact.id, conversationId: conversation.id, tipo: "orcamento" },
    });
  }

  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      autor: "cliente",
      conteudo: mensagem,
      imagemUrl: image ? `data:${image.mediaType};base64,${image.base64}` : undefined,
    },
  });

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
    endereco: contact.endereco,
    tipo: lead.tipo,
    ideia: lead.ideia,
    localCorpo: lead.localCorpo,
    tamanho: lead.tamanho,
    estilo: lead.estilo,
    faixaOrcamento: lead.faixaOrcamento,
  };

  const result = await handleTurn(history, currentProfile, image);

  await prisma.message.create({
    data: { conversationId: conversation.id, autor: "ia", conteudo: result.reply },
  });

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

  const contactUpdates: { nome?: string; endereco?: string } = {};
  if (result.updatedProfile.nome && result.updatedProfile.nome !== contact.nome) {
    contactUpdates.nome = result.updatedProfile.nome;
  }
  if (result.updatedProfile.endereco && result.updatedProfile.endereco !== contact.endereco) {
    contactUpdates.endereco = result.updatedProfile.endereco;
  }
  if (Object.keys(contactUpdates).length > 0) {
    await prisma.contact.update({ where: { id: contact.id }, data: contactUpdates });
  }

  return {
    reply: result.reply,
    quickOptions: result.quickOptions,
    leadId: updatedLead.id,
    conversationId: conversation.id,
    profile: result.updatedProfile,
  };
}
