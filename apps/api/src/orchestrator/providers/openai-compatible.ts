import OpenAI from "openai";
import { EXTRACTION_SYSTEM_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "../prompts.js";
import { camposFaltantes, type LeadProfile } from "../../types/lead.js";
import type { LLMProvider, HistoryTurn } from "./types.js";

// Aponta para Groq (https://api.groq.com/openai/v1) ou OpenRouter
// (https://openrouter.ai/api/v1) via variável de ambiente — ambos seguem
// o formato de chamada da OpenAI, incluindo tool/function calling.
const client = new OpenAI({
  apiKey: process.env.FREE_PROVIDER_API_KEY,
  baseURL: process.env.FREE_PROVIDER_BASE_URL,
});

const MODEL_FREE = process.env.FREE_PROVIDER_MODEL ?? "llama-3.3-70b-versatile";

// Mesmo schema do update_lead_profile, só que no formato de "function"
// esperado pela API da OpenAI (e por extensão, Groq/OpenRouter).
const updateLeadProfileFunction: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "update_lead_profile",
    description:
      "Atualiza o perfil estruturado do lead com informações extraídas da " +
      "mensagem do cliente. Preencha apenas os campos mencionados.",
    parameters: {
      type: "object",
      properties: {
        ideia: { type: "string" },
        localCorpo: { type: "string" },
        tamanho: { type: "string" },
        estilo: { type: "string" },
        faixaOrcamento: { type: "string" },
      },
    },
  },
};

export class OpenAICompatibleProvider implements LLMProvider {
  async extractLeadProfile(
    lastUserMessage: string,
    currentProfile: LeadProfile
  ): Promise<LeadProfile> {
    const response = await client.chat.completions.create({
      model: MODEL_FREE,
      messages: [
        { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
        {
          role: "user",
          content:
            `Perfil atual do lead: ${JSON.stringify(currentProfile)}\n\n` +
            `Mensagem do cliente: "${lastUserMessage}"`,
        },
      ],
      tools: [updateLeadProfileFunction],
      tool_choice: "auto",
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "update_lead_profile") {
      return currentProfile;
    }

    let extracted: Partial<LeadProfile> = {};
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch {
      // modelo aberto às vezes devolve JSON malformado — falha graciosamente,
      // mantendo o perfil como estava em vez de derrubar a conversa.
      return currentProfile;
    }

    return {
      ...currentProfile,
      ...Object.fromEntries(
        Object.entries(extracted).filter(([, v]) => v !== undefined && v !== "")
      ),
    };
  }

  async generateReply(history: HistoryTurn[], profile: LeadProfile): Promise<string> {
    const faltando = camposFaltantes(profile);
    const contextBlock =
      `[CONTEXTO INTERNO — não mostrar ao cliente]\n` +
      `lead_profile atual: ${JSON.stringify(profile)}\n` +
      `camposFaltantes: ${JSON.stringify(faltando)}\n` +
      `[FIM DO CONTEXTO]`;

    const response = await client.chat.completions.create({
      model: MODEL_FREE,
      messages: [
        { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user", content: contextBlock },
      ],
    });

    return (
      response.choices[0]?.message?.content ??
      "Desculpa, tive um problema para responder agora — pode repetir?"
    );
  }
}
