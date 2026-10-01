> Historical record. Kept as recorded; not the current contract.

# 35 — Resolução dos 2 Contratos HTTP Incompletos

Continuação read-only de [`34-canonical-frontend-contract.md`](./34-canonical-frontend-contract.md) (`CONTRACT_INCOMPLETE: 2` — seção A.20). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. O contrato canônico (doc34) não foi alterado nesta etapa. Nenhum outro endpoint foi analisado.

Para os 2 casos, o frontend sozinho não era suficiente (a pendência original era justamente a ausência de `Authorization`/`X-Tenant-ID`, que só pode ser confirmada contra o que o backend realmente exige) — por isso, conforme autorizado pelo prompt, os controllers diretamente correspondentes foram consultados em `apps/api/**`: `apps/api/src/modules/ai/ai.controller.ts` e `apps/api/src/modules/integrations/integrations.controller.ts` (rota `acrcloud/recognize`) + `apps/api/src/modules/integrations/acrcloud/acrcloud.service.ts` + `apps/api/src/modules/integrations/dto/integrations.dto.ts` (`RecognizeAudioDto`). Nenhuma auditoria ampla do backend foi feita.

---

## Caso 1 — `POST /api/v1/ai/generate`

```text
CASO:
1

CONSUMER:
apps/web/src/shared/hooks/useAI.ts — callAI()/useAI() (e o mesmo padrão duplicado em apps/web/src/modules/contracts/services/semantic-parser.service.ts:210, já registrado no doc05 como o mesmo achado)

METHOD:
POST

ENDPOINT:
/api/v1/ai/generate (fetch relativo, sem prefixo de API_BASE_URL)

MOTIVO_DA_INCOMPLETUDE:
ausência total de Authorization/X-Tenant-ID no fetch, e path construído sem API_BASE_URL (achado adicional encontrado nesta etapa, ver abaixo)
```

```text
PENDÊNCIA_EXATA:
AUTH (primária) + PATH (secundária, achado novo desta etapa)
```

### Evidência

```text
EVIDÊNCIA_FRONTEND:
apps/web/src/shared/hooks/useAI.ts:28-39 — callAI(): `fetch("/api/v1/ai/generate", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(params) })`. Nenhum header `Authorization` nem `X-Tenant-ID`. O path é relativo puro (`/api/v1/ai/generate`), sem `API_BASE_URL` — diferente de TODO outro arquivo do frontend, que ou usa `api-client.ts` (que monta `${API_BASE_URL}/api/v1${path}`, confirmado em apps/web/src/shared/lib/api-client.ts:168) ou, quando faz fetch direto, usa `${API_BASE_URL}/api/v1/...` explicitamente (ex.: OAuthCallbackPage.tsx, company-logo.service.ts). Achado adicional (não estava no doc34): em produção, onde `API_BASE_URL` aponta para um host de API diferente do host do frontend, este fetch relativo bateria no PRÓPRIO frontend, não na API — um path quebrado independente do problema de auth.

Comparação decisiva: apps/web/src/modules/marketing/ai/providers/providerRouter.ts:14 chama `api.post("/ai/generate")` — via `api-client.ts`, portanto com Authorization+X-Tenant-ID automáticos e path final `${API_BASE_URL}/api/v1/ai/generate` (idêntico ao destino pretendido por useAI.ts, só que corretamente construído). Mesma família de funcionalidade (geração de texto via IA), dois call sites, um correto e um quebrado.

EVIDÊNCIA_LEGACY:
apps/api/src/modules/ai/ai.controller.ts:27-30 — `@ApiBearerAuth() @RequireRole('editor') @Controller('ai')`. Rota `POST /generate` (linhas 51-69), com comentário explícito no próprio controller: **"Alias de /complete para o frontend (useAI hook)"** — confirma que esta rota foi construída especificamente para este hook. Corpo aceito: `{ prompt: string; type?: string; systemPrompt?: string; jsonMode?: boolean; maxTokens?: number }`; resposta: `{ content: string }`. Handler lê tenant via `req.tenant?.id ?? req.tenantId` — exige contexto de tenant resolvido pelo guard de autenticação, que só existe se `Authorization`/`X-Tenant-ID` estiverem presentes.

RESOLUÇÃO:
Contrato final: `POST /ai/generate` (relativo a `${API_BASE_URL}/api/v1`, ou seja, o MESMO destino final de `api.post("/ai/generate")`) — AUTH_REQUIRED: SIM (Bearer) — TENANT_REQUIRED: SIM — ROLE: editor+ (`@RequireRole('editor')` a nível de controller) — REQUEST_BODY: `{ prompt: string; type?: string }` (o que `useAI.ts` já envia hoje é compatível — `AIGenerateParams{prompt,type}` é um subconjunto válido do DTO aceito) — RESPONSE: `{ content: string }` (idêntico ao que `AIGenerateResult{content:string}` do frontend já espera). Nenhuma divergência de shape — só path e headers estavam incompletos.

STATUS:
RESOLVED
```

