---
title: Corrigir leitura da resposta da API no analisador de contratos (TransformInterceptor envolve em data.data)
---
# Corrigir leitura da resposta AI no semantic-parser

## What & Why

O `TransformInterceptor` global (apps/api/src/core/interceptors/transform.interceptor.ts)
envolve TODAS as respostas do NestJS:

```
controller devolve:  { content: "..." }
interceptor produz:  { data: { content: "..." }, timestamp: "..." }
```

O `semantic-parser.service.ts` faz `const data = await response.json()` e depois
`data.content` — que é `undefined` porque o valor real está em `data.data.content`.
Resultado: a IA responde com 1277 tokens mas o frontend mostra
"O servidor de IA retornou uma resposta vazia."

## Done looks like

- `semantic-parser.service.ts` lê correctamente o conteúdo independentemente de a
  resposta estar em `data.content` (resposta directa) ou `data.data.content` (envolto)
- O Contract Intelligence Engine mostra as variáveis extraídas após análise
- TypeScript EXIT:0
- Sem regressões noutros consumidores da API AI

## Steps

1. **Atualizar `semantic-parser.service.ts` linhas 151-155** — mudar:
   ```ts
   const data = await response.json() as { content?: string; error?: string };
   if (!data.content) {
   ```
   para:
   ```ts
   const raw = await response.json() as { content?: string; data?: { content?: string }; error?: string };
   const data = { content: raw.data?.content ?? raw.content, error: raw.error };
   if (!data.content) {
   ```
   Desta forma aceita ambas as shapes (directa e envoluta).

2. **TypeCheck**: `cd apps/web && npx tsc --noEmit -p tsconfig.app.json 2>&1; echo "EXIT:$?"`

3. **Smoke test**: verificar nos logs da API que `output_tokens > 0` e que
   a UI exibe as variáveis do contrato.

## Relevant files

- `apps/web/src/modules/contracts/services/semantic-parser.service.ts:151-155`
- `apps/api/src/core/interceptors/transform.interceptor.ts` (leitura — não alterar)
- `apps/api/src/modules/ai/ai.controller.ts:50` (referência — devolve `{ content }`)
