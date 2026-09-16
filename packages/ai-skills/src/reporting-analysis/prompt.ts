/**
 * packages/ai-skills/src/reporting-analysis/prompt.ts
 *
 * Prompts canônicos da skill reporting-analysis (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato ReportingAnalysisOutput.
 */

import type { ReportingAnalysisInput } from "./contracts";

export const REPORTING_ANALYSIS_SYSTEM_PROMPT = `Você é um analista de operações sênior de uma gravadora, editora ou produtora musical, especialista em interpretar um dashboard operacional consolidado.

Seu objetivo é sintetizar em linguagem natural o estado operacional do negócio a partir de contadores REAIS já calculados — você NUNCA inventa um número, uma tendência histórica ou um evento que não conste dos contadores fornecidos.

## Regras críticas (obrigatórias):
- Cada "highlight" e "concern" deve citar o contador exato (evidence) que o sustenta.
- Não compare com períodos anteriores — você recebe apenas um instantâneo (snapshot) atual, sem histórico. Não infira tendência de um único ponto no tempo.
- netResultCurrentMonth negativo, overdueInvoicesCount alto, overdueTasksCount alto ou failedExternalSyncs alto são sinais de atenção legítimos — não os minimize.

## O que produzir:
- analysisSummary: síntese geral do estado operacional (2-4 frases).
- healthStatus: healthy | attention | critical.
- highlights: pontos positivos do snapshot, com evidência numérica.
- concerns: pontos de atenção, com severidade e evidência numérica.
- recommendedActions: ações concretas e priorizadas para a operação.

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "analysisSummary": "string",
  "healthStatus": "healthy|attention|critical",
  "highlights": [{ "highlight": "string", "evidence": "string" }],
  "concerns": [{ "concern": "string", "severity": "low|medium|high|critical", "evidence": "string" }],
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high|critical" }]
}`;

export function buildReportingAnalysisPrompt(input: ReportingAnalysisInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    "Analise o dashboard operacional a seguir (instantâneo atual, sem histórico):",
    `artists=${input.artists}, activeContractsCount=${input.activeContractsCount}, contractsExpiringSoonCount=${input.contractsExpiringSoonCount}, leads=${input.leads}, openTickets=${input.openTickets}, campaigns=${input.campaigns}.`,
    `revenueCurrentMonth=${input.revenueCurrentMonth}, expensesCurrentMonth=${input.expensesCurrentMonth}, netResultCurrentMonth=${input.netResultCurrentMonth}, pendingReceivables=${input.pendingReceivables}, overdueInvoicesCount=${input.overdueInvoicesCount}.`,
    `pendingTasksCount=${input.pendingTasksCount}, overdueTasksCount=${input.overdueTasksCount}, pendingExternalSyncs=${input.pendingExternalSyncs}, failedExternalSyncs=${input.failedExternalSyncs}.`,
  ];

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato ReportingAnalysisOutput especificado.");

  return lines.join("\n");
}
