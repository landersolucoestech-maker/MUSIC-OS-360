/**
 * marketing/creative/static-export.ts
 *
 * Real canvas composition of the News creative template (creative-template-
 * surface.tsx's structure: identity header + caption, then a FULL or SPLIT
 * media region with a centered watermark) into a downloadable PNG.
 *
 * Media bytes are fetched through the API's own authenticated
 * /uploads/:fileId/raw endpoint (see uploads.controller.ts), not the R2
 * origin directly -- the resulting <img> is decoded from a same-origin
 * blob: URL, which never taints a canvas regardless of R2's own
 * (unverifiable, infrastructure-level) CORS configuration. This is the
 * repository-native alternative to relying on R2 CORS: the API already has
 * an explicit, code-controlled CORS policy (create-app.ts) and the upload
 * pipeline already tracks a fileId per uploaded asset -- no new external
 * dependency, no parallel storage path.
 *
 * A slot with no fileId (picked from the project asset library rather than
 * uploaded through this editor) has no upload-row association, so its
 * bytes cannot be fetched through the proxy -- export fails explicitly with
 * CreativeExportError for that slot rather than silently producing a
 * blank/broken PNG.
 *
 * Video slots have no static frame to draw (no server-side video-processing
 * pipeline exists in this repository -- see docs on the video-export
 * blocker) -- rendered as a clearly labeled placeholder pane, never a faked
 * frame.
 */
import { API_BASE_URL } from "@/shared/lib/env";
import { getAccessToken, getTenantId, setAccessToken } from "@/shared/lib/api-client";
import { displayUsername, type CreativeConfig, type CreativeSlot } from "../types/creative.types";
import type { AspectRatio } from "../config/social-formats";

export class CreativeExportError extends Error {}

const EXPORT_WIDTH = 1080;

// find-2cf48add: this raw-bytes fetch can't go through api-client.ts's
// request() (it needs a Blob, not a JSON envelope), which meant it also
// lost that pipeline's timeout and 401 handling -- a hung request left the
// export spinner stuck forever, and an expired session surfaced a raw HTTP
// 401 instead of the app's normal re-login signal. Mirrors api-client.ts's
// own REQUEST_TIMEOUT_MS.
const FETCH_TIMEOUT_MS = 10_000;

const ASPECT_RATIO_VALUE: Record<AspectRatio, number> = {
  "1:1": 1,
  "4:5": 4 / 5,
  "9:16": 9 / 16,
  "16:9": 16 / 9,
};

