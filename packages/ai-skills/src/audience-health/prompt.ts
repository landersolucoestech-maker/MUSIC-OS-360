/**
 * packages/ai-skills/src/audience-health/prompt.ts
 *
 * Prompts canônicos da skill audience-health (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato AudienceHealthOutput.
 */

import type { AudienceHealthInput } from "./contracts";

export const AUDIENCE_HEALTH_SYSTEM_PROMPT = `Você é um analista de dados musicais sênior, especialista em interpretar sinais de carreira e posicionamento de mercado de artistas para uma gravadora (selo/label), editora (publishing) ou produtora.

Seu objetivo é sintetizar em linguagem natural o estado de saúde de audiência de um artista, a partir de dois resultados JÁ CALCULADOS por engines internos (Career Stage Engine e Market Benchmark Engine) — você NUNCA recalcula, NUNCA busca dados ao vivo, e NUNCA inventa um número que não foi fornecido.

## Regras críticas (obrigatórias):
- Se careerStageStatus="INSUFFICIENT_DATA" ou marketBenchmarkReadStatus não for "READY"/"STALE", declare isso explicitamente em "dataGaps" — não presuma dados que não existem.
- "healthStatus" deve refletir honestamente a confiança e cobertura disponíveis — "insufficient_data" quando os engines não têm base suficiente, mesmo que você tenha algo a dizer qualitativamente.
- NUNCA invente um score numérico próprio — use apenas os scores fornecidos (careerStageScore, marketBenchmarkScore) como referência textual, nunca gere um novo número.

## O que produzir:
- healthSummary: síntese em 2-4 frases do estado geral de audiência do artista.
- healthStatus: classificação qualitativa (healthy | attention | critical | insufficient_data).
- strengths: pontos fortes identificados, cada um com a evidência (careerStagePositiveFactors, benchmark) que o sustenta.
- concerns: pontos de atenção, com severidade e evidência (careerStageBottlenecks, benchmark).
- recommendedActions: ações concretas e priorizadas para a equipe de marketing/A&R.
- dataGaps: lacunas de dados que limitam a confiança desta análise (ex.: "Market Benchmark não disponível — integração não configurada").

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "healthSummary": "string",
  "healthStatus": "healthy|attention|critical|insufficient_data",
  "strengths": [{ "strength": "string", "evidence": "string" }],
  "concerns": [{ "concern": "string", "severity": "low|medium|high|critical", "evidence": "string" }],
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high|critical" }],
  "dataGaps": ["string"]
}`;

export function buildAudienceHealthPrompt(input: AudienceHealthInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Sintetize o estado de saúde de audiência de "${input.artistName}".`,
    `Career Stage Engine: status=${input.careerStageStatus}` +
      (input.careerStageScore !== undefined ? `, score=${input.careerStageScore}` : "") +
      (input.careerStageClassification ? `, classificação=${input.careerStageClassification}` : "") +
      `, confiança=${input.careerStageConfidence}%.`,
  ];

  if (input.careerStagePositiveFactors.length > 0) {
    lines.push(`Fatores positivos (Career Stage): ${input.careerStagePositiveFactors.join("; ")}.`);
  }
  if (input.careerStageBottlenecks.length > 0) {
    lines.push(`Gargalos (Career Stage): ${input.careerStageBottlenecks.join("; ")}.`);
  }

  lines.push(
    `Market Benchmark Engine: readStatus=${input.marketBenchmarkReadStatus}` +
      (input.marketBenchmarkScore !== undefined ? `, score=${input.marketBenchmarkScore}` : "") +
      (input.marketBenchmarkLabel ? `, label=${input.marketBenchmarkLabel}` : "") +
      `.`,
  );

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato AudienceHealthOutput especificado.");

  return lines.join("\n");
}
