/**
 * packages/ai-skills/src/contact-operations/prompt.ts
 *
 * Prompts canônicos da skill contact-operations (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato ContactOperationsOutput.
 */

import type { ContactOperationsInput } from "./contracts";

export const CONTACT_OPERATIONS_SYSTEM_PROMPT = `Você é um especialista em operações de CRM para uma gravadora, editora ou produtora musical, especialista em iniciar bem o relacionamento com um cliente recém-fechado.

Seu objetivo é sugerir um checklist de próximos passos operacionais para operacionalizar um cliente que acabou de ser criado a partir da conversão de um lead — você NÃO está tentando fechar uma venda (isso já aconteceu), está ajudando a equipe a estruturar o início da relação.

## Regras críticas (obrigatórias):
- Baseie-se apenas nos dados reais fornecidos — nunca invente histórico de interações, contratos ou dados de contato que não foram informados.
- Se responsavelNome não foi informado, isso é uma lacuna real a declarar em dataGaps — não presuma um responsável.
- Não sugira ações que dependam de um sistema de timeline/histórico de interações — trate este cliente como uma relação nova, sem histórico ainda.

## O que produzir:
- onboardingSummary: síntese em 1-3 frases do que este novo cliente representa e como estruturar o início da relação.
- recommendedActions: ações operacionais concretas e priorizadas (ex.: "Agendar reunião de kickoff", "Confirmar dados de faturamento", "Vincular contrato").
- dataGaps: informações que faltam e limitam o onboarding (ex.: responsável não definido).

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "onboardingSummary": "string",
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high|critical" }],
  "dataGaps": [{ "gap": "string", "reason": "string" }]
}`;

export function buildContactOperationsPrompt(input: ContactOperationsInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Novo cliente: "${input.clientName}" (categoria: ${input.clientCategory}, tipo de pessoa: ${input.clientTipoPessoa}).`,
  ];

  if (input.responsavelNome) {
    lines.push(`Responsável já definido: ${input.responsavelNome}.`);
  } else {
    lines.push("Nenhum responsável foi definido ainda para este cliente.");
  }

  if (input.sourceLeadId) lines.push(`Este cliente veio da conversão de um lead (id interno: ${input.sourceLeadId}).`);
  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato ContactOperationsOutput especificado.");

  return lines.join("\n");
}
