/**
 * company-logo.service.ts — management of the company/workspace logo.
 *
 * MULTI-TENANT: the logo is always isolated per workspaceId. Never share it
 * across organizations.
 *
 *   `company-logo:{workspaceId}`. Mirrors the last logo into a public preview
 *   key (`company-logo:__public__`) only to demonstrate, in dev, the
 *   rendering on the public /cadastro/:slug page.
 * - Production: sends/reads via the backend, using the project's already existing storage
 *   (Cloudflare R2) under `company-logos/{workspaceId}/logo`. The endpoints below
 *   will be implemented in the backend later.
 *
 * BACKEND CONTRACT (future):
 *   POST   /workspaces/{id}/logo   (multipart file)  -> { logoUrl }
 *   DELETE /workspaces/{id}/logo                       -> 204
 *   GET    /public/workspaces/{slug}                   -> { ..., logoUrl }
 */
import { API_BASE_URL } from "@/shared/lib/env";
import { getAccessToken, getTenantId } from "@/shared/lib/api-client";
import { UserFacingError } from "@/shared/lib/errors";

export const ALLOWED_LOGO_MIME = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

export const ALLOWED_LOGO_EXT = ["png", "jpg", "jpeg", "webp"];
export const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

export interface LogoValidationResult {
  ok: boolean;
  error?: string;
}


function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Reads the magic bytes and confirms the content matches an allowed image format. */
async function hasValidMagicBytes(file: File): Promise<boolean> {
  const buf = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const b = (i: number) => buf[i];
  // PNG: 89 50 4E 47
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4e && b(3) === 0x47) return true;
  // JPEG: FF D8 FF
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return true;
  // WEBP: "RIFF"...."WEBP"
  if (
    b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 &&
    b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50
  ) return true;
  return false;
}

/**
 * Validates the logo file in the frontend: format, size and real integrity
 * (magic bytes — blocks executables and masked extensions).
 */
export async function validateLogoFile(file: File): Promise<LogoValidationResult> {
  const ext = extOf(file.name);
  const mimeOk = (ALLOWED_LOGO_MIME as readonly string[]).includes(file.type);
  const extOk = ALLOWED_LOGO_EXT.includes(ext);

  if (!mimeOk || !extOk) {
    return { ok: false, error: "Formato inválido. Use PNG, JPG, JPEG ou WEBP." };
  }
  if (file.size === 0) {
    return { ok: false, error: "Arquivo vazio ou corrompido." };
  }
  if (file.size > MAX_LOGO_BYTES) {
    return { ok: false, error: "Arquivo muito grande. Tamanho máximo: 5 MB." };
  }
  if (!(await hasValidMagicBytes(file))) {
    return { ok: false, error: "O conteúdo do arquivo não corresponde a uma imagem válida." };
  }
  return { ok: true };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new UserFacingError("FileReader failed to read the logo file", "Falha ao ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export const companyLogoService = {
  /** Returns the workspace logo (URL/dataURL) or null when there is none. */
  async getLogo(workspaceId: string): Promise<string | null> {
    if (!workspaceId) return null;
    // Production: logoUrl comes aggregated in the workspace data (backend).
    // Kept here only for symmetry — it normally already exists in TenantConfig.
    return null;
  },

  /**
   * Validates and saves the logo. Returns the final URL/dataURL.
   * Throws an Error with a friendly message on an invalid validation.
   */
  async saveLogo(workspaceId: string, file: File): Promise<string> {
    if (!workspaceId) throw new UserFacingError("No tenant id available for logo upload", "Workspace não identificado.");
    const validation = await validateLogoFile(file);
    if (!validation.ok) throw new UserFacingError("Invalid logo file", validation.error ?? "Arquivo inválido.");

    // Production: multipart upload to the backend (R2). Endpoint to be implemented in the backend.
    const form = new FormData();
    form.append("file", file);
    const token = getAccessToken();
    const tenantId = getTenantId();
    const res = await fetch(
      `${API_BASE_URL}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/logo`,
      {
        method: "POST",
        body: form, // no manual Content-Type: the browser sets the multipart boundary
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(tenantId ? { "X-Tenant-ID": tenantId } : {}),
        },
      },
    );
    if (!res.ok) throw new UserFacingError("Logo upload failed", "Falha ao enviar a logo. Tente novamente.");
    const payload = (await res.json()) as { data?: { logoUrl: string }; logoUrl?: string };
    return payload.data?.logoUrl ?? payload.logoUrl ?? "";
  },

  /** Remove a logo do workspace. */
  async removeLogo(workspaceId: string): Promise<void> {
    if (!workspaceId) return;
    const { api } = await import("@/shared/lib/api-client");
    await api.delete(`/workspaces/${encodeURIComponent(workspaceId)}/logo`);
  },
};
