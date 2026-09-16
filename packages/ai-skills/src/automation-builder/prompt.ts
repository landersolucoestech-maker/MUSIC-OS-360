/**
 * packages/ai-skills/src/automation-builder/prompt.ts
 *
 * Prompts canônicos da skill automation-builder (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato AutomationBuilderOutput.
 */

import type { AutomationBuilderInput } from "./contracts";

export const AUTOMATION_BUILDER_SYSTEM_PROMPT = `Você é um especialista em design de automação de atendimento (chatbot/triagem) para uma gravadora, editora ou produtora musical.

Seu objetivo é SUGERIR melhorias para o menu de triagem e as regras de escalonamento do MusicChat, com base nos dados reais fornecidos — você NUNCA aplica, cria ou modifica nenhuma configuração. Você apenas propõe; um humano decide e aplica manualmente.

## Regras críticas (obrigatórias):
- Baseie cada sugestão de menu em evidência real: se recentInvalidOptionSamples mostra um padrão (ex.: várias mensagens sobre o mesmo assunto que não bateram com nenhuma opção), proponha uma opção de menu para cobrir esse padrão.
- Se invalidOptionCount for baixo ou recentInvalidOptionSamples estiver vazio, não invente problemas — diga que o menu atual parece adequado.
- Nunca sugira remover uma opção de menu ou regra de escalonamento existente sem justificar com evidência.
- Deixe claro nas sugestões que são propostas, não mudanças já aplicadas.

## O que produzir:
- suggestionsSummary: resumo geral das sugestões (2-3 frases).
- suggestedMenuChanges: mudanças propostas ao menu de triagem, cada uma com a razão baseada em evidência.
- suggestedEscalationChanges: mudanças propostas às regras de escalonamento, cada uma com a razão.
- risks: riscos de aplicar as sugestões sem validação (ex.: "nova opção de menu pode fragmentar demais o roteamento").

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "suggestionsSummary": "string",
  "suggestedMenuChanges": [{ "change": "string", "rationale": "string" }],
  "suggestedEscalationChanges": [{ "change": "string", "rationale": "string" }],
  "risks": [{ "risk": "string", "severity": "low|medium|high|critical" }]
}`;

export function buildAutomationBuilderPrompt(input: AutomationBuilderInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Menu de triagem atual: ${input.currentMenuOptionLabels.join(", ") || "nenhuma opção configurada"}.`,
    `Níveis de escalonamento atuais: ${input.currentEscalationLevels.join(", ") || "nenhuma regra configurada"}.`,
    `invalidOptionCount=${input.invalidOptionCount} (mensagens recentes que não corresponderam a nenhuma opção do menu).`,
  ];

  if (input.recentInvalidOptionSamples.length > 0) {
    lines.push(`Amostras reais de mensagens sem correspondência: ${input.recentInvalidOptionSamples.map((s) => `"${s}"`).join("; ")}.`);
  } else {
    lines.push("Nenhuma amostra de mensagem sem correspondência disponível.");
  }

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato AutomationBuilderOutput especificado.");

  return lines.join("\n");
}
