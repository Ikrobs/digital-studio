import { useEffect, useState } from "react";
import ChatWidget from "./components/ChatWidget";
import LeadCard from "./components/LeadCard";
import styles from "./App.module.css";

interface Lead {
  id: string;
  tipo: string;
  status: string;
  ideia?: string;
  localCorpo?: string;
  tamanho?: string;
  estilo?: string;
  faixaOrcamento?: string;
  prioridade: string;
  criadoEm: string;
  contact?: { nome?: string; telefone?: string };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadLeads() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leads`);
      const data = await res.json();
      setLeads(data);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Estúdio Digital</h1>
      <p className={styles.subtitle}>
        Chat à esquerda fala com o Orchestrator de verdade e grava no Postgres.
        Fila de leads à direita reflete o banco em tempo real.
      </p>

      <div className={styles.grid}>
        <ChatWidget />

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Fila de leads</h2>
            <button className={styles.refreshBtn} onClick={loadLeads}>
              atualizar
            </button>
          </div>

          {loading && <p className={styles.emptyState}>Carregando…</p>}
          {!loading && leads.length === 0 && (
            <p className={styles.emptyState}>Nenhum lead ainda — manda uma mensagem no chat.</p>
          )}

          <ul className={styles.leadList}>
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} onChanged={loadLeads} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
