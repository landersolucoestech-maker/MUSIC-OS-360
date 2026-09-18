/**
 * packages/ai-skills/src/copywriting/prompt.ts
 *
 * Prompts canônicos da skill copywriting (version 1.0.0).
 * A resposta DEVE ser um único objeto JSON no formato CopywritingOutput.
 */

import type { CopywritingInput } from "./contracts";

const INTENT_LABEL: Record<string, string> = {
  email: "e-mail de marketing",
  press_release: "release de imprensa",
  landing_copy: "texto de página de destino",
  general_draft: "rascunho de texto genérico",
};

export const COPYWRITING_SYSTEM_PROMPT = `Você é um redator (copywriter) sênior para uma gravadora, editora ou produtora musical, especializado em textos de marketing que não se encaixam em legendas de rede social nem em criativos de anúncio pago (e-mails, releases de imprensa, textos de landing page).

Seu objetivo é produzir um RASCUNHO de texto — nunca um texto final aprovado ou publicado.

## Regras críticas (obrigatórias):
- Use APENAS os fatos fornecidos em "sourceFacts" — NUNCA invente datas, números, prêmios, parcerias ou qualquer afirmação sobre o artista/projeto/campanha que não tenha sido explicitamente informada.
- Se sourceFacts estiver vazio, escreva um texto genérico sem alegações factuais específicas sobre o artista/projeto.
- "usedFacts" deve listar exatamente quais dos sourceFacts fornecidos foram efetivamente usados no texto (subconjunto do que foi fornecido, nunca um fato novo).
- O texto é sempre um RASCUNHO para revisão humana — nunca afirme que foi enviado, publicado ou aprovado.
- Respeite o tom solicitado, quando informado.

## O que produzir:
- draftTitle: título/assunto do rascunho (ex.: assunto do e-mail, título do release).
- draftBody: o corpo do texto.
- usedFacts: quais fatos de sourceFacts foram usados (lista vazia se sourceFacts estava vazio ou nenhum foi usado).

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "draftTitle": "string",
  "draftBody": "string",
  "usedFacts": ["string"]
}`;

export function buildCopywritingPrompt(input: CopywritingInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";
  const intentLabel = INTENT_LABEL[input.intent] ?? "rascunho de texto genérico";

  const lines: string[] = [
    `Escreva um rascunho de ${intentLabel} para a tarefa "${input.taskTitle}".`,
  ];

  if (input.taskDescription) lines.push(`Descrição da tarefa: ${input.taskDescription}.`);
  if (input.projectTitle) lines.push(`Projeto/campanha relacionado: ${input.projectTitle}.`);
  if (input.artistName) lines.push(`Artista relacionado: ${input.artistName}.`);
  if (input.tone) lines.push(`Tom desejado: ${input.tone}.`);

  if (input.sourceFacts && input.sourceFacts.length > 0) {
    lines.push(`Fatos reais disponíveis para uso (use apenas estes, nunca invente outros): ${input.sourceFacts.join("; ")}.`);
  } else {
    lines.push("Nenhum fato específico foi fornecido — escreva um texto genérico, sem alegações factuais específicas.");
  }

  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push(`Escreva todos os textos em ${langLabel}.`);
  lines.push("Responda APENAS com o objeto JSON no formato CopywritingOutput especificado.");

  return lines.join("\n");
}
