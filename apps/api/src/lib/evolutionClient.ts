const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL ?? "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY ?? "";
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME ?? "estudio-digital";

/**
 * Envia mensagem de texto de volta pro cliente via Evolution API.
 * Formato de payload documentado pela própria Evolution:
 * POST {url}/message/sendText/{instance}, header "apikey".
 */
export async function sendWhatsAppText(numero: string, texto: string): Promise<void> {
  const url = `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({ number: numero, text: texto }),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Falha ao enviar mensagem via Evolution API: ${res.status} ${errorBody}`);
  }
}
