import type { ReactNode } from "react";
import { Sparkles, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Alert, AlertDescription } from "@/shared/ui/alert";
import { Badge } from "@/shared/ui/badge";
import { toUserMessage } from "@/shared/lib/errors";
import type { UseMutationResult } from "@tanstack/react-query";
import type { OnDemandSkillResult } from "@/shared/hooks/useAiSkillRun";

interface AiSkillRunPanelProps<TOutput> {
  title: string;
  description?: string;
  runLabel?: string;
  mutation: UseMutationResult<OnDemandSkillResult<TOutput>, unknown, void, unknown>;
  renderResult: (parsed: TOutput) => ReactNode;
  /** Disables execution (e.g. required context missing) with a visible reason. */
  disabledReason?: string;
}

/**
 * Real execution panel of an ON_DEMAND AI Skill: action button, and the
 * loading/error/success/empty states always come from the real backend
 * call — never a decorative card with sample values.
 */
export function AiSkillRunPanel<TOutput>({
  title,
  description,
  runLabel = "Gerar com IA",
  mutation,
  renderResult,
  disabledReason,
}: AiSkillRunPanelProps<TOutput>) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={mutation.isPending || Boolean(disabledReason)}
          onClick={() => mutation.mutate()}
          className="gap-1.5 shrink-0"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          )}
          {mutation.isPending ? "Gerando..." : runLabel}
        </Button>
      </CardHeader>
      <CardContent>
        {disabledReason && !mutation.data && (
          <p className="text-xs text-muted-foreground">{disabledReason}</p>
        )}
        {mutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{toUserMessage(mutation.error)}</AlertDescription>
          </Alert>
        )}
        {mutation.data && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {mutation.data.fromCache && <Badge variant="info">resultado recente reaproveitado</Badge>}
              <span>
                gerado em {new Date(mutation.data.generatedAt).toLocaleString("pt-BR")} · {mutation.data.provider}
              </span>
            </div>
            {renderResult(mutation.data.parsed)}
          </div>
        )}
        {!mutation.data && !mutation.isError && !disabledReason && !mutation.isPending && (
          <p className="text-xs text-muted-foreground">Nenhum resultado gerado ainda.</p>
        )}
      </CardContent>
    </Card>
  );
}
