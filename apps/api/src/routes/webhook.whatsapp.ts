import type { FastifyInstance } from "fastify";

/**
 * Webhook do WhatsApp Cloud API.
 *
 * GET  -> verificação inicial exigida pela Meta ao cadastrar o webhook.
 * POST -> recebimento de mensagens reais.
 *
 * Isso ainda não está ligado ao Orchestrator — é o próximo passo depois
 * que o endpoint de teste (/orchestrator/test) estiver validado.
 */
export async function whatsappWebhookRoutes(app: FastifyInstance) {
  app.get("/webhooks/whatsapp", async (request, reply) => {
    const query = request.query as Record<string, string>;
    const mode = query["hub.mode"];
    const token = query["hub.verify_token"];
    const challenge = query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return reply.status(200).send(challenge);
    }

    return reply.status(403).send("Verification failed");
  });

  app.post("/webhooks/whatsapp", async (request, reply) => {
    // TODO: validar assinatura via WHATSAPP_APP_SECRET (X-Hub-Signature-256)
    // TODO: normalizar o payload da Meta para o formato interno de evento
    // TODO: resolver/criar Contact por telefone, resolver/criar Conversation
    // TODO: chamar handleTurn() do orchestrator e enviar a resposta de volta

    app.log.info({ body: request.body }, "Mensagem recebida do WhatsApp");

    return reply.status(200).send({ received: true });
  });
}
