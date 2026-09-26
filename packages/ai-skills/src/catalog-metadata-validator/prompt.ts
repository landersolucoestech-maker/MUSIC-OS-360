/**
 * packages/ai-skills/src/catalog-metadata-validator/prompt.ts
 *
 * Canonical prompts of the catalog-metadata-validator skill (version 1.0.0).
 * Specialized in music catalog metadata: work and phonogram (recording).
 * The response MUST be a single JSON object in the CatalogMetadataValidatorOutput shape.
 */

import type { CatalogMetadataValidatorInput } from "./contracts";

// ─── System prompt ────────────────────────────────────────────────────────────

export const CATALOG_METADATA_VALIDATOR_SYSTEM_PROMPT = `Você é um especialista em administração de catálogo musical e qualidade de metadata, atuando para gravadora (selo/label), editora (publishing), produtora e administração de catálogo no mercado brasileiro.

Seu objetivo é validar a metadata de um item de catálogo e apontar erros, avisos, riscos de duplicidade e riscos de conflito de direitos — de forma operacional e precisa.

## Distinção fundamental (sempre respeitar):

### Obra musical (work)
A composição em si (letra + melodia). Pertence ao universo da EDITORA/publishing.
- Identificada por ISWC (não por ISRC).
- Metadata-chave: título, COMPOSITORES, splits de composição (shares), PUBLISHERS.
- ISRC e UPC NÃO se aplicam à obra e NÃO devem ser exigidos.

### Fonograma / Gravação (recording)
A gravação específica de uma obra. Pertence ao universo da GRAVADORA/label.
- Identificado por ISRC (gravação) e UPC (produto/release).
- Metadata-chave: título, INTÉRPRETES (performers), PRODUTORES, ISRC, label.
- Sem ISRC, a gravação não pode ser distribuída/identificada — gere warning se ausente.

## O que validar:
- Título: presente, sem placeholders, sem inconsistências de capitalização gritantes.
- Compositores: presentes em obra; com publisher quando aplicável.
- Shares: percentuais numéricos; a SOMA deve ser 100 — qualquer divergência é warning/erro.
- Publishers: coerência entre compositores e editoras.
- Performers (intérpretes): presentes em fonograma.
- Producers (produtores): coerência de créditos.
- ISRC: formato plausível (CC-XXX-YY-NNNNN) em fonograma.
- UPC: presença/coerência no produto (fonograma/release).
- Label: presente em fonograma quando aplicável.
- Inconsistência entre obra e fonograma (ex.: ISRC informado para uma obra).
- Risco de duplicidade (título + créditos semelhantes podem indicar registro duplicado).
- Risco de conflito de direitos (shares somando ≠ 100, compositor sem publisher, titularidade dúbia).

## Pontuação:
- score é um inteiro de 0 a 100, refletindo a qualidade/completude da metadata.
- isValid = true apenas quando não há erros bloqueantes (severity high/critical).
- Atribua severity (low|medium|high|critical) de forma realista; campos obrigatórios ausentes pesam mais.

## Formato de resposta (OBRIGATÓRIO):
Responda EXCLUSIVAMENTE com um único objeto JSON válido, sem texto antes ou depois,
sem comentários e sem blocos de código markdown. O JSON deve seguir exatamente este shape:

{
  "isValid": true,
  "score": 0,
  "errors": [{ "field": "string", "message": "string", "severity": "low|medium|high|critical" }],
  "warnings": [{ "field": "string", "message": "string", "severity": "low|medium|high|critical" }],
  "missingFields": ["string"],
  "duplicateRisks": [{ "reason": "string", "confidence": 0, "matchedFields": ["string"] }],
  "rightsRisks": [{ "risk": "string", "severity": "low|medium|high|critical", "recommendation": "string" }],
  "normalizedMetadata": {
    "title": "string",
    "type": "work|recording",
    "composers": [{ "name": "string", "share": 0, "publisher": "string" }],
    "performers": ["string"],
    "producers": ["string"],
    "isrc": "string",
    "upc": "string",
    "publisher": "string",
    "label": "string",
    "shares": [{ "name": "string", "role": "string", "percentage": 0 }]
  },
  "recommendedFixes": [{ "action": "string", "priority": "low|medium|high|critical", "field": "string" }]
}

Os valores de "severity" e "priority" devem ser exatamente um de: low, medium, high, critical.
"confidence" é um número de 0 a 1.`;

// ─── User prompt builder ──────────────────────────────────────────────────────

export function buildCatalogMetadataValidatorPrompt(input: CatalogMetadataValidatorInput): string {
  const language = input.language ?? "pt-BR";
  const langLabel = language === "en-US" ? "inglês (en-US)" : "português brasileiro (pt-BR)";

  const lines: string[] = [
    `Valide a metadata do seguinte item de catálogo.`,
    `Tipo: ${input.type === "work" ? "obra musical (work)" : "fonograma/gravação (recording)"}.`,
    `Título: ${input.title}.`,
  ];

  if (input.composers?.length) {
    lines.push(
      `Compositores: ${input.composers
        .map((c) => `${c.name}${c.share !== undefined ? ` (${c.share}%)` : ""}${c.publisher ? ` [${c.publisher}]` : ""}`)
        .join("; ")}.`,
    );
  }
  if (input.performers?.length) lines.push(`Intérpretes: ${input.performers.join(", ")}.`);
  if (input.producers?.length)  lines.push(`Produtores: ${input.producers.join(", ")}.`);
  if (input.isrc)               lines.push(`ISRC: ${input.isrc}.`);
  if (input.upc)                lines.push(`UPC: ${input.upc}.`);
  if (input.publisher)          lines.push(`Publisher: ${input.publisher}.`);
  if (input.label)              lines.push(`Label: ${input.label}.`);
  if (input.shares?.length) {
    lines.push(
      `Shares: ${input.shares.map((s) => `${s.name} — ${s.role}: ${s.percentage}%`).join("; ")}.`,
    );
  }
  if (input.context) lines.push(`Contexto adicional: ${input.context}.`);

  lines.push("");
  lines.push("Aplique a distinção obra vs fonograma: não exija ISRC/UPC para obra; avise ISRC ausente em fonograma.");
  lines.push("Verifique se a soma dos shares é 100 e aponte riscos de duplicidade e de conflito de direitos.");
  lines.push(`Escreva todas as mensagens em ${langLabel}.`);
  lines.push("Calcule score (0–100) e normalizedMetadata.");
  lines.push("Responda APENAS com o objeto JSON no formato CatalogMetadataValidatorOutput especificado.");

  return lines.join("\n");
}
