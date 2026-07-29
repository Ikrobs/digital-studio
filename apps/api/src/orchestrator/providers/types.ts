import type { LeadProfile } from "../../types/lead.js";

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ImageInput {
  base64: string;
  mediaType: string; // ex: "image/jpeg", "image/png"
}

export interface GenerateReplyResult {
  reply: string;
  quickOptions: string[];
}

export interface LLMProvider {
  extractLeadProfile(
    lastUserMessage: string,
    currentProfile: LeadProfile,
    image?: ImageInput
  ): Promise<LeadProfile>;

  generateReply(history: HistoryTurn[], profile: LeadProfile): Promise<GenerateReplyResult>;
}
