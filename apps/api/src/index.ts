import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { whatsappWebhookRoutes } from "./routes/webhook.whatsapp.js";
import { leadsRoutes } from "./routes/leads.js";
import { orchestratorTestRoutes } from "./routes/orchestrator.test.js";
import { chatRoutes } from "./routes/chat.js";

const app = Fastify({ logger: true });

// Dev: permissivo (o web app roda em porta diferente da API).
// Em produção, restringir a origin ao domínio real do web app.
await app.register(cors, { origin: true });

app.get("/health", async () => ({ status: "ok" }));

await app.register(whatsappWebhookRoutes);
await app.register(leadsRoutes);
await app.register(orchestratorTestRoutes);
await app.register(chatRoutes);

const port = Number(process.env.PORT ?? 3333);

app
  .listen({ port, host: "0.0.0.0" })
  .then(() => app.log.info(`Estúdio Digital API rodando na porta ${port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
