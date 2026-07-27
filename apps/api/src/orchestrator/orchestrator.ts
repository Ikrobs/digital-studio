import { AnthropicProvider } from "./providers/anthropic.js";
import { OpenAICompatibleProvider } from "./providers/openai-compatible.js";
import type { LLMProvider, HistoryTurn } from "./providers/types.js";
import type { LeadProfile } from "../types/lead.js";

export type { HistoryTurn } from "./providers/types.js";

export interface OrchestratorResult {
  reply: string;
  updatedProfile: LeadProfile;
}

/**
 * Seleção de provider via MODEL_PROVIDER no .env:
 * - "anthropic" (padrão)         -> Claude (Haiku + Sonnet), custo real
 * - "free" (Groq ou OpenRouter)  -> zero custo, para fase de testes,
 *   configurado via FREE_PROVIDER_BASE_URL / FREE_PROVIDER_API_KEY / FREE_PROVIDER_MODEL
 *
 * Trocar de provider é só mudar essa variável — o resto do sistema
 * (rotas, checklist, schema) não muda nada.
 */
function resolveProvider(): LLMProvider {
  const providerName = process.env.MODEL_PROVIDER ?? "anthropic";
  if (providerName === "free") {
    return new OpenAICompatibleProvider();
  }
  return new AnthropicProvider();
}

const provider = resolveProvider();

export async function handleTurn(
  history: HistoryTurn[],
  currentProfile: LeadProfile
): Promise<OrchestratorResult> {
  const lastUserMessage =
    [...history].reverse().find((t) => t.role === "user")?.content ?? "";

  const updatedProfile = await provider.extractLeadProfile(lastUserMessage, currentProfile);
  const reply = await provider.generateReply(history, updatedProfile);

  return { reply, updatedProfile };
}
