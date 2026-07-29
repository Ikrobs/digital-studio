import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import type { LLMProvider, HistoryTurn, ImageInput } from "./providers/types.js";
import type { LeadProfile } from "../types/lead.js";

export type { HistoryTurn, ImageInput } from "./providers/types.js";

export interface OrchestratorResult {
  reply: string;
  updatedProfile: LeadProfile;
  quickOptions: string[];
}

function resolveProvider(): LLMProvider {
  const providerName = process.env.MODEL_PROVIDER ?? "anthropic";
  if (providerName === "free") {
    return new OpenAICompatibleProvider();
  }
  return new AnthropicProvider();
}

const provider = resolveProvider();

/**
 * Processa a extração e a formatação das opções de resposta dinâmica (Regex).
 */
function parseReplyAndOptions(rawReply: string): { reply: string; quickOptions: string[] } {
  const lines = rawReply.split("\n");
  const cleanReplyLines: string[] = [];
  const quickOptions: string[] = [];

  for (const line of lines) {
    if (line.trim().startsWith("[OPÇÃO]")) {
      const optionText = line.replace("[OPÇÃO]", "").trim();
      if (optionText) quickOptions.push(optionText);
    } else {
      cleanReplyLines.push(line);
    }
  }

  return {
    reply: cleanReplyLines.join("\n").trim(),
    quickOptions,
  };
}

export async function handleTurn(
  history: HistoryTurn[],
  currentProfile: LeadProfile,
  image?: ImageInput
): Promise<OrchestratorResult> {
  // Captura a última mensagem do utilizador para processamento no Passe 1
  const lastUserMessage =
    [...history].reverse().find((t) => t.role === "user")?.content ?? "";

  // PASSE 1: Extração estruturada (Groq / Qwen ou Anthropic)
  const updatedProfile = await provider.extractLeadProfile(lastUserMessage, currentProfile, image);

  // PASSE 2: Geração da resposta conversacional (GPT-OSS ou Claude)
  const rawResult = await provider.generateReply(history, updatedProfile);

  // Tratamento de segurança: Se o provider já devolver quickOptions estruturadas (via Tool), usamos.
  // Caso contrário, fazemos o parse do texto gerado com as regras do prompt [OPÇÃO]
  if (rawResult.quickOptions && rawResult.quickOptions.length > 0) {
    return {
      reply: rawResult.reply,
      updatedProfile,
      quickOptions: rawResult.quickOptions,
    };
  }

  const { reply, quickOptions } = parseReplyAndOptions(rawResult.reply);

  return { reply, updatedProfile, quickOptions };
}
