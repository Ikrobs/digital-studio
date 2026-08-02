import type { FastifyInstance } from "fastify";
import { attendIncomingMessage } from "../lib/attendChat.js";
import { sendWhatsAppText } from "../lib/evolutionClient.js";

// Formato de payload da Evolution API (messages.upsert). Documentado como
// MESSAGES_UPSERT no changelog, mas observado como "messages.upsert" em
// produção dependendo da versão — tratamos os dois.
interface EvolutionWebhookPayload {
  event?: string;
  data?: {
    key?: {
      remoteJid?: string;
      fromMe?: boolean;
    };
    pushName?: string;
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

function isMessageUpsertEvent(event?: string): boolean {
  return event?.toLowerCase() === "messages.upsert";
}

function extractPhoneFromJid(remoteJid?: string): string | null {
  if (!remoteJid) return null;
  // remoteJid vem como "5511999999999@s.whatsapp.net" — grupos têm formato
  // diferente ("...@g.us") e são ignorados por enquanto (fora do escopo v1).
  if (remoteJid.endsWith("@g.us")) return null;
  return remoteJid.split("@")[0];
}

function extractTextContent(
  message: { conversation?: string; extendedTextMessage?: { text?: string } } | undefined
): string | null {
  if (!message) return null;
  return message.conversation ?? message.extendedTextMessage?.text ?? null;
}

export async function evolutionWebhookRoutes(app: FastifyInstance) {
  app.post("/webhooks/evolution", async (request, reply) => {
    const payload = request.body as EvolutionWebhookPayload;

    // Responde 200 imediatamente pra qualquer evento que não nos interessa —
    // a Evolution reenvia com backoff se não receber 2xx.
    if (!isMessageUpsertEvent(payload?.event)) {
      return reply.status(200).send({ ignored: true });
    }

    const { key, pushName, message } = payload.data ?? {};

    // Ignora mensagens que o próprio bot enviou (eco do que nós mandamos).
    if (key?.fromMe) {
      return reply.status(200).send({ ignored: "fromMe" });
    }

    const telefone = extractPhoneFromJid(key?.remoteJid);
    const texto = extractTextContent(message);

    if (!telefone || !texto) {
      app.log.warn({ payload }, "Webhook da Evolution sem telefone/texto reconhecível");
      return reply.status(200).send({ ignored: "unrecognized_payload" });
    }

    try {
      const result = await attendIncomingMessage({
        telefone,
        mensagem: texto,
        nome: pushName, // pushName é o nome de exibição do WhatsApp — só um
        // hint inicial; o atendente ainda pergunta como a pessoa quer ser
        // chamada, pushName não substitui isso.
        canal: "whatsapp",
      });

      await sendWhatsAppText(telefone, result.reply);

      // Opções rápidas não têm equivalente nativo simples no texto puro do
      // WhatsApp (viraria botão via template, que exige aprovação prévia da
      // Meta/Evolution) — por ora, ficam só na experiência do web app.
      // TODO: mapear quickOptions para lista/botão nativo quando fizer sentido.

      return reply.status(200).send({ ok: true });
    } catch (err) {
      app.log.error(err, "Erro processando mensagem da Evolution API");
      return reply.status(200).send({ ok: false }); // 200 mesmo em erro, evita retry em loop
    }
  });
}
