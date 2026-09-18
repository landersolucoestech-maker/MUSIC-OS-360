import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import type { SkillRunEnvelope } from "@/shared/hooks/useSkillRun";

/**
 * SkillRunPanel — botão de disparo + renderização genérica do resultado real
 * de um AI Skill ON_DEMAND. Nenhum valor é inventado aqui: tudo vem de
 * `result.parsed`, o output já validado/parseado pelo backend
 * (packages/ai-skills/*). Os campos de saída de todas as skills ON_DEMAND
 * seguem o padrão `<algo>Summary: string` + N campos de lista estruturada —
 * este painel renderiza esse padrão de forma genérica em vez de duplicar um
 * componente por skill.
 */
export interface SkillRunPanelProps<T extends Record<string, unknown>> {
  label: string;
  disabledReason?: string | null;
  result?: SkillRunEnvelope<T>;
  isRunning: boolean;
  error: Error | null;
  onRun: () => void;
}

function formatFieldLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function ListItem({ item }: { item: unknown }) {
  if (typeof item === "string") return <li className="text-sm text-foreground">{item}</li>;
  if (item && typeof item === "object") {
    const entries = Object.entries(item as Record<string, unknown>).filter(
      ([, v]) => typeof v === "string" || typeof v === "number" || typeof v === "boolean",
    );
    return (
      <li className="text-sm text-foreground">
        {entries.map(([k, v], idx) => (
          <span key={k}>
            {idx > 0 && " · "}
            <span className="text-muted-foreground">{formatFieldLabel(k)}:</span> {String(v)}
          </span>
        ))}
      </li>
    );
  }
  return <li className="text-sm text-foreground">{String(item)}</li>;
}

export function SkillRunResultView<T extends Record<string, unknown>>({ parsed }: { parsed: T }) {
  const entries = Object.entries(parsed);
  const summaryEntry = entries.find(([k, v]) => typeof v === "string" && /summary$/i.test(k));
  const listEntries = entries.filter(([, v]) => Array.isArray(v));
  const scalarEntries = entries.filter(
    ([k, v]) =>
      k !== summaryEntry?.[0] &&
      !Array.isArray(v) &&
      (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v.length < 80)),
  );

  return (
    <div className="space-y-3 rounded-md border bg-muted/20 p-3">
      {summaryEntry && (
        <p className="whitespace-pre-wrap text-sm text-foreground">{summaryEntry[1] as string}</p>
      )}
      {scalarEntries.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {scalarEntries.map(([k, v]) => (
            <Badge key={k} variant="info">
              {formatFieldLabel(k)}: {String(v)}
            </Badge>
          ))}
        </div>
      )}
      {listEntries.map(([key, value]) => {
        const arr = value as unknown[];
        if (arr.length === 0) return null;
        return (
          <div key={key} className="space-y-1">
            <p className="text-xs font-medium tracking-wider text-muted-foreground">{formatFieldLabel(key)}</p>
            <ul className="list-disc space-y-1 pl-4">
              {arr.map((item, idx) => (
                <ListItem key={idx} item={item} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function SkillRunPanel<T extends Record<string, unknown>>({
  label,
  disabledReason,
  result,
  isRunning,
  error,
  onRun,
}: SkillRunPanelProps<T>) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRun}
        disabled={isRunning || !!disabledReason}
        title={disabledReason ?? undefined}
      >
        {isRunning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
        {label}
      </Button>
      {disabledReason && !result && (
        <p className="text-xs italic text-muted-foreground">{disabledReason}</p>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}
      {result && (
        <>
          <SkillRunResultView parsed={result.parsed} />
          <p className="text-xs text-muted-foreground">
            {result.fromCache ? "Resultado reaproveitado (cache)" : "Gerado agora"} · {result.provider}/{result.model}
          </p>
        </>
      )}
    </div>
  );
}