**Por que RESOLVED, não CONFLICTING:** o request body e o response body que `useAI.ts` já envia/espera são plenamente compatíveis com o DTO/retorno real do controller — não há nenhuma divergência de dado a arbitrar. A única pendência (headers ausentes + path sem `API_BASE_URL`) tem uma resposta objetiva e inequívoca, evidenciada por um segundo call site no mesmo repositório (`providerRouter.ts`) que já implementa o padrão correto contra o MESMO endpoint de backend (confirmado pelo comentário do próprio controller).

---

## Caso 2 — `POST /api/v1/integrations/acrcloud/recognize`

```text
CASO:
2

CONSUMER:
apps/web/src/modules/integrations/hooks/useACRCloud.ts — callAcrcloudApi()/useACRCloudIdentify()

METHOD:
POST

ENDPOINT:
/api/v1/integrations/acrcloud/recognize (fetch relativo, sem prefixo de API_BASE_URL)

MOTIVO_DA_INCOMPLETUDE:
ausência de Authorization/X-Tenant-ID (mesmo padrão do Caso 1) — mas a investigação desta etapa encontrou uma divergência adicional e mais séria: REQUEST e RESPONSE têm shapes incompatíveis entre frontend e backend
```

```text
PENDÊNCIA_EXATA:
AUTH (resolvida) + PATH (resolvida) + REQUEST (CONFLICTING) + RESPONSE (CONFLICTING)
```

### Evidência

