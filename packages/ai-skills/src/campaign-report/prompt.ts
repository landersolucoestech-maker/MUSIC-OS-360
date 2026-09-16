/**
 * packages/ai-skills/src/campaign-report/prompt.ts
 *
 * Prompts canônicos da skill campaign-report (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato CampaignReportOutput.
 */

import type { CampaignReportInput } from "./contracts";

export const CAMPAIGN_REPORT_SYSTEM_PROMPT = `Você é um analista de marketing musical sênior, atuando para gravadora (selo/label), editora (publishing) ou produtora, especialista em retrospectivas de execução de campanhas encerradas.

Seu objetivo é produzir uma retrospectiva honesta da execução — NUNCA invente métricas de desempenho (impressões, cliques, alcance, conversões) que não foram fornecidas explicitamente como dado real no input.

## Regra crítica (obrigatória):
- Se "externalMetrics" NÃO for fornecido ou estiver vazio no input, você NÃO TEM dados de desempenho medidos. Nesse caso, "hasMeasuredPerformanceData" DEVE ser false, e "metricSummaries" deve conter, no máximo, entradas com "availability": "unavailable" explicando que não há fonte de dados conectada — NUNCA um número.
- Se "externalMetrics" FOR fornecido, use APENAS esses valores reais (marque "availability": "actual") — nunca extrapole ou arredonde para "parecer melhor".
- A retrospectiva de execução interna (tarefas concluídas, prazos, assets usados) pode ser discutida livremente pois vem de dados internos reais do input.

## O que produzir:
- Resumo de execução: o que foi feito, com base em tarefas/prazos/assets internos e no status de encerramento (concluída ou cancelada).
- hasMeasuredPerformanceData: true SOMENTE se externalMetrics não estava vazio.
- Resumos de métrica: cada métrica relevante, sua classificação de disponibilidade (actual|estimated|projected|unavailable) e um resumo textual — nunca um número inventado.
- Lições aprendidas: o que esta execução ensina, por categoria (ex.: cronograma, orçamento, coordenação).
- Recomendações: ações concretas para o próximo tipo de campanha semelhante.

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "executionSummary": "string",
  "hasMeasuredPerformanceData": boolean,
  "metricSummaries": [{ "metric": "string", "availability": "actual|estimated|projected|unavailable", "summary": "string" }],
  "lessonsLearned": [{ "lesson": "string", "category": "string" }],
  "recommendations": [{ "recommendation": "string", "forNextCampaignType": "string" }]
}

O valor de "availability" deve ser exatamente um de: actual, estimated, projected, unavailable.`;

export function buildCampaignReportPrompt(input: CampaignReportInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Monte a retrospectiva de execução da campanha "${input.campaignName}" (tipo: ${input.campaignType}), encerrada com status: ${input.outcomeStatus === "completed" ? "concluída" : "cancelada"}.`,
  ];

  if (input.objective)      lines.push(`Objetivo original: ${input.objective}.`);
  if (input.relatedArtist)  lines.push(`Artista relacionado: ${input.relatedArtist}.`);
  if (input.startDate)      lines.push(`Início: ${input.startDate}.`);
  if (input.endDate)        lines.push(`Fim: ${input.endDate}.`);
  if (input.tasksTotal !== undefined && input.tasksCompleted !== undefined) {
    lines.push(`Tarefas: ${input.tasksCompleted} de ${input.tasksTotal} concluídas.`);
  }
  if (input.assetsUsedCount !== undefined) lines.push(`Assets utilizados: ${input.assetsUsedCount}.`);

  if (input.externalMetrics?.length) {
    lines.push(
      `Métricas externas REAIS disponíveis (use apenas estas, marcando "actual"): ${input.externalMetrics
        .map((m) => `${m.metric}=${m.value} (fonte: ${m.source})`)
        .join("; ")}.`,
    );
  } else {
    lines.push("NENHUMA métrica externa real está disponível — hasMeasuredPerformanceData DEVE ser false, e qualquer entrada de métrica deve usar availability=\"unavailable\", sem números.");
  }

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato CampaignReportOutput especificado.");

  return lines.join("\n");
}
