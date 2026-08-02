import type { FastifyInstance } from "fastify";
import { gerarDecalque } from "../lib/decalPipeline.js";

export async function imagesRoutes(app: FastifyInstance) {
  app.post("/images/decalque", async (request, reply) => {
    const body = request.body as { imagemBase64?: string };

    if (!body?.imagemBase64) {
      return reply.status(400).send({ error: "imagemBase64 é obrigatório" });
    }

    try {
      const resultado = await gerarDecalque(body.imagemBase64);
      return reply.send(resultado);
    } catch (err) {
      app.log.error(err, "Falha ao gerar decalque");
      return reply.status(500).send({ error: "Não foi possível processar a imagem" });
    }
  });
}
