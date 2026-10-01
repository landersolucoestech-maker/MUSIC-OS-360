/**
 * Automation flow card — shows a flow blueprint, its sector steps, and a
 * trigger button that runs the flow (generating tasks).
 */

import { Workflow, Play } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { marketingSectorLabel, TASK_TYPE_LABEL } from "../constants/marketing.constants";
import type { AutomationFlow } from "../types/marketing.types";

interface MarketingAutomationFlowCardProps {
  flow: AutomationFlow;
  onRun: (flow: AutomationFlow) => void;
  running?: boolean;
}

export function MarketingAutomationFlowCard({
  flow,
  onRun,
  running,
}: MarketingAutomationFlowCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="rounded-lg border border-primary/15 bg-primary/8 p-2 text-primary shrink-0">
              <Workflow className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-sm font-semibold leading-snug">{flow.name}</CardTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {flow.steps.length} etapas
              </p>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{flow.description}</p>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        <ol className="space-y-1.5 flex-1">
          {flow.steps.map((step, index) => (
            <li key={index} className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground shrink-0">
                {index + 1}
              </span>
              <span className="text-foreground">{step.task}</span>
              <span className="ml-auto whitespace-nowrap text-[10px] text-muted-foreground">
                {marketingSectorLabel(step.sector)} · {TASK_TYPE_LABEL[step.type]}
              </span>
            </li>
          ))}
        </ol>
        <Button
          size="sm"
          className="mt-4 w-full gap-1.5"
          onClick={() => onRun(flow)}
          disabled={running}
        >
          <Play className="h-3.5 w-3.5" />
          {running ? "Gerando tarefas..." : "Executar fluxo"}
        </Button>
      </CardContent>
    </Card>
  );
}
