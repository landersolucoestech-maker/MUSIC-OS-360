import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { CompanyLogo } from "@/shared/ui/company-logo";
import { useTenant } from "@/app/providers/TenantContext";
import {
  companyLogoService,
  validateLogoFile,
} from "@/modules/settings/services/company-logo.service";

/**
 * LogoUploader — upload/management of the company logo (Settings → Visual Identity).
 * Persists via companyLogoService (isolated per workspace) and reflects in TenantContext
 * so the identity appears automatically in the other areas.
 */
export function LogoUploader() {
  const { tenant, setTenant } = useTenant();
  const workspaceId = tenant.id;

  const [logoUrl, setLogoUrl] = useState<string | null>(tenant.config.logoUrl ?? null);
  const [isBusy, setIsBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Carrega a logo persistida (MOCK: localStorage) na montagem.
  useEffect(() => {
    let cancelled = false;
    companyLogoService.getLogo(workspaceId).then((url) => {
      if (!cancelled && url) {
        setLogoUrl(url);
        reflectInTenant(url);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  function reflectInTenant(url: string | null) {
    setTenant((prev) => ({
      ...prev,
      config: { ...prev.config, logoUrl: url ?? undefined },
    }));
  }

  async function handleFile(file: File) {
    const validation = await validateLogoFile(file);
    if (!validation.ok) {
      toast.error(validation.error ?? "Arquivo inválido.");
      return;
    }
    setIsBusy(true);
    try {
      const url = await companyLogoService.saveLogo(workspaceId, file);
      setLogoUrl(url);
      reflectInTenant(url);
      toast.success("Logo atualizada com sucesso.");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Falha ao salvar a logo.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRemove() {
    setIsBusy(true);
    try {
      await companyLogoService.removeLogo(workspaceId);
      setLogoUrl(null);
      reflectInTenant(null);
      toast.success("Logo removida.");
    } catch (err) {
      toast.error((err as { message?: string })?.message ?? "Falha ao remover a logo.");
    } finally {
      setIsBusy(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleFile(file);
    e.target.value = ""; // allows re-selecting the same file
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  return (
    <div className="flex flex-col items-center text-center">
      {/* Preview circular com overlay de upload (suporta drag & drop) */}
      <div
        className="relative mb-4 group"
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
      >
        <CompanyLogo
          name={tenant.name}
          logoUrl={logoUrl}
          className={cn("h-24 w-24 rounded-full", dragActive && "ring-2 ring-primary")}
          textClassName="text-2xl"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isBusy}
          aria-label="Alterar logo"
          className="absolute inset-0 flex items-center justify-center rounded-full bg-background/50 opacity-0 transition-opacity group-hover:opacity-100 disabled:cursor-not-allowed"
        >
          {isBusy ? (
            <Loader2 className="h-6 w-6 animate-spin text-foreground" />
          ) : (
            <Camera className="h-6 w-6 text-foreground" />
          )}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={onInputChange}
        data-testid="logo-input"
      />

      <div className="flex items-center gap-2 mt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
        >
          <Camera className="h-3 w-3" />
          {isBusy ? "Enviando..." : "Alterar foto"}
        </Button>
        {logoUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-destructive hover:text-destructive"
            disabled={isBusy}
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
            Remover
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mt-2">PNG, JPG, JPEG ou WEBP · Máx. 5 MB</p>
    </div>
  );
}
