import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { Download, Eye, FileText } from "lucide-react";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { fetchStoredFileBytes, openStoredFile, uploadFileIdFromUrl } from "@/shared/lib/stored-file";
import { toast } from "sonner";

const pdfWorkerUrl = "/pdf.worker.min.mjs";
const pdfRuntimeUrl = "/pdf.mjs";

export type ChatAttachmentKind = "audio" | "image" | "document";

export interface ChatAttachmentData {
  kind: ChatAttachmentKind;
  name: string;
  url: string;
  mime: string;
}

type AttachmentPreview =
  | { type: "image"; url: string }
  | { type: "audio"; url: string }
  | { type: "pdf"; data: Uint8Array }
  | { type: "html"; html: string }
  | { type: "unsupported"; message: string };

function inferMimeFromName(name: string) {
  const lowerName = name.toLowerCase();
  if (lowerName.endsWith(".pdf")) return "application/pdf";
  if (lowerName.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lowerName.endsWith(".doc")) return "application/msword";
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName)) return "image/*";
  if (/\.(mp3|wav|m4a|ogg|aac|flac|webm)$/.test(lowerName)) return "audio/*";
  return "application/octet-stream";
}

function getAttachmentMime(attachment: ChatAttachmentData) {
  return attachment.mime && attachment.mime !== "application/octet-stream"
    ? attachment.mime
    : inferMimeFromName(attachment.name);
}

export function resolveAttachmentKind(mime: string, name: string): ChatAttachmentKind {
  const normalizedMime = mime && mime !== "application/octet-stream" ? mime : inferMimeFromName(name);
  const lowerName = name.toLowerCase();
  if (normalizedMime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac|flac|webm)$/.test(lowerName)) {
    return "audio";
  }
  if (normalizedMime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(lowerName)) {
    return "image";
  }
  return "document";
}

function isPdf(attachment: ChatAttachmentData) {
  return getAttachmentMime(attachment) === "application/pdf" || attachment.name.toLowerCase().endsWith(".pdf");
}

function isDocx(attachment: ChatAttachmentData) {
  const mime = getAttachmentMime(attachment);
  return mime.includes("wordprocessingml") || attachment.name.toLowerCase().endsWith(".docx");
}

function isWordDocument(attachment: ChatAttachmentData) {
  const mime = getAttachmentMime(attachment);
  const lowerName = attachment.name.toLowerCase();
  return isDocx(attachment) || mime === "application/msword" || lowerName.endsWith(".doc");
}

function downloadAttachment(attachment: ChatAttachmentData) {
  // Documents open through the tenant-checked signed download (find-df79ea88);
  // images/audio keep their direct link (public media categories).
  if (attachment.kind === "document" && uploadFileIdFromUrl(attachment.url)) {
    openStoredFile(attachment.url).catch(() => toast.error("Não foi possível abrir o arquivo."));
    return;
  }
  const anchor = document.createElement("a");
  anchor.href = attachment.url;
  anchor.download = attachment.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function PdfCanvasPreview({ data }: { data: Uint8Array }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    let pdfDocument: { destroy?: () => Promise<void> | void } | null = null;
    const container = containerRef.current;
    if (!container) return undefined;

    container.innerHTML = "";
    setStatus("loading");

    async function renderPdf() {
      try {
        const pdfjs = await import(/* @vite-ignore */ pdfRuntimeUrl);
        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const loadingTask = pdfjs.getDocument({ data: data.slice() });
        const pdf = await loadingTask.promise;
        pdfDocument = pdf;

        if (cancelled) return;

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          if (cancelled) return;

          const viewport = page.getViewport({ scale: 1.35 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas 2D context unavailable");

          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "mx-auto block max-w-full rounded-md bg-white shadow-sm";
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = "auto";

          const pageWrapper = document.createElement("div");
          pageWrapper.className = "mb-4 last:mb-0";
          pageWrapper.appendChild(canvas);
          const currentContainer = containerRef.current;
          if (!currentContainer) return;
          currentContainer.appendChild(pageWrapper);

          await page.render({ canvasContext: context, viewport }).promise;
        }

        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) {
          if (containerRef.current) containerRef.current.innerHTML = "";
          setStatus("error");
        }
      }
    }

    void renderPdf();

    return () => {
      cancelled = true;
      if (containerRef.current) containerRef.current.innerHTML = "";
      void pdfDocument?.destroy?.();
    };
  }, [data]);

  return (
    <div className="relative h-[70vh] w-full overflow-auto rounded-md border border-border bg-muted/20 p-4">
      {status === "loading" && (
        <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
          Carregando PDF...
        </div>
      )}
      {status === "error" && (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
          Não foi possível renderizar este PDF no visualizador.
        </div>
      )}
      <div ref={containerRef} className={status === "error" ? "hidden" : "space-y-4"} />
    </div>
  );
}

