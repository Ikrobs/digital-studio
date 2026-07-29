import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";

const VALID_STATUS = ["aguardando", "aprovado", "recusado", "perdido"] as const;
type LeadStatus = (typeof VALID_STATUS)[number];

export async function leadsRoutes(app: FastifyInstance) {
  // Fila de leads para o painel do estúdio, mais recentes/prioritários primeiro.
  app.get("/leads", async (_request, reply) => {
    const leads = await prisma.lead.findMany({
      orderBy: [{ prioridade: "asc" }, { criadoEm: "desc" }],
      include: { contact: true },
      take: 100,
    });
    return reply.send(leads);
  });

  app.get("/leads/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const lead = await prisma.lead.findUnique({
      where: { id },
      include: { contact: true, conversation: { include: { messages: true } } },
    });
    if (!lead) return reply.status(404).send({ error: "Lead não encontrado" });
    return reply.send(lead);
  });

  // Ação manual do artista: aprovar consulta, recusar, ou marcar como perdido.
  // Nunca automático — é exatamente o ponto de decisão humana que definimos
  // como princípio do projeto.
  app.patch("/leads/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as { status?: string };

    if (!body?.status || !VALID_STATUS.includes(body.status as LeadStatus)) {
      return reply.status(400).send({ error: `status deve ser um de: ${VALID_STATUS.join(", ")}` });
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: { status: body.status },
    });

    // Ao aprovar, cria automaticamente um Appointment pendente de data —
    // o artista confirma o horário depois, isso só registra a intenção.
    if (body.status === "aprovado") {
      await prisma.appointment.create({
        data: {
          contactId: lead.contactId,
          leadId: lead.id,
          status: "pendente",
        },
      });
    }

    return reply.send(lead);
  });
}
