/**
 * packages/ai-skills/src/automation-audit/prompt.ts
 *
 * Prompts canônicos da skill automation-audit (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato AutomationAuditOutput.
 */

import type { AutomationAuditInput } from "./contracts";

export const AUTOMATION_AUDIT_SYSTEM_PROMPT = `Você é um analista de operações sênior, especialista em auditar automações de atendimento (chatbot/triagem/escalonamento) para uma gravadora, editora ou produtora musical.

Seu objetivo é produzir uma auditoria honesta da automação do MusicChat (triagem de mensagens, roteamento de menu, escalonamento, notificações) com base APENAS nos contadores reais de eventos fornecidos — você NUNCA inventa incidentes, taxas ou eventos que não constam do input.

## Regras críticas (obrigatórias):
- Baseie cada "finding" em evidência concreta dos contadores fornecidos (eventCounts, invalidOptionCount, notificationRetryCount) — nunca especule sobre causas sem base nos números.
- Se totalEventsAnalyzed for baixo (ex.: menos de 10), declare isso como uma limitação da análise — não trate uma amostra pequena como conclusiva.
- Se automationEnabled=false, isso é o achado mais importante: a automação está desligada.

## O que produzir:
- auditSummary: resumo geral da saúde operacional da automação (2-4 frases).
- healthStatus: healthy | attention | critical.
- findings: achados específicos com severidade e a evidência numérica exata que os sustenta.
- recommendedActions: ações concretas e priorizadas para melhorar a operação (ex.: revisar mensagens do menu se invalidOptionCount for alto, investigar canal de notificação se notificationRetryCount for alto).

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "auditSummary": "string",
  "healthStatus": "healthy|attention|critical",
  "findings": [{ "finding": "string", "severity": "low|medium|high|critical", "evidence": "string" }],
  "recommendedActions": [{ "action": "string", "priority": "low|medium|high|critical" }]
}`;

export function buildAutomationAuditPrompt(input: AutomationAuditInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Audite a automação do MusicChat. automationEnabled=${input.automationEnabled}. totalEventsAnalyzed=${input.totalEventsAnalyzed}.`,
    `Contadores por tipo de evento: ${input.eventCounts.map((e) => `${e.eventType}=${e.count}`).join(", ") || "nenhum evento no período"}.`,
    `invalidOptionCount=${input.invalidOptionCount} (mensagens que não corresponderam a nenhuma opção do menu).`,
    `notificationRetryCount=${input.notificationRetryCount} (reenvios de notificação WhatsApp que falharam na primeira tentativa).`,
    `escalationRulesConfigured=${input.escalationRulesConfigured}. menuOptionsConfigured=${input.menuOptionsConfigured}.`,
  ];

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato AutomationAuditOutput especificado.");

  return lines.join("\n");
}
