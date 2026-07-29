import { useState, useRef, useEffect } from "react";
import styles from "./ChatWidget.module.css";

interface ChatMessage {
  autor: "cliente" | "ia";
  conteudo: string;
  imagemUrl?: string;
  quickOptions?: string[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";

function getSessionPhone(): string {
  const key = "estudio_digital_session_phone";
  let phone = localStorage.getItem(key);
  if (!phone) {
    phone = "web-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, phone);
  }
  return phone;
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve({ base64, mediaType: file.type });
    };
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

export default function ChatWidget() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { autor: "ia", conteudo: "Oi. vamos iniciar seu atendimento" },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ base64: string; mediaType: string; previewUrl: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phone = useRef(getSessionPhone());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { base64, mediaType } = await fileToBase64(file);
    setPendingImage({ base64, mediaType, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  async function sendMessage(textoOverride?: string) {
    const texto = (textoOverride ?? input).trim();
    if ((!texto && !pendingImage) || loading) return;

    const imagemParaEnviar = pendingImage;

    setMessages((prev) => [
      ...prev,
      { autor: "cliente", conteudo: texto || "(imagem enviada)", imagemUrl: imagemParaEnviar?.previewUrl },
    ]);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: phone.current,
          mensagem: texto || "Segue imagem de referência.",
          imagemBase64: imagemParaEnviar?.base64,
          imagemMediaType: imagemParaEnviar?.mediaType,
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { autor: "ia", conteudo: data.reply, quickOptions: data.quickOptions ?? [] },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { autor: "ia", conteudo: "Deu um problema pra conectar com o servidor. Tenta de novo?" },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Atendimento — teste ao vivo</h2>
      <div className={styles.sessionLabel}>Sessão: {phone.current}</div>

      <div className={styles.messages}>
        {messages.map((m, i) => (
          <div key={i} style={{ alignSelf: m.autor === "cliente" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
            <div className={`${styles.bubble} ${m.autor === "cliente" ? styles.bubbleCliente : styles.bubbleIa}`}>
              {m.imagemUrl && <img src={m.imagemUrl} alt="referência enviada" className={styles.thumb} />}
              {m.conteudo}
            </div>

            {/* Opções rápidas só aparecem na última mensagem da IA — depois
                de respondida, a próxima pergunta traz suas próprias opções. */}
            {m.autor === "ia" && i === lastIndex && !loading && m.quickOptions && m.quickOptions.length > 0 && (
              <div className={styles.quickReplies}>
                {m.quickOptions.map((opt) => (
                  <button key={opt} className={styles.quickChip} onClick={() => sendMessage(opt)}>
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className={styles.typing}>digitando…</div>}
        <div ref={endRef} />
      </div>

      {pendingImage && (
        <div className={styles.pendingImageRow}>
          <img src={pendingImage.previewUrl} alt="prévia" className={styles.thumb} />
          <span className={styles.pendingImageLabel}>imagem anexada</span>
          <button className={styles.removeImageBtn} onClick={() => setPendingImage(null)}>
            remover
          </button>
        </div>
      )}

      <div className={styles.inputRow}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
        <button
          className={styles.attachBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          title="Anexar imagem de referência"
        >
          📎
        </button>
        <input
          className={styles.textInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Digite sua mensagem..."
        />
        <button className={styles.sendBtn} onClick={() => sendMessage()} disabled={loading}>
          Enviar
        </button>
      </div>
    </div>
  );
}
