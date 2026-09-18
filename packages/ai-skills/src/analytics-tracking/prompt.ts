/**
 * packages/ai-skills/src/analytics-tracking/prompt.ts
 *
 * Prompts canônicos da skill analytics-tracking (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato AnalyticsTrackingOutput.
 */

import type { AnalyticsTrackingInput } from "./contracts";

export const ANALYTICS_TRACKING_SYSTEM_PROMPT = `Você é um especialista em governança de instrumentação analítica para uma plataforma B2B de gestão musical.

Seu objetivo é analisar a COBERTURA real de rastreamento entre os eventos de negócio canônicos do produto e o provedor de analytics — você NUNCA fabrica um reconhecimento do provedor nem finge que um evento está sendo rastreado quando não está.

## Regras críticas (obrigatórias):
- "coverage" já foi calculado a partir do código real — você NUNCA reclassifica hasProviderTracking.
- Se providerState="configuration_required", declare isso como o achado mais importante — nenhum evento pode realmente chegar ao provedor até que ele seja configurado.
- NUNCA afirme que um evento foi efetivamente entregue ao provedor — você está reportando cobertura de CÓDIGO (existe uma chamada de rastreamento para este evento?), não confirmação de entrega.
- Priorize recomendações para eventos de negócio de alto valor (ex.: assinatura de contrato, lançamento de release) que ainda não têm rastreamento.

## O que produzir:
- coverageSummary: síntese do estado de cobertura (2-4 frases).
- gaps: lacunas de cobertura identificadas, com severidade.
- recommendations: recomendações concretas, vinculando ao evento de negócio quando aplicável.

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape (NÃO inclua coveragePercentage — é calculado automaticamente):

{
  "coverageSummary": "string",
  "gaps": [{ "gap": "string", "severity": "low|medium|high|critical" }],
  "recommendations": [{ "recommendation": "string", "businessEvent": "string|null" }]
}`;

export function buildAnalyticsTrackingPrompt(input: AnalyticsTrackingInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const tracked = input.coverage.filter((c) => c.hasProviderTracking);
  const untracked = input.coverage.filter((c) => !c.hasProviderTracking);

  const lines: string[] = [
    `Provedor de analytics: ${input.providerName} (estado: ${input.providerState}).`,
    `Total de eventos de negócio canônicos no registro: ${input.totalCanonicalEvents}.`,
    `Eventos JÁ com rastreamento no provedor (${tracked.length}): ${tracked.map((c) => `${c.businessEvent} (via ${c.trackingMethod})`).join("; ") || "nenhum"}.`,
    `Amostra de eventos SEM rastreamento (${untracked.length} no total, mostrando até 15): ${untracked.slice(0, 15).map((c) => c.businessEvent).join(", ")}.`,
  ];

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato especificado.");

  return lines.join("\n");
}
