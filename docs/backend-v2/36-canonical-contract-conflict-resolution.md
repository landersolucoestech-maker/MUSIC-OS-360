> Historical record. Kept as recorded; not the current contract.

# 36 — Resolução do Único Contrato HTTP Conflitante

Continuação read-only de [`35-canonical-contract-incomplete-resolution.md`](./35-canonical-contract-incomplete-resolution.md) (`CONTRACTS_CONFLICTING: 1` — Caso 2, ACRCloud). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum endpoint legacy foi corrigido. Nenhum doc anterior foi modificado. Nenhum outro endpoint foi analisado.

---

## Caso conflitante

```text
CONSUMER:
apps/web/src/modules/integrations/hooks/useACRCloud.ts — callAcrcloudApi() / useACRCloudIdentify()

METHOD:
POST

ENDPOINT:
/integrations/acrcloud/recognize (path já resolvido no doc35 — relativo a ${API_BASE_URL}/api/v1)

ASPECTO_EM_CONFLITO:
request (shape do corpo) + response (shape do retorno)

FRONTEND_CONTRACT:
REQUEST: { input: { audio_data: string; duration_seconds?: number; source_type?: MonitoringSourceType; source_name?: string } }
RESPONSE: FingerprintResult — { matched: boolean; matches: FingerprintMatch[]; best_match?: FingerprintMatch | null; processing_time_ms: number; fingerprint_id: string; detected_at: string }, onde FingerprintMatch = { score: number; titulo: string; artista: string; isrc?: string|null; iswc?: string|null; album?: string|null; gravadora?: string|null; duracao_segundos?: number|null; data_lancamento?: string|null; genero?: string|null; external_id: string; offset_segundos?: number|null; local_obra_id?: string|null; local_fonograma_id?: string|null }

LEGACY_CONTRACT:
REQUEST: { audioBase64: string } (plano, validado como base64 puro)
RESPONSE: ACRCloudResult — { title?: string; artist?: string; album?: string; isrc?: string; confidence?: number } (objeto único, plano, sem array de matches)
```

### Evidências

```text
FRONTEND_EVIDENCE:
- apps/web/src/modules/integrations/hooks/useACRCloud.ts:33-57 — callAcrcloudApi<T>(endpoint, payload): monta o body como `JSON.stringify(payload)`, onde `payload = { input }` (linha 81, useACRCloudIdentify: `mutationFn: (input) => callAcrcloudApi("recognize", { input })`) — confirma que o corpo real enviado hoje é `{ input: FingerprintInput }`, não o FingerprintInput direto
- apps/web/src/modules/integrations/hooks/useACRCloud.ts:79-95 — useACRCloudIdentify(): tipado `useMutation<FingerprintResult, Error, FingerprintInput>`, lê `data.matched`/`data.best_match`/`data.best_match.titulo`/`data.best_match.artista`/`data.best_match.score` no `onSuccess` — confirma exatamente quais campos do FingerprintResult são de fato lidos e exercitados pela UI (toast de sucesso/info)
- apps/web/src/shared/integrations/contracts/music-monitoring.contract.ts:34-73 — definição completa dos tipos FingerprintInput, FingerprintMatch, FingerprintResult (já mapeados no doc07/09 desta auditoria, sem pendência)

LEGACY_EVIDENCE:
- apps/api/src/modules/integrations/integrations.controller.ts:424-431 — `@Post('acrcloud/recognize') @RequireRole('editor') recognizeAudio(@Body() dto: RecognizeAudioDto)` → `this.acrCloud.recognize(dto.audioBase64)`
- apps/api/src/modules/integrations/dto/integrations.dto.ts:89-93 — `RecognizeAudioDto { audioBase64!: string }` (`@IsString() @IsBase64()`)
- apps/api/src/modules/integrations/acrcloud/acrcloud.service.ts:5-11,26-56 — `interface ACRCloudResult { title?; artist?; album?; isrc?; confidence? }`; `recognize(audioBase64): Promise<ACRCloudResult>` — chama a API externa ACRCloud (`/v1/identify`) e devolve o primeiro resultado bruto, sem normalizar para múltiplos matches nem metadados de fingerprint/tempo de processamento
```

### Aplicação do critério de resolução

O frontend (congelado, especificação funcional principal) já define um contrato completo e autoconsistente para esta operação, presente desde o doc07/09 desta auditoria sem nenhuma pendência aberta: um tipo de entrada (`FingerprintInput`, com metadados de contexto — duração, fonte, nome da fonte — além do áudio) e um tipo de saída rico (`FingerprintResult`, com suporte a múltiplos matches, confiança por match, e metadados de processamento/detecção). Isso é suficiente para definir o que a API v2 precisa atender — não há ambiguidade funcional no lado do frontend a resolver por decisão humana.

O comportamento do legacy (`RecognizeAudioDto`/`ACRCloudResult` — corpo plano com só um campo, retorno de um único resultado sem array nem metadados) é registrado como requisito antigo que **não será reproduzido**: reflete uma integração mais simples (proxy quase direto para a API bruta da ACRCloud) que não atende ao contrato que o frontend já espera.

```text
FINAL_CONTRACT:
REQUEST: { input: { audio_data: string; duration_seconds?: number; source_type?: MonitoringSourceType; source_name?: string } }
RESPONSE: { matched: boolean; matches: FingerprintMatch[]; best_match?: FingerprintMatch | null; processing_time_ms: number; fingerprint_id: string; detected_at: string }
(FingerprintMatch conforme shared/integrations/contracts/music-monitoring.contract.ts — já documentado, sem pendência)

RESOLUTION:
FRONTEND_CONTRACT_WINS

STATUS:
RESOLVED
```

**Requisito antigo explicitamente NÃO reproduzido:** o corpo plano `{ audioBase64 }` e o retorno de resultado único `{ title?, artist?, album?, isrc?, confidence? }` do `RecognizeAudioDto`/`ACRCloudResult` do backend legacy não fazem parte do contrato final — foram a implementação de uma versão mais simples da integração, superada pelo contrato mais rico que o frontend já assume (múltiplos matches, metadados de fingerprint, contexto de origem do trecho de áudio).

---

## Resumo

```text
CONFLICTING_CONTRACTS_INITIAL:
1

CONFLICTS_RESOLVED:
1

FRONTEND_CONTRACT_WINS:
1

CONFLICTS_REQUIRING_DECISION:
0

CONFLICTS_REMAINING:
0
```

## Cobertura

1/1 contrato `CONFLICTING` do doc35 resolvido. O frontend definiu de forma suficiente o contrato necessário (tipos `FingerprintInput`/`FingerprintResult` já existentes e sem pendência desde os docs 07/09) — nenhuma pergunta de decisão humana foi necessária. Nenhum outro endpoint foi analisado. `apps/web` e `apps/api` não foram alterados. Nenhum doc anterior foi modificado.
