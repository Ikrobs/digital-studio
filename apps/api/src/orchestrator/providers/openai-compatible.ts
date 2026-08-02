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
        endereco: { type: "string" },
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
      // Modelo aberto pode falhar em imagem, JSON malformado, etc.
      // Falha graciosamente — mantém o perfil como estava.
      return currentProfile;
    }
  }

  async generateReply(history: HistoryTurn[], profile: LeadProfile): Promise<GenerateReplyResult> {
    const faltando = camposFaltantes(profile);
    const contextBlock =
      `[CONTEXTO INTERNO — não mostrar ao cliente]\n` +
      `lead_profile atual: ${JSON.stringify(profile)}\n` +
      `camposFaltantes: ${JSON.stringify(faltando)}\n` +
      `[FIM DO CONTEXTO]`;

    try {
      const response = await client.chat.completions.create({
        model: MODEL_FREE,
        messages: [
          { role: "system", content: CONVERSATION_SYSTEM_PROMPT },
          ...history.map((turn) => ({ role: turn.role, content: turn.content })),
          { role: "user", content: contextBlock },
        ],
        tools: [suggestQuickOptionsFunction],
        tool_choice: "auto",
      });

      const message = response.choices[0]?.message;

      let quickOptions: string[] = [];
      const toolCall = message?.tool_calls?.find((t) => t.function.name === "suggest_quick_options");
      if (toolCall) {
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          if (Array.isArray(parsed.opcoes)) quickOptions = parsed.opcoes;
        } catch {
          // opções rápidas são um bônus, não crítico — ignora silenciosamente
        }
      }

      // Alguns modelos retornam texto vazio quando decidem chamar uma
      // ferramenta (comportamento normal, não é erro). Só usamos a
      // mensagem de "problema real" quando não há nem texto nem opções.
      const reply =
        message?.content ||
        (quickOptions.length > 0
          ? "Show, só mais um detalhe:"
          : "Desculpa, tive um problema para responder agora — pode repetir?");

      return { reply, quickOptions };
    } catch (err) {
      console.error("Erro no provider gratuito (generateReply):", err);
      return {
        reply: "Desculpa, tive um problema técnico para responder agora — pode repetir?",
        quickOptions: [],
      };
    }
  }
}
