/**
 * shared/hooks/useUploadToR2.ts
 *
 * Upload directo ao Cloudflare R2 via presigned URL do backend.
 * Fluxo: POST /uploads/presign → PUT directo ao R2 → POST /uploads/:id/confirm
 * Retorna a publicUrl permanente para guardar na entidade.
 */
import { useState } from "react";
import { api } from "@/shared/lib/api-client";
import { IntegrationError, UserFacingError } from "@/shared/lib/errors";

interface PresignResponse {
  presignedUrl: string;
  key:          string;
  fileId:       string;
  publicUrl:    string;
}

export type UploadCategory = "documents" | "images" | "audio" | "spreadsheets" | "videos";

export interface UploadToR2Options {
  file:      File;
  category:  UploadCategory;
  entity?:   string;
  entityId?: string;
}

/** Sub-tipo de erro identificável: R2 não configurado no servidor. */
export class R2NotConfiguredError extends UserFacingError {
  constructor(userMessage = "Upload indisponível no momento. Contate o administrador do sistema.") {
    super("R2 storage not configured on the server", userMessage, "R2_NOT_CONFIGURED");
    this.name = "R2NotConfiguredError";
  }
}

/** Matches the API contract by machine code/status, never by message text. */
function isR2NotConfigured(err: unknown): boolean {
  return err instanceof IntegrationError && (err.errorCode === "R2_NOT_CONFIGURED" || err.statusCode === 503);
}

export function useUploadToR2() {
  const [isUploading, setIsUploading] = useState(false);

  async function upload(opts: UploadToR2Options): Promise<{ publicUrl: string; fileId: string }> {
    setIsUploading(true);
    try {
      // 1. Obter presigned URL do backend
      let presign: PresignResponse;
      try {
        presign = await api.post<PresignResponse>("/uploads/presign", {
          fileName:  opts.file.name,
          mimeType:  opts.file.type,
          sizeBytes: opts.file.size,
          category:  opts.category,
          entity:    opts.entity,
          entityId:  opts.entityId,
        });
      } catch (err) {
        if (isR2NotConfigured(err)) {
          throw new R2NotConfiguredError();
        }
        throw err;
      }

      // 2. PUT directo ao R2 — sem headers de auth (URL já está assinada)
      const putRes = await fetch(presign.presignedUrl, {
        method:  "PUT",
        body:    opts.file,
        headers: { "Content-Type": opts.file.type },
      });
      if (!putRes.ok) {
        throw new UserFacingError(`R2 upload failed: ${putRes.status} ${putRes.statusText}`, "Falha ao enviar o arquivo. Tente novamente.");
      }

      // 3. Confirmar upload no backend
      await api.post(`/uploads/${presign.fileId}/confirm`, {});

      return { publicUrl: presign.publicUrl, fileId: presign.fileId };
    } finally {
      setIsUploading(false);
    }
  }

  return { upload, isUploading };
}
