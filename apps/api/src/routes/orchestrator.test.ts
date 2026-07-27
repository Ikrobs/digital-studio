import type { FastifyInstance } from "fastify";
import { handleTurn, type HistoryTurn } from "../orchestrator/orchestrator.js";
import type { LeadProfile } from "../types/lead.js";

/**
 * Endpoint de teste manual do Orchestrator, sem depender do webhook do
 * WhatsApp. Simula exatamente o que fizemos no chat: mandar uma mensagem,
 * receber o lead_profile atualizado + a resposta gerada.
 *
 * POST /orchestrator/test
 * body: { history: HistoryTurn[], profile: LeadProfile }
 */
export async function orchestratorTestRoutes(app: FastifyInstance) {
  app.post("/orchestrator/test", async (request, reply) => {
    const body = request.body as { history: HistoryTurn[]; profile: LeadProfile };

    if (!body?.history?.length) {
      return reply.status(400).send({ error: "history é obrigatório" });
    }

    const profile: LeadProfile = body.profile ?? { tipo: "orcamento" };
    const result = await handleTurn(body.history, profile);

    return reply.send(result);
  });
}
