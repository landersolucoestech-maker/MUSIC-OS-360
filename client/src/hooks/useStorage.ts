import { useState } from "react";
import { toast } from "sonner";
import { DisabledIntegrationError } from "@/lib/disabled-integration";

/**
 * Stub do storage de arquivos. Antes usava Supabase Storage (`documents`
 * bucket); como não há mais backend, todos os métodos avisam o usuário
 * que a integração foi desligada e devolvem valores vazios para a UI
 * legada continuar montando.
 */

interface UploadOptions {
  folder?: string;
}

export function useStorage() {
  const [uploading] = useState(false);
  const [progress] = useState(0);

  const uploadFile = async (_file: File, _options?: UploadOptions) => {
    const err = new DisabledIntegrationError("armazenamento de arquivos");
    toast.error(err.message);
    throw err;
  };

  const getPublicUrl = (_path: string) => {
    return "";
  };

  const getSignedUrl = async (_path: string, _expiresInSeconds = 60) => {
    return null as string | null;
  };

  const downloadFile = async (_path: string) => {
    const err = new DisabledIntegrationError("armazenamento de arquivos");
    toast.error(err.message);
    throw err;
  };

  const deleteFile = async (_path: string) => {
    const err = new DisabledIntegrationError("armazenamento de arquivos");
    toast.error(err.message);
    throw err;
  };

  const listFiles = async (_folder?: string) => {
    return [] as Array<{ name: string; updated_at?: string }>;
  };

  return {
    uploadFile,
    getPublicUrl,
    getSignedUrl,
    downloadFile,
    deleteFile,
    listFiles,
    uploading,
    progress,
  };
}
