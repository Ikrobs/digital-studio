import { useState } from "react";
import styles from "../App.module.css";

interface Message {
  id: string;
  autor: string;
  conteudo: string;
}

interface Lead {
  id: string;
  tipo: string;
  status: string;
  ideia?: string;
  localCorpo?: string;
  tamanho?: string;
  estilo?: string;
  faixaOrcamento?: string;
  contact?: { nome?: string; telefone?: string };
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";

const STATUS_LABEL: Record<string, string> = {
  aguardando: "Aguardando",
  aprovado: "Aprovado",
  recusado: "Recusado",
  perdido: "Perdido",
};

const STATUS_CLASS: Record<string, string> = {
  aguardando: styles.statusAguardando,
  aprovado: styles.statusAprovado,
  recusado: styles.statusRecusado,
  perdido: styles.statusPerdido,
};

export default function LeadCard({ lead, onChanged }: { lead: Lead; onChanged: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [updating, setUpdating] = useState(false);

  async function toggleExpand() {
    if (!expanded && messages === null) {
      const res = await fetch(`${API_BASE}/leads/${lead.id}`);
      const data = await res.json();
      setMessages(data.conversation?.messages ?? []);
    }
    setExpanded((v) => !v);
  }

  async function updateStatus(status: string) {
    setUpdating(true);
    try {
      await fetch(`${API_BASE}/leads/${lead.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      onChanged();
    } finally {
      setUpdating(false);
    }
  }

  return (
    <li className={styles.leadItem}>
      <div className={styles.leadMeta}>
        {lead.tipo} · {lead.contact?.telefone ?? "sem contato"}{" "}
        <span className={`${styles.statusBadge} ${STATUS_CLASS[lead.status] ?? ""}`}>
          {STATUS_LABEL[lead.status] ?? lead.status}
        </span>
      </div>
      <div className={styles.leadIdeia}>{lead.ideia ?? "(ideia ainda não informada)"}</div>
      <div className={styles.leadDetails}>
        {[lead.localCorpo, lead.tamanho, lead.estilo, lead.faixaOrcamento].filter(Boolean).join(" · ") ||
          "aguardando mais detalhes"}
      </div>

      {lead.status === "aguardando" && (
        <div className={styles.leadActions}>
          <button className={styles.actionBtn} disabled={updating} onClick={() => updateStatus("aprovado")}>
            Aprovar consulta
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
            disabled={updating}
            onClick={() => updateStatus("perdido")}
          >
            Marcar como perdido
          </button>
        </div>
      )}

      <button className={styles.expandBtn} onClick={toggleExpand}>
        {expanded ? "ocultar conversa" : "ver conversa completa"}
      </button>

      {expanded && (
        <div className={styles.conversationBox}>
          {(messages ?? []).map((m) => (
            <div key={m.id} className={styles.conversationMsg}>
              <span className={styles.conversationAutor}>{m.autor}:</span> {m.conteudo}
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
