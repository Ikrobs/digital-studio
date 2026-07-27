import type { LeadProfile } from "../../types/lead.js";

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface LLMProvider {
  extractLeadProfile(
    lastUserMessage: string,
    currentProfile: LeadProfile
  ): Promise<LeadProfile>;

  generateReply(history: HistoryTurn[], profile: LeadProfile): Promise<string>;
}
