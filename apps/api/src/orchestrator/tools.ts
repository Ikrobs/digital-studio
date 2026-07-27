import type Anthropic from "@anthropic-ai/sdk";

// Ferramenta principal: extração de slots a partir da mensagem livre do
// cliente. O modelo preenche só o que conseguir identificar — nunca é
// obrigado a preencher tudo de uma vez, e nunca deve "inventar" valor.
export const updateLeadProfileTool: Anthropic.Tool = {
  name: "update_lead_profile",
  description:
    "Atualiza o perfil estruturado do lead com informações extraídas da " +
    "mensagem do cliente. Preencha apenas os campos que o cliente " +
    "mencionou explícita ou implicitamente nesta mensagem. Não repita " +
    "nem sobrescreva campos já preenchidos com informação inventada.",
  input_schema: {
    type: "object",
    properties: {
      ideia: {
        type: "string",
        description: "O que o cliente quer tatuar ou o significado da peça.",
      },
      localCorpo: {
        type: "string",
        description: "Região do corpo mencionada (ex: perna, braço, costas).",
      },
      tamanho: {
        type: "string",
        description: "Tamanho aproximado (ex: pequeno, médio, grande, fechamento).",
      },
      estilo: {
        type: "string",
        description: "Estilo mencionado ou inferido da referência (ex: fine line, blackwork).",
      },
      faixaOrcamento: {
        type: "string",
        description: "Faixa de investimento que o cliente tem em mente.",
      },
    },
  },
};

// Ferramenta de busca de referência real — usa os slots já preenchidos,
// nunca só o texto cru da última mensagem (bug identificado em teste).
export const searchReferenceTool: Anthropic.Tool = {
  name: "search_style_reference",
  description:
    "Busca imagens de referência reais na web para o estilo e local do " +
    "corpo já extraídos no lead_profile. Use sempre os campos estilo + " +
    "localCorpo já preenchidos, não o texto livre do cliente.",
  input_schema: {
    type: "object",
    properties: {
      estilo: { type: "string" },
      localCorpo: { type: "string" },
      elementos: { type: "string", description: "Elementos-chave, ex: beija-flor, folhas." },
    },
    required: ["estilo", "localCorpo"],
  },
};

// Motor de precedentes: busca no PRÓPRIO acervo do artista via similaridade
// de embedding (pgvector), priorizado sobre geração/busca externa.
export const searchPortfolioTool: Anthropic.Tool = {
  name: "search_own_portfolio",
  description:
    "Busca no acervo real de peças já tatuadas pelo artista, por " +
    "similaridade de estilo/elementos/local do corpo. Prioridade sobre " +
    "qualquer imagem gerada ou externa — é prova social real.",
  input_schema: {
    type: "object",
    properties: {
      estilo: { type: "string" },
      localCorpo: { type: "string" },
    },
    required: ["estilo", "localCorpo"],
  },
};

export const allTools: Anthropic.Tool[] = [
  updateLeadProfileTool,
  searchReferenceTool,
  searchPortfolioTool,
];