async function fetchSlotBlob(slot: { fileId?: string }): Promise<Blob> {
  if (!slot.fileId) {
    throw new CreativeExportError(
      "Este item foi selecionado da biblioteca do projeto e não pode ser exportado -- envie-o novamente pelo editor para habilitar a exportação em imagem.",
    );
  }
  const headers: Record<string, string> = {};
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const tenantId = getTenantId();
  if (tenantId) headers["X-Tenant-ID"] = tenantId;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/uploads/${slot.fileId}/raw`, {
      headers,
      credentials: "include",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new CreativeExportError("Tempo esgotado ao carregar mídia para exportação.");
    }
    throw new CreativeExportError("Falha de conexão ao carregar mídia para exportação.");
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    setAccessToken(null);
    throw new CreativeExportError("Sessão expirada -- faça login novamente para exportar.");
  }
  if (!res.ok) {
    throw new CreativeExportError(`Falha ao carregar mídia para exportação (HTTP ${res.status}).`);
  }
  return res.blob();
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new CreativeExportError("Falha ao decodificar imagem para exportação."));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** object-fit: cover equivalent. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number): void {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  let sx: number, sy: number, sw: number, sh: number;
  if (imgRatio > boxRatio) {
    sh = img.height;
    sw = sh * boxRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / boxRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** object-fit: contain equivalent, with opacity (used for the watermark). */
function drawContain(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, opacity: number): void {
  const imgRatio = img.width / img.height;
  const boxRatio = w / h;
  const dw = imgRatio > boxRatio ? w : h * imgRatio;
  const dh = imgRatio > boxRatio ? w / imgRatio : h;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

/** line-clamp-3 equivalent: word-wrap then ellipsize at the line cap. Returns total height consumed. */
function drawClampedText(ctx: CanvasRenderingContext2D, text: string, x: number, firstBaselineY: number, maxWidth: number, lineHeight: number, maxLines: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (lines.length < maxLines && current) lines.push(current);

  const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
  if (consumedWords < words.length && lines.length > 0) {
    let last = lines[lines.length - 1];
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    lines[lines.length - 1] = `${last}…`;
  }

  lines.forEach((line, i) => ctx.fillText(line, x, firstBaselineY + i * lineHeight));
  return lines.length * lineHeight;
}

async function drawSlotOrPlaceholder(ctx: CanvasRenderingContext2D, slot: CreativeSlot | null, x: number, y: number, w: number, h: number): Promise<void> {
  if (!slot) {
    ctx.fillStyle = "#f3f4f6";
    ctx.fillRect(x, y, w, h);
    return;
  }
  if (slot.kind === "video") {
    ctx.fillStyle = "#111827";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#9ca3af";
    ctx.font = "400 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Vídeo (sem frame estático disponível)", x + w / 2, y + h / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    return;
  }
  const img = await loadImage(await fetchSlotBlob(slot));
  drawCover(ctx, img, x, y, w, h);
}

/**
 * Composes the current CreativeConfig into a real PNG at the given social
 * format's aspect ratio. Throws CreativeExportError (never a silent
 * fallback) when a slot cannot be safely read into the canvas.
 */
export async function exportCreativeToPng(creative: CreativeConfig, aspect: AspectRatio): Promise<Blob> {
  const width = EXPORT_WIDTH;
  const height = Math.round(width / (ASPECT_RATIO_VALUE[aspect] ?? 1));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CreativeExportError("Canvas 2D não suportado neste navegador.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const paddingX = 36;
  const hasIdentity = !!(creative.profileAvatar || creative.profileName || creative.username);
  const hasHeader = hasIdentity || !!creative.caption;
  let cursorY = 30;

  if (hasHeader) {
    if (hasIdentity) {
      const avatarSize = 56;
      const avatarCx = paddingX + avatarSize / 2;
      const avatarCy = cursorY + avatarSize / 2;

      if (creative.profileAvatar) {
        const img = await loadImage(await fetchSlotBlob(creative.profileAvatar));
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        drawCover(ctx, img, paddingX, cursorY, avatarSize, avatarSize);
        ctx.restore();
      } else {
        ctx.fillStyle = "#e5e7eb";
        ctx.beginPath();
        ctx.arc(avatarCx, avatarCy, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      const textX = paddingX + avatarSize + 14;
      const textMaxWidth = width - textX - paddingX;
      ctx.textBaseline = "alphabetic";
      if (creative.profileName) {
        ctx.fillStyle = "#0a0a0a";
        ctx.font = "600 30px system-ui, sans-serif";
        ctx.fillText(creative.profileName, textX, cursorY + 24, textMaxWidth);
      }
      if (creative.username) {
        ctx.fillStyle = "#6b7280";
        ctx.font = "400 24px system-ui, sans-serif";
        ctx.fillText(displayUsername(creative.username), textX, cursorY + 50, textMaxWidth);
      }
      cursorY += avatarSize + 18;
    }

    if (creative.caption) {
      ctx.fillStyle = "#0a0a0a";
      ctx.font = "400 26px system-ui, sans-serif";
      ctx.textBaseline = "alphabetic";
      const consumed = drawClampedText(ctx, creative.caption, paddingX, cursorY + 26, width - paddingX * 2, 34, 3);
      cursorY += consumed + 16;
    } else {
      cursorY += 10;
    }
  }

  const mediaY = cursorY;
  const mediaHeight = height - mediaY;

  if (mediaHeight > 0) {
    const isSplit = creative.layout === "split";
    if (isSplit) {
      const half = width / 2;
      await drawSlotOrPlaceholder(ctx, creative.primarySlot, 0, mediaY, half, mediaHeight);
      await drawSlotOrPlaceholder(ctx, creative.secondarySlot, half, mediaY, half, mediaHeight);
    } else {
      await drawSlotOrPlaceholder(ctx, creative.primarySlot, 0, mediaY, width, mediaHeight);
    }

    if (creative.watermark.enabled) {
      const cx = width / 2;
      const cy = mediaY + mediaHeight / 2;
      if (creative.watermark.assetUrl) {
        const img = await loadImage(await fetchSlotBlob(creative.watermark));
        const size = 72;
        drawContain(ctx, img, cx - size / 2, cy - size / 2, size, size, creative.watermark.opacity);
      } else {
        ctx.save();
        ctx.globalAlpha = creative.watermark.opacity;
        ctx.font = "700 20px system-ui, sans-serif";
        const label = "MARCA D'ÁGUA";
        const textWidth = ctx.measureText(label).width;
        const padX = 12;
        const padY = 8;
        const boxW = textWidth + padX * 2;
        const boxH = 20 + padY * 2;
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.fillRect(cx - boxW / 2, cy - boxH / 2, boxW, boxH);
        ctx.fillStyle = "#374151";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, cx, cy);
        ctx.restore();
      }
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new CreativeExportError("Falha ao gerar PNG a partir do canvas."));
    }, "image/png");
  });
}

/** Triggers a browser download of the given blob -- standard, no external dependency. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
