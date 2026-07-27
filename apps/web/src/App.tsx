import { useEffect, useState } from "react";

interface Lead {
  id: string;
  tipo: string;
  ideia?: string;
  localCorpo?: string;
  tamanho?: string;
  estilo?: string;
  faixaOrcamento?: string;
  prioridade: string;
  criadoEm: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";

export default function App() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/leads`)
      .then((r) => r.json())
      .then(setLeads)
      .catch(() => setLeads([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ fontFamily: "system-ui", padding: 32, maxWidth: 720, margin: "0 auto" }}>
      <h1>Estúdio Digital — Painel</h1>
      <p style={{ color: "#666" }}>
        Placeholder do painel. Próximo passo: layout real + aprovação de agendamento.
      </p>
      {loading && <p>Carregando leads…</p>}
      {!loading && leads.length === 0 && <p>Nenhum lead ainda.</p>}
      <ul>
        {leads.map((lead) => (
          <li key={lead.id} style={{ marginBottom: 12, borderBottom: "1px solid #eee", paddingBottom: 12 }}>
            <strong>{lead.tipo}</strong> — {lead.ideia ?? "sem ideia registrada"}
            <br />
            {lead.localCorpo} · {lead.tamanho} · {lead.estilo} · {lead.faixaOrcamento}
          </li>
        ))}
      </ul>
    </div>
  );
}
