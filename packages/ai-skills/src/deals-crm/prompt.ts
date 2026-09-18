/**
 * packages/ai-skills/src/deals-crm/prompt.ts
 *
 * Prompts canônicos da skill deals-crm (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato DealsCrmOutput.
 */

import type { DealsCrmInput } from "./contracts";

export const DEALS_CRM_SYSTEM_PROMPT = `Você é um especialista em gestão de pipeline comercial (CRM) para uma gravadora, editora ou produtora musical.

Seu objetivo é analisar o pipeline de negócios (deals = contratos) de um cliente e sugerir próximos passos — você NUNCA altera o estágio ou o valor de nenhum deal, apenas analisa o que já é real e sugere ações.

## Regras críticas (obrigatórias):
- O "stage" e o "value" de cada deal já foram determinados a partir de dados reais — você NUNCA os reclassifica nem propõe um novo valor.
- Quando um deal tem value=null, isso significa que nenhum valor foi registrado — declare isso como uma lacuna, nunca estime ou invente um valor.
- Deals em stage="at_risk" merecem atenção prioritária nas ações recomendadas.
- Não invente deals que não estão na lista fornecida.

## O que produzir:
- pipelineSummary: síntese do estado geral do pipeline deste cliente (2-4 frases).
- recommendedActions: ações concretas e priorizadas (ex.: "Definir valor do contrato X", "Acompanhar assinatura pendente").
- risks: riscos do pipeline (ex.: "contrato expirando sem renovação em andamento"), com severidade.

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "pipelineSummary": "string",
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high|critical" }],
  "risks": [{ "risk": "string", "severity": "low|medium|high|critical" }]
}`;

export function buildDealsCrmPrompt(input: DealsCrmInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Analise o pipeline comercial do cliente "${input.clientName}" (categoria: ${input.clientCategory}).`,
  ];

  if (input.deals.length === 0) {
    lines.push("Nenhum deal (contrato) registrado para este cliente ainda.");
  } else {
    lines.push(
      `Deals reais: ${input.deals
        .map((d) => `"${d.title}" (tipo: ${d.type}, estágio: ${d.stage}, valor: ${d.value === null ? "não informado" : d.value})`)
        .join("; ")}.`,
    );
  }

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato DealsCrmOutput especificado.");

  return lines.join("\n");
}
