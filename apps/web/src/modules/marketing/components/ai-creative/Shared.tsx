import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Copy, Download, FileAudio, RefreshCw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";
import { AsyncEntityCombobox } from "@/shared/components/AsyncEntityCombobox";
import { MarketingBadge } from "../index";
import type { AiAudioMetadata, AiGeneratedResult } from "../../types/marketing.types";
import type { ResultActionProps, TargetOption } from "./aiCreative.types";
import { formatBytes, getExtension, MAX_WAV_SIZE_BYTES, validateWavFile } from "./aiCreative.utils";

export function WorkflowSection({
  question,
  children,
  result,
}: {
  question: string;
  children: ReactNode;
  result: ReactNode;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,0.75fr)]">
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs font-semibold tracking-wide text-primary">Pergunta principal</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">{question}</h2>
        <div className="mt-5 space-y-4">{children}</div>
      </section>
      <section className="rounded-lg border border-border bg-card p-5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground">Resultado</p>
        <div className="mt-4">{result}</div>
      </section>
    </div>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

export function EntitySelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: TargetOption[];
  placeholder: string;
  onChange: (option: TargetOption) => void;
  disabled?: boolean;
}) {
  return (
    <Field label={label}>
      <Select
        value={value}
        disabled={disabled || options.length === 0}
        onValueChange={(id) => {
          const option = options.find((item) => item.id === id);
          if (option) onChange(option);
        }}
      >
        <SelectTrigger>
          <SelectValue placeholder={options.length ? placeholder : "Nenhum registro disponível"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.helper ? `${option.label} · ${option.helper}` : option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type EntityRow = Record<string, unknown> & { id: string };

function bestLabel(item: EntityRow): string {
  return String(
    item.nome_artistico || item.title || item.nome || item.name || item.id,
  );
}

/**
 * Task J — server-side version of EntitySelect: real search (useEntityLookup)
 * instead of a static `options` array built from an unfiltered useArtistas()/
 * useProjetos() (capped at the tenant's first 50). Same
 * onChange(TargetOption) contract as the screens already using EntitySelect,
 * so no layout/flow change is required — only the data source changes.
 */
export function AsyncEntitySelect({
  label,
  value,
  table,
  filters,
  placeholder,
  searchPlaceholder,
  emptyText,
  onChange,
  disabled,
  getHelper,
}: {
  label: string;
  value: string;
  table: string;
  filters?: Record<string, unknown>;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  onChange: (option: TargetOption) => void;
  disabled?: boolean;
  getHelper?: (item: EntityRow) => string | undefined;
}) {
  return (
    <Field label={label}>
      <AsyncEntityCombobox<EntityRow>
        table={table}
        filters={filters}
        value={value || null}
        onChange={(id, item) => {
          if (!id || !item) return;
          onChange({ id, label: bestLabel(item), helper: getHelper?.(item) });
        }}
        getLabel={bestLabel}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder ?? "Buscar…"}
        emptyText={emptyText ?? "Nenhum registro encontrado"}
        disabled={disabled}
      />
    </Field>
  );
}

export function BriefingTextarea({
  value,
  onChange,
  placeholder = "Descreva o contexto essencial para a IA trabalhar.",
  rows = 5,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <Field label="Briefing">
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} placeholder={placeholder} />
    </Field>
  );
}

export function AudioUpload({
  metadata,
  onChange,
  required,
}: {
  metadata?: AiAudioMetadata;
  onChange: (file: File | undefined, metadata: AiAudioMetadata | undefined, error: string) => void;
  required?: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const validation = validateWavFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (validation) {
      setError(validation);
      setPreviewUrl("");
      onChange(undefined, undefined, validation);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const nextMetadata = {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      extension: getExtension(file.name),
      lastModified: file.lastModified,
    };
    setError("");
    setPreviewUrl(URL.createObjectURL(file));
    onChange(file, nextMetadata, "");
  };

  const removeFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setError("");
    onChange(undefined, undefined, "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <Field label={`Áudio WAV${required ? " *" : ""}`}>
      <div className="rounded-lg border border-dashed border-border p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">.wav ate {formatBytes(MAX_WAV_SIZE_BYTES)}. Pré-visualização local; o envio usa o armazenamento do servidor.</p>
          <div className="flex items-center gap-2">
            <Input ref={fileInputRef} type="file" accept=".wav,audio/wav,audio/x-wav" onChange={handleChange} className="max-w-[250px]" />
            {metadata && (
              <Button type="button" variant="ghost" size="icon" onClick={removeFile} aria-label="Remover áudio">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {metadata && (
        <div className="rounded-lg border border-border bg-muted/25 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <FileAudio className="h-4 w-4 text-primary" />
            <span className="font-medium">{metadata.fileName}</span>
            <MarketingBadge tone="neutral">{formatBytes(metadata.fileSize)}</MarketingBadge>
          </div>
          {previewUrl && <audio controls src={previewUrl} className="mt-3 w-full" />}
        </div>
      )}
    </Field>
  );
}

export function ResultActions({ result, onCopy, onRegenerate, onSave, canRegenerate, isGenerating }: ResultActionProps) {
  if (!result) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" onClick={onCopy}>
        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar
      </Button>
      <Button type="button" variant="outline" size="sm" disabled={!canRegenerate || isGenerating} onClick={onRegenerate}>
        <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerar
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={onSave ?? (() => toast.success("Resultado salvo no histórico"))}>
        <Save className="mr-1.5 h-3.5 w-3.5" /> Salvar
      </Button>
    </div>
  );
}

export function StructuredResult({ result, compact = false }: { result: AiGeneratedResult | null; compact?: boolean }) {
  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center">
        <p className="text-sm font-medium">Nenhum resultado gerado ainda.</p>
        <p className="mt-1 text-xs text-muted-foreground">Configure o fluxo e execute a ação principal para ver a resposta aqui.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-sm font-semibold">Resumo Executivo</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{result.summary}</p>
      </section>
      {!compact && <ResultText title="Direção criativa" text={result.creativeDirection} />}
      <div className="grid gap-3 md:grid-cols-2">
        <ResultList title="Posicionamento" items={result.positioning} />
        <ResultList title="Público" items={result.audience} />
        <ResultList title="Oportunidades" items={[...result.strengths, ...result.campaignIdeas]} />
        <ResultList title="Riscos" items={result.risks} />
        <ResultList title="Conteúdos" items={result.contentIdeas} />
        <ResultList title="Próximos passos" items={result.nextActions} />
      </div>
    </div>
  );
}

export function ResultText({ title, text }: { title: string; text?: string }) {
  if (!text) return null;
  return (
    <section className="rounded-lg border border-border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </section>
  );
}

export function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-lg border border-border bg-muted/20 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length ? (
        <ul className="mt-2 space-y-1.5">
          {items.map((item) => (
            <li key={item} className="text-sm leading-relaxed text-muted-foreground">{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Aguardando processamento desta seção.</p>
      )}
    </section>
  );
}

export function copyResult(result: AiGeneratedResult | null) {
  if (!result) return;
  const text = [
    result.summary,
    result.creativeDirection,
    ...result.positioning,
    ...result.contentIdeas,
    ...result.campaignIdeas,
    ...result.pitchSuggestions,
    ...result.nextActions,
  ].filter(Boolean).join("\n");
  navigator.clipboard?.writeText(text);
  toast.success("Resultado copiado");
}

export function ExportButton({ filename, data }: { filename: string; data: unknown }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      <Download className="mr-1.5 h-3.5 w-3.5" /> Exportar
    </Button>
  );
}
