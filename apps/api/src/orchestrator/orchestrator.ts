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

export async function handleTurn(
  history: HistoryTurn[],
  currentProfile: LeadProfile,
  image?: ImageInput
): Promise<OrchestratorResult> {
  const lastUserMessage =
    [...history].reverse().find((t) => t.role === "user")?.content ?? "";

  const updatedProfile = await provider.extractLeadProfile(lastUserMessage, currentProfile, image);
  const { reply, quickOptions } = await provider.generateReply(history, updatedProfile);

  return { reply, updatedProfile, quickOptions };
}
