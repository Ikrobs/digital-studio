import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";

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
}
