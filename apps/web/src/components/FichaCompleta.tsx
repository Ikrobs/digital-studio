import { useEffect, useState } from "react";
import styles from "./FichaCompleta.module.css";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3333";

interface FichaData {
  contactId: string;
  lead: {
    ideia?: string | null;
    localCorpo?: string | null;
    tamanho?: string | null;
    estilo?: string | null;
    faixaOrcamento?: string | null;
  };
  contato: {
    nome?: string | null;
    telefone?: string | null;
    endereco?: string | null;
  };
  imagensEnviadas: { imagemUrl: string; enviadaEm: string }[];
  termoConsentimento: { id: string; assinaturaUrl: string; assinadoEm: string } | null;
  anamnese: { id: string; assinaturaUrl: string; assinadoEm: string } | null;
}

interface AnamneseResposta {
  pergunta: string;
  resposta: string;
  detalhe: string;
}

const ANAMNESE_PERGUNTAS = [
  "Possui alguma alergia (tinta, látex, metais, anestésicos)?",
  "Está gestante ou amamentando?",
  "Possui diabetes?",
  "Possui problemas de coagulação sanguínea ou usa anticoagulante?",
  "Está em uso de alguma medicação atualmente?",
  "Possui alguma condição de pele na área a ser tatuada (eczema, psoríase, ferida, queloide)?",
  "Já teve reação alérgica a tatuagem anterior?",
  "Consumiu álcool ou alguma substância nas últimas 24 horas?",
  "Está ciente dos cuidados pós-tatuagem e dos riscos do procedimento?",
];

const TERMO_TEXTO = `Declaro que sou maior de 18 anos (ou estou acompanhado(a) de responsável legal),
decidi por livre e espontânea vontade realizar o procedimento de tatuagem, fui informado(a)
sobre os riscos, cuidados necessários antes e depois da aplicação, e que as informações que
prestei nesta ficha são verdadeiras.`;

