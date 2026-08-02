import React, { useState, useRef, useEffect } from "react";
import styles from "./ChatWidget.module.css";

interface ChatMessage {
  autor: "cliente" | "ia";
  conteudo: string;
  imagemUrl?: string;
  quickOptions?: string[];
  isFirstInGroup?: boolean;
}

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3333";

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

interface ChatWidgetProps {
  onProfileUpdate?: (profile: any) => void;
  onLeadIdUpdate?: (leadId: string) => void;
}

export default function ChatWidget({ onProfileUpdate, onLeadIdUpdate }: ChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { autor: "ia", conteudo: "Oi. vamos iniciar seu atendimento", isFirstInGroup: true },
  ]);
  const [input, setInput] = useState("");
  const [pendingImage, setPendingImage] = useState<{ base64: string; mediaType: string; previewUrl: string } | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const phone = useRef(getSessionPhone());

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { base64, mediaType } = await fileToBase64(file);
    setPendingImage({ base64, mediaType, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  async function sendMessage(textoOverride?: string) {
    const texto = (textoOverride ?? input).trim();
    if ((!texto && !pendingImage) || loading) return;

    const imagemParaEnviar = pendingImage;

    setMessages((prev: ChatMessage[]) => [
      ...prev,
      {
        autor: "cliente",
        conteudo: texto || "(imagem enviada)",
        imagemUrl: imagemParaEnviar?.previewUrl,
        isFirstInGroup: true,
      },
    ]);
    setInput("");
    setPendingImage(null);
    setLoading(true);
    setIsTyping(true);

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

      // Reporta o profile atualizado pro painel ao vivo (App.tsx),
      // independente da divisão da resposta em múltiplas bolhas abaixo.
      onProfileUpdate?.(data.profile);
      onLeadIdUpdate?.(data.leadId);

      const blocosDeTexto = (data.reply as string)
        .split(/\n\n+/)
        .map((bloco: string) => bloco.trim())
        .filter((bloco: string) => bloco.length > 0);

      setIsTyping(false);

      for (let index = 0; index < blocosDeTexto.length; index++) {
        setIsTyping(true);
        await delay(750);
        setIsTyping(false);

        const novaMensagem: ChatMessage = {
          autor: "ia",
          conteudo: blocosDeTexto[index],
          quickOptions: index === blocosDeTexto.length - 1 ? data.quickOptions ?? [] : [],
          isFirstInGroup: index === 0,
        };

        setMessages((prev: ChatMessage[]) => [...prev, novaMensagem]);
      }
    } catch {
      setIsTyping(false);
      setMessages((prev: ChatMessage[]) => [
        ...prev,
        { autor: "ia", conteudo: "Deu um problema pra conectar com o servidor. Tenta de novo?", isFirstInGroup: true },
      ]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className={styles.widget}>
      <h2 className={styles.title}>Atendimento — teste ao vivo</h2>
      <div className={styles.sessionLabel}>Sessão: {phone.current}</div>

      <div className={styles.messages}>
        {messages.map((m: ChatMessage, i: number) => {
          const isCliente = m.autor === "cliente";
          return (
            <div
              key={i}
              className={`${styles.messageRow} ${isCliente ? styles.rowCliente : styles.rowIa} ${
                m.isFirstInGroup ? styles.newGroup : ""
              }`}
            >
              <div className={`${styles.bubble} ${isCliente ? styles.bubbleCliente : styles.bubbleIa}`}>
                {m.imagemUrl && <img src={m.imagemUrl} alt="referência enviada" className={styles.thumb} />}
                {m.conteudo}
              </div>

              {m.autor === "ia" && i === lastIndex && !loading && m.quickOptions && m.quickOptions.length > 0 && (
                <div className={styles.quickReplies}>
                  {m.quickOptions.map((opt: string) => (
                    <button key={opt} className={styles.quickChip} onClick={() => sendMessage(opt)}>
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {isTyping && <div className={styles.typing}>digitando…</div>}
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInput(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && sendMessage()}
          placeholder="Digite sua mensagem..."
          disabled={loading}
        />
        <button className={styles.sendBtn} onClick={() => sendMessage()} disabled={loading}>
          Enviar
        </button>
      </div>
    </div>
  );
}
