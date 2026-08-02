import { useRef, useState } from "react";
import styles from "./PlacementTool.module.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3333";
const CANVAS_MAX_WIDTH = 480;

function getSessionPhone(): string {
  const key = "estudio_digital_session_phone";
  let phone = localStorage.getItem(key);
  if (!phone) {
    phone = "web-" + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(key, phone);
  }
  return phone;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Falha ao carregar imagem"));
    img.src = src;
  });
}

interface Point {
  x: number;
  y: number;
}

export default function PlacementTool() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [hasDecal, setHasDecal] = useState(false);
  const [applied, setApplied] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bodyImageRef = useRef<HTMLImageElement | null>(null);
  const decalImageRef = useRef<HTMLImageElement | null>(null);
  const scaleRef = useRef(1);

  const isDrawingRef = useRef(false);
  const strokePointsRef = useRef<Point[]>([]);

  function redrawBase() {
    const canvas = canvasRef.current;
    const img = bodyImageRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  async function handleBodyPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Carregando foto...");
    const dataUrl = await fileToDataUrl(file);
    const img = await loadImage(dataUrl);
    bodyImageRef.current = img;

    const scale = Math.min(1, CANVAS_MAX_WIDTH / img.width);
    scaleRef.current = scale;

    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
    }
    redrawBase();
    strokePointsRef.current = [];
    setApplied(false);
    setHasPhoto(true);
    setStatus("Foto carregada. Desenhe onde a tatuagem deve ficar.");
    e.target.value = "";
  }

  async function handleReferenceSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Gerando decalque a partir da referência...");
    try {
      const dataUrl = await fileToDataUrl(file);
      const base64 = dataUrl.split(",")[1];

      const res = await fetch(`${API_BASE}/images/decalque`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagemBase64: base64 }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus(`Não foi possível gerar o decalque: ${data.error ?? "erro desconhecido"}`);
        return;
      }

      const decalImg = await loadImage(`data:${data.decalMediaType};base64,${data.decalBase64}`);
      decalImageRef.current = decalImg;
      setHasDecal(true);

      const areasIncompletas = data.areasIncompletas ?? [];
      setStatus(
        areasIncompletas.length > 0
          ? `Decalque gerado. ${areasIncompletas.length} área(s) da referência ficaram parcialmente ocultas — o artista revisa manualmente essas partes.`
          : "Decalque gerado com sucesso."
      );
    } catch {
      setStatus("Erro ao gerar decalque. Tenta de novo?");
    }
    e.target.value = "";
  }

  function getCanvasPoint(e: React.PointerEvent<HTMLCanvasElement>): Point {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!hasPhoto) return;
    isDrawingRef.current = true;
    const point = getCanvasPoint(e);
    strokePointsRef.current.push(point);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const point = getCanvasPoint(e);
    const prev = strokePointsRef.current[strokePointsRef.current.length - 1];

    ctx.strokeStyle = "#8b79ac"; // tinta de decalque — mesma linguagem visual do resto do produto
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();

    strokePointsRef.current.push(point);
  }

  function handlePointerUp() {
    isDrawingRef.current = false;
  }

  function handleClearMarking() {
    strokePointsRef.current = [];
    setApplied(false);
    redrawBase();
    setStatus("Marcação apagada. Desenhe novamente.");
  }

  function computeBoundingBox(): { x: number; y: number; w: number; h: number } | null {
    const points = strokePointsRef.current;
    if (points.length === 0) return null;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    const w = Math.max(...xs) - x;
    const h = Math.max(...ys) - y;
    return { x, y, w: Math.max(w, 30), h: Math.max(h, 30) };
  }

  function handleApplyDecal() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const decal = decalImageRef.current;
    if (!canvas || !ctx || !decal) {
      setStatus("Precisa carregar uma referência e gerar o decalque primeiro.");
      return;
    }
    const bbox = computeBoundingBox();
    if (!bbox) {
      setStatus("Desenha a marcação no local desejado antes de aplicar.");
      return;
    }

    // Sobreposição aproximada — "adesivo solto", sem deformar na curvatura
    // da pele e sem fingir ser um mockup fotorrealista.
    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.drawImage(decal, bbox.x, bbox.y, bbox.w, bbox.h);
    ctx.restore();

    setApplied(true);
    setStatus("Decalque posicionado. Isso é uma referência aproximada, não um mockup final.");
  }

  async function handleSendToStudio() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus("Enviando para o estúdio...");
    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];

    try {
      await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          telefone: getSessionPhone(),
          mensagem: "Marcação aproximada de local enviada pelo cliente.",
          imagemBase64: base64,
          imagemMediaType: "image/png",
        }),
      });
      setSuccess("Enviado! O artista vai revisar essa indicação junto com o resto da conversa.");
      setStatus("");
    } catch {
      setStatus("Falha ao enviar. Tenta de novo?");
    }
  }

  return (
    <div className={styles.wrapper}>
      <button className={styles.toggleBtn} onClick={() => setExpanded((v) => !v)}>
        {expanded ? "▾" : "▸"} Indicar local da tatuagem no corpo (opcional)
      </button>

      {expanded && (
        <div className={styles.body}>
          <div>
            <div className={styles.stepLabel}>1. Foto do local do corpo</div>
            <div className={styles.fileRow}>
              <input type="file" accept="image/*" onChange={handleBodyPhotoSelect} />
            </div>
          </div>

          <div>
            <div className={styles.stepLabel}>2. Imagem de referência da tatuagem</div>
            <div className={styles.fileRow}>
              <input type="file" accept="image/*" onChange={handleReferenceSelect} disabled={!hasPhoto} />
            </div>
          </div>

          {hasPhoto && (
            <div>
              <div className={styles.stepLabel}>3. Desenhe onde a tatuagem deve ficar</div>
              <div className={styles.canvasWrap}>
                <canvas
                  ref={canvasRef}
                  className={styles.canvas}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                />
              </div>
              <div className={styles.hint}>Use o dedo ou o mouse para marcar a área aproximada.</div>
            </div>
          )}

          <div className={styles.actionsRow}>
            <button className={styles.secondaryBtn} onClick={handleClearMarking} disabled={!hasPhoto}>
              Limpar marcação
            </button>
            <button className={styles.actionBtn} onClick={handleApplyDecal} disabled={!hasPhoto || !hasDecal}>
              Aplicar decalque na marcação
            </button>
            <button className={styles.actionBtn} onClick={handleSendToStudio} disabled={!applied}>
              Enviar para o estúdio
            </button>
          </div>

          {status && <div className={styles.statusMsg}>{status}</div>}
          {success && <div className={styles.successMsg}>{success}</div>}
        </div>
      )}
    </div>
  );
}