export function ChatAttachment({ attachment }: { attachment: ChatAttachmentData }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const [preview, setPreview] = useState<AttachmentPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handleOpenViewer = async () => {
    if (previewLoading) return;
    setPreviewLoading(true);

    try {
      if (attachment.kind === "image") {
        setPreview({ type: "image", url: attachment.url });
        setViewerOpen(true);
        return;
      }

      if (attachment.kind === "audio") {
        setPreview({ type: "audio", url: attachment.url });
        setViewerOpen(true);
        return;
      }

      if (isPdf(attachment)) {
        const arrayBuffer = await fetchStoredFileBytes(attachment.url);
        setPreview({ type: "pdf", data: new Uint8Array(arrayBuffer) });
        setViewerOpen(true);
        return;
      }

      if (isDocx(attachment)) {
        const arrayBuffer = await fetchStoredFileBytes(attachment.url);
        const mammoth = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer });
        // Sanitize the converted HTML before it ever reaches the DOM (CWE-79):
        // a crafted .docx could otherwise inject <script>/onerror/etc.
        const safeHtml = DOMPurify.sanitize(result.value, { USE_PROFILES: { html: true } });
        setPreview({ type: "html", html: safeHtml });
        setViewerOpen(true);
        return;
      }

      if (isWordDocument(attachment)) {
        setPreview({
          type: "unsupported",
          message: "A pré-visualização deste formato do Word não é suportada neste navegador.",
        });
        setViewerOpen(true);
        return;
      }

      setPreview({
        type: "unsupported",
        message: "Pré-visualização indisponível para este tipo de arquivo.",
      });
      setViewerOpen(true);
    } catch {
      setPreview({
        type: "unsupported",
        message: isPdf(attachment)
          ? "Não foi possível carregar o PDF para pré-visualização."
          : "Não foi possível carregar a pré-visualização deste arquivo.",
      });
      setViewerOpen(true);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleViewerOpenChange = (open: boolean) => {
    setViewerOpen(open);
    if (!open) {
      setPreview(null);
    }
  };

  return (
    <div className="mt-2 max-w-[280px]">
      <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 p-2">
        <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{attachment.name}</p>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          disabled={previewLoading}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleOpenViewer();
          }}
        >
          <Eye className="h-3.5 w-3.5" />
          {previewLoading ? "Carregando" : "Visualizar"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            downloadAttachment(attachment);
          }}
        >
          <Download className="h-3.5 w-3.5" />
          Baixar
        </Button>
      </div>

      <Dialog open={viewerOpen && preview !== null} onOpenChange={handleViewerOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="truncate text-sm">{attachment.name}</DialogTitle>
          </DialogHeader>

          {preview?.type === "image" && (
            <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-md border border-border p-2">
              <img src={preview.url} alt={attachment.name} className="max-h-[68vh] w-auto" />
            </div>
          )}

          {preview?.type === "audio" && (
            <div className="rounded-md border border-border p-4">
              <audio controls autoPlay src={preview.url} className="w-full">
                Seu navegador não suporta a reprodução de áudio.
              </audio>
            </div>
          )}

          {preview?.type === "pdf" && (
            <PdfCanvasPreview data={preview.data} />
          )}

          {preview?.type === "html" && (
            <ScrollArea className="h-[70vh] w-full rounded-md border border-border p-4">
              <div
                className="prose prose-sm max-w-none text-foreground"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(preview.html, { USE_PROFILES: { html: true } }) }}
              />
            </ScrollArea>
          )}

          {preview?.type === "unsupported" && (
            <div className="space-y-4 rounded-md border border-border p-4">
              <div>
                <p className="text-sm font-medium text-foreground">{attachment.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{preview.message}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  downloadAttachment(attachment);
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Baixar arquivo
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
