// Estrutura do lead_profile — preenchida progressivamente pelo Orchestrator
// via extração livre de linguagem natural (não árvore de estados fixa).

export interface LeadProfile {
  tipo: "orcamento" | "flash" | "duvida";
  ideia?: string | null;
  localCorpo?: string | null;
  tamanho?: string | null;
  estilo?: string | null;
  faixaOrcamento?: string | null;
  referenciaUrl?: string | null;
}

// Campos obrigatórios para considerar um lead de orçamento "qualificado".
// Usado pelo checklist server-side que injeta o que falta de volta no
// contexto do modelo, sem expor isso como formulário ao cliente.
export const REQUIRED_FIELDS_ORCAMENTO: (keyof LeadProfile)[] = [
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