```text
EVIDÊNCIA_FRONTEND:
apps/web/src/modules/integrations/hooks/useACRCloud.ts:33-57 (callAcrcloudApi) + :79-95 (useACRCloudIdentify). Request enviado: `callAcrcloudApi("recognize", { input })` onde `input: FingerprintInput = { audio_data: string; duration_seconds?: number; source_type?: MonitoringSourceType; source_name?: string }` (tipo definido em shared/integrations/contracts/music-monitoring.contract.ts, doc07/09) — o corpo JSON final enviado é `{ input: { audio_data, duration_seconds?, source_type?, source_name? } }` (objeto aninhado sob a chave "input"). Response esperado: `FingerprintResult = { matched: boolean; matches: FingerprintMatch[]; best_match?: FingerprintMatch|null; processing_time_ms: number; fingerprint_id: string; detected_at: string }` (via `unwrapApiResponse<T>`, que só desembrulha um envelope `{data:T}` se presente, sem transformar o shape em si).

EVIDÊNCIA_LEGACY:
apps/api/src/modules/integrations/integrations.controller.ts:424-431 — `POST /integrations/acrcloud/recognize`, `@RequireRole('editor')`, `recognizeAudio(@Body() dto: RecognizeAudioDto)` → `this.acrCloud.recognize(dto.audioBase64)`. DTO real (apps/api/src/modules/integrations/dto/integrations.dto.ts:89-93): `RecognizeAudioDto { audioBase64: string }` — campo único, plano, validado com `@IsString() @IsBase64()`. Serviço (apps/api/src/modules/integrations/acrcloud/acrcloud.service.ts:5-11,26): `recognize(audioBase64: string): Promise<ACRCloudResult>`, onde `ACRCloudResult = { title?: string; artist?: string; album?: string; isrc?: string; confidence?: number }` — um único resultado plano, sem array de matches, sem `processing_time_ms`, sem `fingerprint_id`, sem `detected_at`.

RESOLUÇÃO (parcial — path/auth resolvidos; request/response em conflito):
- PATH/AUTH/TENANT/ROLE: resolvidos sem ambiguidade, mesmo padrão do Caso 1 — `POST /integrations/acrcloud/recognize` (relativo a `${API_BASE_URL}/api/v1`), AUTH_REQUIRED: SIM, TENANT_REQUIRED: SIM, ROLE: editor+.
- REQUEST: CONFLITO REAL — frontend envia `{ input: { audio_data, duration_seconds?, source_type?, source_name? } }` (aninhado, campo `audio_data`); backend exige `{ audioBase64 }` (plano, campo diferente, validado como base64 puro). Não é uma diferença de nomenclatura trivial resolvível por mapeamento óbvio — o frontend nem envia o campo `audioBase64` que o backend exige (o mais próximo, `audio_data`, está aninhado sob `input` e pode conter formato diferente, "base64 ou URL pública do trecho" segundo o próprio tipo `FingerprintInput`, enquanto o backend só aceita base64 puro).
- RESPONSE: CONFLITO REAL — frontend espera `FingerprintResult` (resultado com array de `matches`, flag `matched`, tempo de processamento, id de fingerprint, timestamp de detecção); backend devolve `ACRCloudResult` (um único objeto plano com no máximo `title/artist/album/isrc/confidence`). Os dois shapes não são compatíveis por subconjunto — o frontend leria `data.matched`/`data.matches`/`data.best_match` de um objeto que nunca terá esses campos.

STATUS:
CONFLICTING
```

**Por que CONFLICTING, não RESOLVED nem REQUIRES_DECISION:** path/auth/tenant/role têm resposta objetiva idêntica ao Caso 1 (mesma classe de bug, mesma evidência de tipo de correção). Mas request/response body **divergem de fato** entre o que o frontend já declara precisar (`FingerprintInput`/`FingerprintResult`, tipos existentes desde o doc07/09 desta auditoria) e o que o backend real já implementa (`RecognizeAudioDto`/`ACRCloudResult`) — isso não é uma lacuna de evidência (ambos os lados têm um contrato claro e concreto), é uma divergência real entre dois contratos já definidos, exatamente o caso que a regra desta etapa manda registrar como `CONFLICTING` em vez de escolher um lado arbitrariamente.

---

## Resumo

```text
INCOMPLETE_CONTRACTS_INITIAL:
2

CONTRACTS_RESOLVED:
1

CONTRACTS_CONFLICTING:
1

CONTRACTS_REQUIRING_DECISION:
0

CONTRACTS_REMAINING_INCOMPLETE:
0
```

Os 2 contratos foram integralmente investigados: nenhum permanece "incompleto" por falta de evidência (`CONTRACTS_REMAINING_INCOMPLETE: 0`) — o Caso 1 fechou como `RESOLVED` (contrato único e sem ambiguidade, com um segundo call site no próprio repositório já demonstrando a implementação correta contra o mesmo endpoint de backend) e o Caso 2 fechou como `CONFLICTING` (path/auth resolvidos, mas request/response body genuinamente incompatíveis entre o tipo já declarado no frontend e o DTO/retorno já implementado no backend — divergência registrada com evidência de ambos os lados, não escolhida arbitrariamente).

## Cobertura

2/2 contratos `CONTRACT_INCOMPLETE` do doc34 investigados. `apps/api` consultado apenas nos 2 arquivos diretamente relacionados (`ai.controller.ts`, `integrations.controller.ts` + DTO + `acrcloud.service.ts`) — nenhuma auditoria ampla do backend. Nenhum outro endpoint foi analisado. `apps/web` e `apps/api` não foram alterados. O doc34 não foi modificado.
