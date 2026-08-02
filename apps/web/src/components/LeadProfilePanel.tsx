import styles from "./LeadProfilePanel.module.css";

export interface LeadProfileView {
  nome?: string | null;
  ideia?: string | null;
  localCorpo?: string | null;
  tamanho?: string | null;
  estilo?: string | null;
  faixaOrcamento?: string | null;
}

const FIELD_LABELS: { key: keyof LeadProfileView; label: string }[] = [
  { key: "nome", label: "Nome" },
  { key: "ideia", label: "Ideia" },
  { key: "localCorpo", label: "Local" },
  { key: "tamanho", label: "Tamanho" },
  { key: "estilo", label: "Estilo" },
  { key: "faixaOrcamento", label: "Faixa de valor" },
];

export default function LeadProfilePanel({ profile }: { profile: LeadProfileView }) {
  return (
    <div className={styles.panel}>
      <h3 className={styles.title}>Ficha sendo preenchida</h3>
      <div className={styles.fieldGrid}>
        {FIELD_LABELS.map(({ key, label }) => {
          const value = profile[key];
          const filled = Boolean(value);
          return (
            <div key={key} className={`${styles.field} ${filled ? styles.fieldFilled : styles.fieldEmpty}`}>
              <span className={styles.fieldLabel}>{label}</span>
              <span className={`${styles.fieldValue} ${!filled ? styles.fieldValueEmpty : ""}`}>
                {value || "aguardando"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
