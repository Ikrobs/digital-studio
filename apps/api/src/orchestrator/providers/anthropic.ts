import Anthropic from "@anthropic-ai/sdk";
import { updateLeadProfileTool, suggestQuickOptionsTool } from "../tools.js";
import { EXTRACTION_SYSTEM_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "../prompts.js";
import { camposFaltantes, type LeadProfile } from "../../types/lead.js";
import type { LLMProvider, HistoryTurn, ImageInput, GenerateReplyResult } from "./types.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_EXTRACTION = process.env.MODEL_EXTRACTION ?? "claude-haiku-4-5-20251001";
const MODEL_CONVERSATION = process.env.MODEL_CONVERSATION ?? "claude-sonnet-5";

export class AnthropicProvider implements LLMProvider {
  async extractLeadProfile(
    lastUserMessage: string,
    currentProfile: LeadProfile,
    image?: ImageInput
  ): Promise<LeadProfile> {
    try {
      const contentBlocks: Anthropic.MessageParam["content"] = [];

      if (image) {
        contentBlocks.push({
          type: "image",
          source: { type: "base64", media_type: image.mediaType as any, data: image.base64 },
        });
      }
      contentBlocks.push({
        type: "text",
        text:
          `Perfil atual do lead: ${JSON.stringify(currentProfile)}\n\n` +
          `Mensagem do cliente: "${lastUserMessage}"`,
      });

      const response = await anthropic.messages.create({
        model: MODEL_EXTRACTION,
        max_tokens: 512,
        system: EXTRACTION_SYSTEM_PROMPT,
        tools: [updateLeadProfileTool],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: contentBlocks }],
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
    } catch (err) {
      console.error("Erro na extração (Anthropic, possivelmente imagem malformada):", err);
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

    const response = await anthropic.messages.create({
      model: MODEL_CONVERSATION,
      max_tokens: 700,
      system: CONVERSATION_SYSTEM_PROMPT,
      tools: [suggestQuickOptionsTool],
      tool_choice: { type: "auto" },
      messages: [
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user" as const, content: contextBlock },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === "suggest_quick_options"
    );

    const quickOptions = Array.isArray((toolUse?.input as any)?.opcoes)
      ? ((toolUse!.input as any).opcoes as string[])
      : [];

    // Alguns modelos retornam texto vazio quando decidem chamar uma
    // ferramenta (comportamento normal de function calling, não é erro).
    // Só usamos a mensagem de "problema real" quando não há nem texto nem
    // opções — sinal de falha de verdade.
    const reply =
      textBlock?.text ||
      (quickOptions.length > 0
        ? "Show, só mais um detalhe:"
        : "Desculpa, tive um problema para responder agora — pode repetir?");

    return { reply, quickOptions };
  }
}
