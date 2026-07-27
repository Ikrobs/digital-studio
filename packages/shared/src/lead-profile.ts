export interface LeadProfile {
  tipo: "orcamento" | "flash" | "duvida";
  ideia?: string | null;
  localCorpo?: string | null;
  tamanho?: string | null;
  estilo?: string | null;
  faixaOrcamento?: string | null;
  referenciaUrl?: string | null;
}
