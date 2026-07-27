import Anthropic from "@anthropic-ai/sdk";
import { allTools, updateLeadProfileTool } from "./tools.js";
import { EXTRACTION_SYSTEM_PROMPT, CONVERSATION_SYSTEM_PROMPT } from "./prompts.js";
import { camposFaltantes, type LeadProfile } from "../types/lead.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_EXTRACTION = process.env.MODEL_EXTRACTION ?? "claude-haiku-4-5-20251001";
const MODEL_CONVERSATION = process.env.MODEL_CONVERSATION ?? "claude-sonnet-5";

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface OrchestratorResult {
  reply: string;
  updatedProfile: LeadProfile;
  toolCalls: string[];
}

/**
 * PASSE 1 — Extração (modelo barato).
 * Lê a última mensagem do cliente + perfil atual, retorna o perfil atualizado.
 * Isso roda ANTES da geração de resposta, para que o Passe 2 já saiba
 * exatamente o que falta perguntar.
 */
async function extractLeadProfile(
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
  // Merge: só sobrescreve campos que vieram preenchidos na extração.
  return {
    ...currentProfile,
    ...Object.fromEntries(
      Object.entries(extracted).filter(([, v]) => v !== undefined && v !== "")
    ),
  };
}

/**
 * PASSE 2 — Geração da resposta conversacional (modelo forte).
 * Recebe o histórico, o perfil já atualizado e o checklist do que falta,
 * e gera a próxima fala do atendimento.
 */
async function generateReply(
  history: HistoryTurn[],
  profile: LeadProfile
): Promise<string> {
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

/**
 * Ponto de entrada do Orchestrator para cada turno de conversa.
 */
export async function handleTurn(
  history: HistoryTurn[],
  currentProfile: LeadProfile
): Promise<OrchestratorResult> {
  const lastUserMessage = [...history].reverse().find((t) => t.role === "user")?.content ?? "";

  const updatedProfile = await extractLeadProfile(lastUserMessage, currentProfile);
  const reply = await generateReply(history, updatedProfile);

  return {
    reply,
    updatedProfile,
    toolCalls: ["update_lead_profile"],
  };
}
