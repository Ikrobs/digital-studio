import sharp from "sharp";

export interface DecalResult {
  decalBase64: string;
  decalMediaType: "image/png";
  areasIncompletas: { x: number; y: number; largura: number; altura: number }[];
}

// Kernel de detecção de borda (aproximação de Sobel combinado) — realça
// contornos, não inventa nada: é convolução matemática sobre os pixels reais.
const EDGE_KERNEL = {
  width: 3,
  height: 3,
  kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
};

const GRID_SIZE = 4; // divide a imagem em 4x4 para heurística de área oculta
const OCCLUSION_STD_DEV_THRESHOLD = 8; // células muito uniformes (baixo desvio padrão)
const OCCLUSION_MEAN_THRESHOLD = 60; // e escuras (média baixa) viram suspeitas de oclusão

/**
 * Converte a imagem de referência num decalque (linhas pretas, fundo branco)
 * usando só processamento determinístico — sem modelo generativo, sem
 * invenção de conteúdo. Áreas suspeitas de oclusão (ex: dedo sobre o
 * desenho, sombra dura) são sinalizadas, não preenchidas.
 *
 * Nota de escopo: a correção de perspectiva completa (homografia livre)
 * fica para uma iteração futura — hoje aplicamos apenas correção de
 * orientação via EXIF (.rotate() sem argumento), que resolve o caso mais
 * comum (foto tirada de lado/cabeça pra baixo) mas não distorção angular.
 */
export async function gerarDecalque(imagemBase64: string): Promise<DecalResult> {
  const inputBuffer = Buffer.from(imagemBase64, "base64");

  const image = sharp(inputBuffer).rotate(); // auto-orientação via EXIF

  const { width = 0, height = 0 } = await image.metadata();

  // Heurística de área oculta: analisa estatísticas por célula de uma grade
  // sobre a imagem em escala de cinza. Célula muito uniforme e escura é
  // candidata a oclusão (dedo, sombra dura) — não tentamos adivinhar o que
  // tem por baixo, só marcamos.
  const areasIncompletas: DecalResult["areasIncompletas"] = [];
  if (width > 0 && height > 0) {
    const grayBuffer = await image.clone().grayscale().raw().toBuffer();
    const cellW = Math.floor(width / GRID_SIZE);
    const cellH = Math.floor(height / GRID_SIZE);

    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const { mean, stdDev } = computeCellStats(grayBuffer, width, gx * cellW, gy * cellH, cellW, cellH);
        if (stdDev < OCCLUSION_STD_DEV_THRESHOLD && mean < OCCLUSION_MEAN_THRESHOLD) {
          areasIncompletas.push({ x: gx * cellW, y: gy * cellH, largura: cellW, altura: cellH });
        }
      }
    }
  }

  // Pipeline do decalque: cinza -> realce de borda -> binarização (preto/branco).
  const decalBuffer = await image
    .clone()
    .grayscale()
    .convolve(EDGE_KERNEL)
    .normalize()
    .threshold(128)
    .negate() // bordas realçadas ficam brancas após threshold — inverte pra linha preta em fundo branco
    .png()
    .toBuffer();

  return {
    decalBase64: decalBuffer.toString("base64"),
    decalMediaType: "image/png",
    areasIncompletas,
  };
}

function computeCellStats(
  grayBuffer: Buffer,
  imageWidth: number,
  startX: number,
  startY: number,
  cellW: number,
  cellH: number
): { mean: number; stdDev: number } {
  let sum = 0;
  let count = 0;
  for (let y = startY; y < startY + cellH; y++) {
    for (let x = startX; x < startX + cellW; x++) {
      const idx = y * imageWidth + x;
      if (idx < grayBuffer.length) {
        sum += grayBuffer[idx];
        count++;
      }
    }
  }
  if (count === 0) return { mean: 0, stdDev: 0 };
  const mean = sum / count;

  let variance = 0;
  for (let y = startY; y < startY + cellH; y++) {
    for (let x = startX; x < startX + cellW; x++) {
      const idx = y * imageWidth + x;
      if (idx < grayBuffer.length) {
        variance += (grayBuffer[idx] - mean) ** 2;
      }
    }
  }
  variance /= count;

  return { mean, stdDev: Math.sqrt(variance) };
}
