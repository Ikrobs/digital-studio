import OpenAI from "openai";
import { EXTRACTION_SYSTEM_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "../prompts.js";
import { camposFaltantes, type LeadProfile } from "../../types/lead.js";
import type { LLMProvider, HistoryTurn, ImageInput, GenerateReplyResult } from "./types.js";

const client = new OpenAI({
  apiKey: process.env.FREE_PROVIDER_API_KEY,
  baseURL: process.env.FREE_PROVIDER_BASE_URL,
});

const MODEL_FREE = process.env.FREE_PROVIDER_MODEL ?? "openrouter/free";

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
        nome: { type: "string" },
        ideia: { type: "string" },
        localCorpo: { type: "string" },
        tamanho: { type: "string" },
        estilo: { type: "string" },
        faixaOrcamento: { type: "string" },
      },
    },
  },
};

const suggestQuickOptionsFunction: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "suggest_quick_options",
    description:
      "Sugira de 2 a 5 opções curtas de resposta quando a pergunta feita " +
      "comportar um conjunto pequeno de respostas prováveis.",
    parameters: {
      type: "object",
      properties: {
        opcoes: { type: "array", items: { type: "string" } },
      },
      required: ["opcoes"],
    },
  },
};

export class OpenAICompatibleProvider implements LLMProvider {
  async extractLeadProfile(
    lastUserMessage: string,
    currentProfile: LeadProfile,
    image?: ImageInput
  ): Promise<LeadProfile> {
    try {
      const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
      if (image) {
        userContent.push({
          type: "image_url",
          image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
        });
      }
      userContent.push({
        type: "text",
        text:
          `Perfil atual do lead: ${JSON.stringify(currentProfile)}\n\n` +
          `Mensagem do cliente: "${lastUserMessage}"`,
      });

      const response = await client.chat.completions.create({
        model: MODEL_FREE,
        messages: [
          { role: "system", content: EXTRACTION_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        tools: [updateLeadProfileFunction],
        tool_choice: "auto",
      });

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall || toolCall.function.name !== "update_lead_profile") {
        return currentProfile;
      }

      const extracted: Partial<LeadProfile> = JSON.parse(toolCall.function.arguments);
      return {
        ...currentProfile,
        ...Object.fromEntries(
          Object.entries(extracted).filter(([, v]) => v !== undefined && v !== "")
        ),
      };
    } catch {
      return currentProfile;
    }
  }

  async generateReply(history: HistoryTurn[], profile: LeadProfile): Promise<GenerateReplyResult> {
    const faltando = camposFaltantes(profile);
    
    // CORREÇÃO 1: Contexto injetado como diretriz de sistema interna, 
    // garantindo que o modelo nunca pense que isso foi digitado pelo cliente.
    const contextSystemPrompt = 
      `Você deve agir de acordo com o seguinte estado interno do sistema:\n` +
      `lead_profile atual do banco de dados: ${JSON.stringify(profile)}\n` +
      `camposFaltantes do fluxo que você deve coletar: ${JSON.stringify(faltando)}\n` +
      `LEMBRETE: Use as informações acima apenas para guiar sua próxima pergunta. Nunca repita perguntas de campos já preenchidos.`;

    const response = await client.chat.completions.create({
      model: MODEL_FREE,
      messages: [
        { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
        { role: "system", content: contextSystemPrompt },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      ],
      tools: [suggestQuickOptionsFunction],
      tool_choice: "auto",
    });

    const message = response.choices[0]?.message;
    let reply = message?.content ?? "";

    // CORREÇÃO 2: Se o modelo falhar e não gerar conteúdo de texto (comum quando foca 100% na Tool),
    // definimos uma mensagem amigável de fallback em vez do texto de erro técnico cru.
    if (!reply.trim()) {
      reply = "Entendi perfeitamente! Como prefere seguir com esses detalhes?";
    }

    let quickOptions: string[] = [];
    const toolCall = message?.tool_calls?.find((t) => t.function.name === "suggest_quick_options");
    
    if (toolCall) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        if (Array.isArray(parsed.opcoes)) {
          quickOptions = parsed.opcoes;
        }
      } catch {
        // Ignora falhas de parse silenciosamente
      }
    }

    return { reply, quickOptions };
  }
}
