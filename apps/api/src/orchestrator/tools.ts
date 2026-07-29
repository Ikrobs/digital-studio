import type Anthropic from "@anthropic-ai/sdk";

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
      nome: {
        type: "string",
        description: "Como a pessoa quer ser chamada (primeiro nome ou apelido).",
      },
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
        description: "Estilo mencionado, inferido da referência ou da imagem analisada (ex: fine line, blackwork).",
      },
      faixaOrcamento: {
        type: "string",
        description: "Faixa de investimento que o cliente tem em mente.",
      },
    },
  },
};

// Ferramenta nova: o próprio modelo decide, turno a turno, se a pergunta que
// ele está fazendo comporta um pequeno conjunto de respostas prováveis.
// Quando decide que sim, sugere de 2 a 5 opções curtas — o frontend renderiza
// isso como botões atrelados só àquela mensagem específica.
export const suggestQuickOptionsTool: Anthropic.Tool = {
  name: "suggest_quick_options",
  description:
    "Use quando a pergunta que você acabou de fazer tem um conjunto pequeno " +
    "e natural de respostas prováveis (ex: perguntando local do corpo, " +
    "tamanho, ou faixa de orçamento). Sugira de 2 a 5 opções curtas (poucas " +
    "palavras cada) que a pessoa poderia escolher em vez de digitar. Não " +
    "force isso em toda mensagem — só quando fizer sentido real.",
  input_schema: {
    type: "object",
    properties: {
      opcoes: {
        type: "array",
        items: { type: "string" },
        description: "Lista de 2 a 5 opções curtas de resposta.",
      },
    },
    required: ["opcoes"],
  },
};

export const allTools: Anthropic.Tool[] = [
  updateLeadProfileTool,
  suggestQuickOptionsTool,
];