export default function FichaCompleta({ leadId }: { leadId?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [ficha, setFicha] = useState<FichaData | null>(null);
  const [loading, setLoading] = useState(false);

  const [termoAceito, setTermoAceito] = useState(false);
  const [termoAssinatura, setTermoAssinatura] = useState("");
  const [termoStatus, setTermoStatus] = useState("");

  const [anamneseRespostas, setAnamneseRespostas] = useState<AnamneseResposta[]>(
    ANAMNESE_PERGUNTAS.map((p) => ({ pergunta: p, resposta: "", detalhe: "" }))
  );
  const [anamneseAssinatura, setAnamneseAssinatura] = useState("");
  const [anamneseStatus, setAnamneseStatus] = useState("");

  async function loadFicha() {
    if (!leadId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/leads/${leadId}/ficha`);
      const data = await res.json();
      setFicha(data);
    } catch {
      setFicha(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (expanded && !ficha) loadFicha();
  }, [expanded]);

  function updateResposta(index: number, campo: "resposta" | "detalhe", valor: string) {
    setAnamneseRespostas((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [campo]: valor };
      return copy;
    });
  }

  async function submitTermo() {
    if (!ficha || !termoAceito || !termoAssinatura.trim()) {
      setTermoStatus("Marque a concordância e digite seu nome completo como assinatura.");
      return;
    }
    setTermoStatus("Enviando...");
    try {
      await fetch(`${API_BASE}/consent-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: ficha.contactId,
          tipo: "termo_consentimento",
          respostas: [{ pergunta: "Declaração", resposta: "Li e concordo" }],
          nomeAssinatura: termoAssinatura.trim(),
        }),
      });
      setTermoStatus("");
      loadFicha();
    } catch {
      setTermoStatus("Erro ao enviar. Tenta de novo?");
    }
  }

  async function submitAnamnese() {
    if (!ficha) return;
    const semResposta = anamneseRespostas.some((r) => !r.resposta);
    if (semResposta || !anamneseAssinatura.trim()) {
      setAnamneseStatus("Responda todas as perguntas e assine com seu nome completo.");
      return;
    }
    setAnamneseStatus("Enviando...");
    try {
      await fetch(`${API_BASE}/consent-forms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactId: ficha.contactId,
          tipo: "anamnese",
          respostas: anamneseRespostas.map((r) => ({
            pergunta: r.pergunta,
            resposta: r.detalhe ? `${r.resposta} — ${r.detalhe}` : r.resposta,
          })),
          nomeAssinatura: anamneseAssinatura.trim(),
        }),
      });
      setAnamneseStatus("");
      loadFicha();
    } catch {
      setAnamneseStatus("Erro ao enviar. Tenta de novo?");
    }
  }

  if (!leadId) return null;

  return (
    <div className={styles.wrapper}>
      <button className={styles.toggleBtn} onClick={() => setExpanded((v) => !v)}>
        {expanded ? "▾" : "▸"} Ficha completa — termo de consentimento e anamnese
      </button>

      {expanded && (
        <div className={styles.body}>
          {loading && <p>Carregando ficha...</p>}

          {ficha && (
            <>
              {/* Dados automáticos — vieram da conversa, só leitura aqui */}
              <div>
                <h3 className={styles.sectionTitle}>Dados já capturados na conversa</h3>
                <div className={styles.autoGrid}>
                  <div className={styles.autoRow}>
                    <span className={styles.autoLabel}>Nome</span>
                    <span>{ficha.contato.nome ?? "—"}</span>
                  </div>
                  <div className={styles.autoRow}>
                    <span className={styles.autoLabel}>Telefone</span>
                    <span>{ficha.contato.telefone ?? "—"}</span>
                  </div>
                  <div className={styles.autoRow}>
                    <span className={styles.autoLabel}>Endereço</span>
                    <span>{ficha.contato.endereco ?? "—"}</span>
                  </div>
                  <div className={styles.autoRow}>
                    <span className={styles.autoLabel}>Ideia</span>
                    <span>{ficha.lead.ideia ?? "—"}</span>
                  </div>
                  <div className={styles.autoRow}>
                    <span className={styles.autoLabel}>Local / tamanho / estilo</span>
                    <span>
                      {[ficha.lead.localCorpo, ficha.lead.tamanho, ficha.lead.estilo].filter(Boolean).join(" · ") ||
                        "—"}
                    </span>
                  </div>
                </div>

                {ficha.imagensEnviadas.length > 0 && (
                  <div className={styles.imageGallery}>
                    {ficha.imagensEnviadas.map((img, i) => (
                      <img key={i} src={img.imagemUrl} alt={`referência ${i + 1}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Termo de consentimento — manual, assinado pelo cliente */}
              <div>
                <h3 className={styles.sectionTitle}>Termo de consentimento</h3>
                {ficha.termoConsentimento ? (
                  <span className={styles.submittedBadge}>
                    Assinado por {ficha.termoConsentimento.assinaturaUrl} em{" "}
                    {new Date(ficha.termoConsentimento.assinadoEm).toLocaleDateString("pt-BR")}
                  </span>
                ) : (
                  <div className={styles.formCard}>
                    <p className={styles.legalText}>{TERMO_TEXTO}</p>
                    <label className={styles.questionLabel}>
                      <input
                        type="checkbox"
                        checked={termoAceito}
                        onChange={(e) => setTermoAceito(e.target.checked)}
                      />{" "}
                      Li e concordo com os termos acima
                    </label>
                    <div className={styles.signatureRow}>
                      <input
                        className={styles.signatureInput}
                        placeholder="Digite seu nome completo como assinatura"
                        value={termoAssinatura}
                        onChange={(e) => setTermoAssinatura(e.target.value)}
                      />
                      <button className={styles.submitBtn} onClick={submitTermo}>
                        Assinar e enviar
                      </button>
                    </div>
                    {termoStatus && <div className={styles.errorMsg}>{termoStatus}</div>}
                  </div>
                )}
              </div>

              {/* Anamnese — manual, sempre preenchida pelo próprio cliente */}
              <div>
                <h3 className={styles.sectionTitle}>Anamnese de saúde</h3>
                {ficha.anamnese ? (
                  <span className={styles.submittedBadge}>
                    Assinado por {ficha.anamnese.assinaturaUrl} em{" "}
                    {new Date(ficha.anamnese.assinadoEm).toLocaleDateString("pt-BR")}
                  </span>
                ) : (
                  <div className={styles.formCard}>
                    {ANAMNESE_PERGUNTAS.map((pergunta, i) => (
                      <div key={pergunta} className={styles.question}>
                        <span className={styles.questionLabel}>{pergunta}</span>
                        <div className={styles.radioRow}>
                          <label>
                            <input
                              type="radio"
                              name={`pergunta-${i}`}
                              checked={anamneseRespostas[i].resposta === "Sim"}
                              onChange={() => updateResposta(i, "resposta", "Sim")}
                            />
                            Sim
                          </label>
                          <label>
                            <input
                              type="radio"
                              name={`pergunta-${i}`}
                              checked={anamneseRespostas[i].resposta === "Não"}
                              onChange={() => updateResposta(i, "resposta", "Não")}
                            />
                            Não
                          </label>
                        </div>
                        {anamneseRespostas[i].resposta === "Sim" && (
                          <input
                            className={styles.detailInput}
                            placeholder="Detalhe (opcional, mas recomendado)"
                            value={anamneseRespostas[i].detalhe}
                            onChange={(e) => updateResposta(i, "detalhe", e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                    <div className={styles.signatureRow}>
                      <input
                        className={styles.signatureInput}
                        placeholder="Digite seu nome completo como assinatura"
                        value={anamneseAssinatura}
                        onChange={(e) => setAnamneseAssinatura(e.target.value)}
                      />
                      <button className={styles.submitBtn} onClick={submitAnamnese}>
                        Assinar e enviar
                      </button>
                    </div>
                    {anamneseStatus && <div className={styles.errorMsg}>{anamneseStatus}</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
