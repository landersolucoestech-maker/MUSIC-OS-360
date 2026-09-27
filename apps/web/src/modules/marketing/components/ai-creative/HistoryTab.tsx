import { useMemo, useState } from "react";
import { Copy, ExternalLink, RotateCcw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { toast } from "sonner";
import { MarketingBadge } from "../index";
import { formatDateTime } from "../../utils/marketing-format";
import type { AiSuggestion } from "../../types/marketing.types";
import type { GenerateAiHandler } from "./aiCreative.types";
import { ExportButton, StructuredResult, WorkflowSection } from "./Shared";
import { AI_KIND_LABEL, normalizeResult } from "./aiCreative.utils";

export function HistoryTab({
  suggestions,
  onGenerate,
}: {
  suggestions: AiSuggestion[];
  onGenerate: GenerateAiHandler;
}) {
  const [selected, setSelected] = useState<AiSuggestion | null>(null);
  const rows = useMemo(() => suggestions.slice(0, 30), [suggestions]);

  return (
    <>
      <WorkflowSection
        question="O que já foi gerado anteriormente?"
        result={
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">Selecione uma execução para consultar os detalhes.</p>
            <p className="mt-1 text-xs text-muted-foreground">O histórico guarda resultado, contexto, áudio vinculado e dados operacionais.</p>
          </div>
        }
      >
        {rows.length ? (
          <div className="space-y-3">
            {rows.map((item) => {
              const result = normalizeResult(item.output);
              return (
                <article key={item.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <MarketingBadge tone="neutral">{AI_KIND_LABEL[item.kind]}</MarketingBadge>
                        <MarketingBadge tone="info">Concluído</MarketingBadge>
                        {item.audioMetadata && <MarketingBadge tone="pending">com WAV</MarketingBadge>}
                      </div>
                      <p className="mt-2 text-sm font-medium">{item.targetName || "Empresa"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.at)}</p>
                      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{result.summary}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setSelected(item)}>
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => duplicate(item, onGenerate)}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Duplicar
                      </Button>
                      <ExportButton filename={`ia-criativa-${item.id}.json`} data={item} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-8 text-center">
            <p className="text-sm font-medium">Histórico pronto para registrar novas execuções.</p>
            <p className="mt-1 text-xs text-muted-foreground">Ao gerar uma ideia, análise ou pitch, ela aparecerá aqui com status e resumo.</p>
          </div>
        )}
      </WorkflowSection>
      <HistoryDetails suggestion={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}

function duplicate(item: AiSuggestion, onGenerate: GenerateAiHandler) {
  onGenerate({
    kind: item.kind,
    targetType: item.targetType ?? "empresa",
    targetId: item.targetId,
    targetName: item.targetName ?? "Empresa",
    prompt: item.prompt,
    lyricText: item.lyricText,
    audioUrl: item.audioUrl,
    coverUrl: item.coverUrl,
    audioMetadata: item.audioMetadata,
    releaseMetadata: item.releaseMetadata,
    campaignObjective: item.campaignObjective,
    releasePhase: item.releasePhase,
    genre: item.genre,
    references: item.references,
    audience: item.audience,
    channels: item.channels,
  });
  toast.success("Execução duplicada");
}

function HistoryDetails({
  suggestion,
  onOpenChange,
}: {
  suggestion: AiSuggestion | null;
  onOpenChange: (open: boolean) => void;
}) {
  const result = suggestion ? normalizeResult(suggestion.output) : null;
  return (
    <Dialog open={!!suggestion} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
        {suggestion && result && (
          <>
            <DialogHeader>
              <DialogTitle>{AI_KIND_LABEL[suggestion.kind]}</DialogTitle>
              <DialogDescription>{suggestion.targetName || "Empresa"} · {formatDateTime(suggestion.at)}</DialogDescription>
            </DialogHeader>
            <StructuredResult result={result} />
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(JSON.stringify(suggestion, null, 2))}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar JSON
              </Button>
              <ExportButton filename={`ia-criativa-${suggestion.id}.json`} data={suggestion} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
