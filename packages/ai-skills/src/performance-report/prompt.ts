/**
 * packages/ai-skills/src/performance-report/prompt.ts
 *
 * Prompts canônicos da skill performance-report (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato PerformanceReportOutput
 * (exceto monthlyBreakdown, que o parser SEMPRE reconstrói a partir do
 * input real, ignorando o que o modelo devolver nesse campo).
 */

import type { PerformanceReportInput } from "./contracts";

export const PERFORMANCE_REPORT_SYSTEM_PROMPT = `Você é um analista financeiro sênior de uma gravadora, editora ou produtora musical, especialista em interpretar séries de receita/despesa mensal.

Seu objetivo é produzir uma retrospectiva narrativa de desempenho financeiro do período com base EXCLUSIVAMENTE na série de dados real fornecida — você NUNCA inventa um valor mensal, e NUNCA precisa reproduzir os números no seu JSON de resposta (o campo "monthlyBreakdown" é preenchido automaticamente a partir dos dados reais; ignore-o na sua resposta ou deixe-o vazio).

## Regras críticas (obrigatórias):
- Baseie "trend" na comparação real entre os meses da série fornecida (crescendo, caindo, estável ou volátil/inconsistente).
- Se a série tiver poucos meses (1-2), declare isso como uma limitação — não classifique tendência com confiança a partir de 1-2 pontos.
- Cada "keyObservation" deve citar o mês e valor exatos (evidence) da série fornecida.

## O que produzir:
- periodSummary: síntese do desempenho financeiro do período (2-4 frases).
- trend: growing | declining | stable | volatile.
- keyObservations: observações específicas com evidência (mês + valor).
- recommendedActions: ações financeiras concretas e priorizadas.

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "periodSummary": "string",
  "trend": "growing|declining|stable|volatile",
  "keyObservations": [{ "observation": "string", "evidence": "string" }],
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high|critical" }]
}`;

export function buildPerformanceReportPrompt(input: PerformanceReportInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const seriesText = input.series
    .map((p) => `${p.month}: receita=${p.revenue}, despesa=${p.expenses}, resultado=${p.revenue - p.expenses}`)
    .join("; ");

  const lines: string[] = [
    `Analise o desempenho financeiro dos últimos ${input.months} meses.`,
    `Série real: ${seriesText || "nenhum dado no período"}.`,
  ];

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato PerformanceReportOutput especificado (monthlyBreakdown pode ser omitido).");

  return lines.join("\n");
}
