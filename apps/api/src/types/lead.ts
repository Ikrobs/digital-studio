// Estrutura do lead_profile — preenchida progressivamente pelo Orchestrator
// via extração livre de linguagem natural (não árvore de estados fixa).

export interface LeadProfile {
  nome?: string | null;
  endereco?: string | null;
  tipo: "orcamento" | "flash" | "duvida";
  ideia?: string | null;
  localCorpo?: string | null;
  tamanho?: string | null;
  estilo?: string | null;
  faixaOrcamento?: string | null;
  referenciaUrl?: string | null;
}

// Ordem importa: "nome" vem primeiro porque o atendente deve perguntar como
// chamar a pessoa antes de aprofundar no projeto.
export const REQUIRED_FIELDS_ORCAMENTO: (keyof LeadProfile)[] = [
  "nome",
  "ideia",
  "localCorpo",
  "tamanho",
  "estilo",
  "faixaOrcamento",
];

export function camposFaltantes(profile: LeadProfile): (keyof LeadProfile)[] {
  if (profile.tipo !== "orcamento") return [];
  return REQUIRED_FIELDS_ORCAMENTO.filter((campo) => !profile[campo]);
}

export function leadQualificado(profile: LeadProfile): boolean {
  return camposFaltantes(profile).length === 0;
}
