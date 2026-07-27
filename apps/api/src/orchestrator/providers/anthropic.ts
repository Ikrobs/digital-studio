import Anthropic from "@anthropic-ai/sdk";
import { updateLeadProfileTool } from "../tools.js";
import { EXTRACTION_SYSTEM_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "../prompts.js";
import { camposFaltantes, type LeadProfile } from "../../types/lead.js";
import type { LLMProvider, HistoryTurn } from "./types.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_EXTRACTION = process.env.MODEL_EXTRACTION ?? "claude-haiku-4-5-20251001";
const MODEL_CONVERSATION = process.env.MODEL_CONVERSATION ?? "claude-sonnet-5";

export class AnthropicProvider implements LLMProvider {
  async extractLeadProfile(
    lastUserMessage: string,
    currentProfile: LeadProfile
  ): Promise<LeadProfile> {
    const response = await anthropic.messages.create({
      model: MODEL_EXTRACTION,
      max_tokens: 512,
      system: EXTRACTION_SYSTEM_PROMPT,
      tools: [updateLeadProfileTool],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content:
            `Perfil atual do lead: ${JSON.stringify(currentProfile)}\n\n` +
            `Mensagem do cliente: "${lastUserMessage}"`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUse || toolUse.name !== "update_lead_profile") {
      return currentProfile;
    }

    const extracted = toolUse.input as Partial<LeadProfile>;
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

    const response = await anthropic.messages.create({
      model: MODEL_CONVERSATION,
      max_tokens: 700,
      system: CONVERSATION_SYSTEM_PROMPT,
      messages: [
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user" as const, content: contextBlock },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    return textBlock?.text ?? "Desculpa, tive um problema para responder agora — pode repetir?";
  }
}
