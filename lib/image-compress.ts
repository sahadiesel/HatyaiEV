/** บีบอัดรูปฝั่งเบราว์เซอร์ให้ไม่เกิน maxBytes (ค่าเริ่มต้น 1 MB) */

const DEFAULT_MAX_BYTES = 1024 * 1024;
const MAX_EDGE = 1600;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("แปลงรูปไม่สำเร็จ"));
        else resolve(blob);
      },
      type,
      quality,
    );
  });
}

function drawScaled(img: HTMLImageElement, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("ไม่รองรับ canvas");
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas;
}

/**
 * ถ้ารูปใหญ่เกิน maxBytes จะย่อความละเอียด / ลดคุณภาพให้อัตโนมัติ
 * พยายามคงพื้นหลังโปร่งใสด้วย PNG/WebP เมื่อเป็นไปได้
 */
export async function compressImageIfNeeded(
  file: File,
  maxBytes = DEFAULT_MAX_BYTES,
): Promise<{ file: File; wasCompressed: boolean }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("ไฟล์ต้องเป็นรูปภาพ");
  }
  if (file.size <= maxBytes) {
    return { file, wasCompressed: false };
  }

  const img = await loadImage(file);
  let maxEdge = MAX_EDGE;
  let best: { blob: Blob; type: string; name: string } | null = null;

  const preferTransparent = file.type === "image/png" || file.type === "image/webp";

  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = drawScaled(img, maxEdge);

    const candidates: { type: string; quality?: number; ext: string }[] = preferTransparent
      ? [
          { type: "image/webp", quality: 0.85 - attempt * 0.08, ext: "webp" },
          { type: "image/png", ext: "png" },
          { type: "image/jpeg", quality: 0.82 - attempt * 0.08, ext: "jpg" },
        ]
      : [
          { type: "image/jpeg", quality: 0.85 - attempt * 0.08, ext: "jpg" },
          { type: "image/webp", quality: 0.85 - attempt * 0.08, ext: "webp" },
          { type: "image/png", ext: "png" },
        ];

    for (const c of candidates) {
      const q = c.quality != null ? Math.max(0.4, c.quality) : undefined;
      try {
        const blob = await canvasToBlob(canvas, c.type, q);
        if (!best || blob.size < best.blob.size) {
          const base = file.name.replace(/\.[^.]+$/, "") || "image";
          best = { blob, type: c.type, name: `${base}.${c.ext}` };
        }
        if (blob.size <= maxBytes) {
          const out = new File([blob], best.name, { type: c.type, lastModified: Date.now() });
          return { file: out, wasCompressed: true };
        }
      } catch {
        /* เบราว์เซอร์อาจไม่รองรับ webp encode */
      }
    }

    maxEdge = Math.round(maxEdge * 0.75);
    if (maxEdge < 320) break;
  }

  if (best && best.blob.size < file.size) {
    const out = new File([best.blob], best.name, { type: best.type, lastModified: Date.now() });
    if (out.size <= maxBytes) {
      return { file: out, wasCompressed: true };
    }
    // ยังเกินเล็กน้อยแต่ดีกว่าต้นฉบับ — ยอมอัปโหลดถ้าใกล้เคียง หรือ throw
    if (out.size <= maxBytes * 1.05) {
      return { file: out, wasCompressed: true };
    }
    throw new Error("ย่อรูปแล้วยังใหญ่เกิน 1 MB — ลองใช้ไฟล์ที่ความละเอียดต่ำลง");
  }

  throw new Error("ไม่สามารถย่อรูปให้ต่ำกว่า 1 MB ได้");
}
