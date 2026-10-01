> Historical record. Kept as recorded; not the current contract.

# 13 — Erros e Status HTTP Tratados Explicitamente pelo Frontend

Extraído a partir dos docs [05](./05-http-endpoint-inventory.md), [09](./09-http-response-contracts.md) e [11](./11-http-response-final-resolution.md), mais leitura direta de `apps/web/src/shared/lib/errors.ts` e dos call sites que capturam erros. Escopo: `apps/web/**`. `apps/api` não foi consultado. Nenhum arquivo foi alterado. Permissões/autorização e regras de negócio não foram analisadas — só o tratamento de erro em si.

## Handler central — `shared/lib/api-client.ts`

Toda chamada via `api.*`/`publicApi.*` (o cliente CANONICAL, ~256 dos 270 call sites — ver doc 04) passa por uma única função `request()`/`mapError()` compartilhada. Este é o tratamento de erro dominante de todo o frontend — documentado uma vez aqui em vez de repetido em cada um dos ~256 call sites que o herdam automaticamente.

```text
CALL_SITE: shared/lib/api-client.ts — request()/mapError() (função interna, usada por TODAS as chamadas api.*/publicApi.*)
ENDPOINT: todos os endpoints chamados via api/publicApi

STATUS_CODES_TRATADOS:
- 401 — tratado ANTES de mapError(): limpa o token (setAccessToken(null)), ativa um circuit-breaker de 30s (AUTH_BACKOFF_MS) que bloqueia novas requisições sem nem chamar fetch, e dispara um evento 'invalid' via EventTarget (_authBus)
- 400 — mapeado para ValidationError
- 403 — mapeado para TenantError; EXCEÇÃO: se body.error === "MUST_CHANGE_PASSWORD", mapeado para PasswordChangeRequiredError em vez disso
- 404 — mapeado para NotFoundError
- 409 — mapeado para ConflictError
- qualquer outro status (incluindo 5xx, 422, 429, etc.) — mapeado genericamente para IntegrationError("api", msg, {statusCode: res.status}) — SEM diferenciação além de guardar o número do status

ERROR_SHAPE_ESPERADO:
{ message?: string | string[], error?: string } — corpo da resposta de erro, parseado via res.json() com fallback silencioso (try/catch) se não for JSON válido

CAMPOS_DE_ERRO_ACESSADOS:
- body.message (string ou string[] — se array, é junctionado com "; ")
- body.error (só para checar a string literal "MUST_CHANGE_PASSWORD")
- res.statusText (fallback se body.message ausente)
- res.status (guardado em IntegrationError.statusCode para o branch default)

MENSAGEM_EXIBIDA_AO_USUÁRIO:
Nenhuma diretamente aqui — a função só lança a exceção tipada; quem exibe a mensagem ao usuário é o código chamador (predominantemente via `onError: (err) => toast.error(err.message)` em hooks React Query — padrão repetido em dezenas de arquivos, não status-diferenciado)

COMPORTAMENTO:
- outro (lança exceção tipada — o comportamento de exibição fica a cargo de cada chamador)
- para 401 especificamente: também é "silent" no sentido de que a request nem chega a sair durante a janela de backoff (short-circuit), evitando uma tempestade de requisições enquanto a UI ainda não percebeu que a sessão caiu
```

**Achado relevante:** a função `onAuthInvalidated()` (exportada por `api-client.ts` para permitir que outras partes do app reajam ao evento 401/'invalid') **não tem nenhum assinante em todo `apps/web/src`** — busca por `onAuthInvalidated(` só encontra a própria definição e o teste do arquivo. O circuit-breaker de 401 funciona (bloqueia requisições), mas nada no app escuta o evento para, por exemplo, redirecionar para a tela de login automaticamente.

**Achado relevante 2:** a classe `ValidationError` carrega um campo `fields: Record<string,string>` desenhado especificamente para popular erros de formulário campo-a-campo a partir de uma resposta 400 do backend — mas busca por `instanceof ValidationError` em todo `apps/web/src` não encontra NENHUM consumidor. Nenhum formulário do frontend lê `error.fields` de uma resposta real da API; a validação client-side dos formulários (ex.: `ValidationErrors` em `accounting/transacao-form`) é um sistema totalmente separado e não relacionado a este.

**Achado relevante 3:** `isDomainError()` e `getErrorMessage()` (helpers genéricos exportados por `errors.ts` para uso seguro de `instanceof`/mensagem) também não têm nenhum consumidor localizado em `apps/web/src` além da própria definição.

---

## Call sites com tratamento ADICIONAL/diferenciado além do handler central

### `shared/lib/storage.ts` — findById

```text
CALL_SITE: httpStorage.findById<T>
ENDPOINT: GET ${TABLE_ENDPOINT[table]}/${id}

STATUS_CODES_TRATADOS:
- 404 (via NotFoundError, lançado pelo handler central)

ERROR_SHAPE_ESPERADO: NotFoundError (classe tipada, herdada do handler central)

CAMPOS_DE_ERRO_ACESSADOS: nenhum campo específico — só `instanceof NotFoundError`

MENSAGEM_EXIBIDA_AO_USUÁRIO: nenhuma — o 404 é silenciosamente convertido

COMPORTAMENTO: fallback — `catch (err) { if (err instanceof NotFoundError) return undefined; throw err; }` — 404 vira `undefined` (registro não encontrado tratado como estado normal, não como erro), qualquer outro erro é relançado
```

### `app/providers/TenantContext.tsx` — sincronização de contexto

```text
CALL_SITE: TenantProvider — useEffect de sincronização
ENDPOINT: GET /auth/context

STATUS_CODES_TRATADOS:
- 503 (via IntegrationError.statusCode === 503, checado explicitamente)
- qualquer outro erro — tratado genericamente

ERROR_SHAPE_ESPERADO: IntegrationError (classe tipada) — checagem de `error.statusCode`

CAMPOS_DE_ERRO_ACESSADOS: error.statusCode

MENSAGEM_EXIBIDA_AO_USUÁRIO:
- 503: "Serviço de contexto indisponível — o banco de dados da aplicação não respondeu."
- outro: "Não foi possível carregar o contexto da organização."

COMPORTAMENTO: fallback — define `contextError` no estado (exibido em algum lugar da UI, não local); a aplicação continua funcionando com dados de JWT/localStorage em vez do contexto completo do servidor (comentário no código: "usando JWT/localStorage")
```

### `app/providers/BillingContext.tsx` — refresh de assinatura

```text
CALL_SITE: BillingProvider — refresh()
ENDPOINT: GET /billing/subscription

STATUS_CODES_TRATADOS:
- 403 com corpo MUST_CHANGE_PASSWORD (via PasswordChangeRequiredError, lançado pelo handler central)
- qualquer outro erro — logado como inesperado

ERROR_SHAPE_ESPERADO: PasswordChangeRequiredError (classe tipada)

CAMPOS_DE_ERRO_ACESSADOS: nenhum campo — só `instanceof PasswordChangeRequiredError`

MENSAGEM_EXIBIDA_AO_USUÁRIO: nenhuma diretamente neste ponto (a troca de senha obrigatória é tratada em outra tela)

COMPORTAMENTO: silent (para este erro específico) — `if (!(error instanceof PasswordChangeRequiredError)) { captureError(...) }` — especificamente EVITA logar este erro como inesperado (comentário: já causou um crash real de toda a árvore React em produção — Parte 77), mas não faz nada ativo com ele aqui além de suprimir o log
```

### `shared/hooks/useUploadToR2.ts` — presign

```text
CALL_SITE: useUploadToR2 — upload(), passo 1 (presign)
ENDPOINT: POST /uploads/presign

STATUS_CODES_TRATADOS:
- 503, OU mensagem contendo "R2_NOT_CONFIGURED"/"R2 não configurado"/"armazenamento R2 não configurado" (via IntegrationError)

ERROR_SHAPE_ESPERADO: IntegrationError — checagem de `.message` (3 substrings possíveis) OU `.statusCode === 503`

CAMPOS_DE_ERRO_ACESSADOS: error.message, error.statusCode

MENSAGEM_EXIBIDA_AO_USUÁRIO: "Upload indisponível — armazenamento R2 não configurado no servidor." (mensagem default de R2NotConfiguredError)

COMPORTAMENTO: form error / outro — relança como `R2NotConfiguredError` (subclasse local de Error, não de DomainError) para que o chamador diferencie "R2 não configurado" de qualquer outra falha de upload
```

---

## Call sites `fetch` diretos (SPECIALIZED/DUPLICATE — ver doc 04) — tratamento genérico, SEM diferenciação por status

Todos os 9 pontos de `fetch()` fora de `api-client.ts` seguem o mesmo padrão: checam apenas `!response.ok` (booleano), sem nenhum `switch`/`if` por código de status específico. Documentados juntos por serem estruturalmente idênticos nesse aspecto.

```text
CALL_SITE: shared/hooks/useAI.ts — callAI (DEFERRED)
ENDPOINT: POST /api/v1/ai/generate
STATUS_CODES_TRATADOS: nenhum especificamente — só `!res.ok` genérico
ERROR_SHAPE_ESPERADO: { error?: string } (fallback para { error: "Erro desconhecido" } se o body não for JSON)
CAMPOS_DE_ERRO_ACESSADOS: err.error, res.status (só para compor a mensagem: `Erro ${res.status}` se err.error ausente)
MENSAGEM_EXIBIDA_AO_USUÁRIO: err.error, ou "Erro {status}"
COMPORTAMENTO: outro — lança `new Error(...)` genérico; exibição fica a cargo do chamador (toast.error no hook useAI)
```

```text
CALL_SITE: modules/integrations/hooks/useACRCloud.ts — callAcrcloudApi (DEFERRED)
ENDPOINT: POST /api/v1/integrations/acrcloud/recognize
STATUS_CODES_TRATADOS: nenhum especificamente — só `!res.ok`
ERROR_SHAPE_ESPERADO: { error?: string, message?: string } (fallback { error: "Erro interno" })
CAMPOS_DE_ERRO_ACESSADOS: err.error, err.message, res.status
MENSAGEM_EXIBIDA_AO_USUÁRIO: err.error ?? err.message ?? "HTTP {status}"
COMPORTAMENTO: outro — Error genérico; toast.error no hook consumidor (useACRCloudIdentify)
```

```text
CALL_SITE: modules/contracts/services/semantic-parser.service.ts — parseContractText
ENDPOINT: POST /api/v1/ai/generate
STATUS_CODES_TRATADOS: nenhum especificamente — só `!response.ok`
ERROR_SHAPE_ESPERADO: texto cru (response.text()), sem parsing estruturado
CAMPOS_DE_ERRO_ACESSADOS: nenhum campo — usa o texto bruto (truncado a 200 chars) direto na mensagem
MENSAGEM_EXIBIDA_AO_USUÁRIO: "Erro na análise semântica (HTTP {status}): {corpo truncado}"
COMPORTAMENTO: outro — Error genérico, propagado ao chamador
```

```text
CALL_SITE: modules/reports/services/reports-api.ts — exportBlob / importTemplateBlob (responseError())
ENDPOINT: GET .../export ; GET .../import/template
STATUS_CODES_TRATADOS: nenhum especificamente — só `!response.ok`
ERROR_SHAPE_ESPERADO: { message?: string, error?: string } (tenta parsear como JSON; se falhar, usa o texto cru)
CAMPOS_DE_ERRO_ACESSADOS: parsed.message, parsed.error, response.status
MENSAGEM_EXIBIDA_AO_USUÁRIO: "{operation} falhou ({status}): {message}" (operation = "Exportação" ou "Download do template")
COMPORTAMENTO: outro — Error genérico
```

```text
CALL_SITE: modules/settings/services/company-logo.service.ts — saveLogo
ENDPOINT: POST .../workspaces/${id}/logo
STATUS_CODES_TRATADOS: nenhum — nem sequer o número do status é incluído na mensagem
ERROR_SHAPE_ESPERADO: não parseado (corpo de erro ignorado)
CAMPOS_DE_ERRO_ACESSADOS: nenhum
MENSAGEM_EXIBIDA_AO_USUÁRIO: "Falha ao enviar a logo. Tente novamente." — mensagem fixa, idêntica para qualquer tipo de falha
COMPORTAMENTO: outro — o tratamento de erro menos granular de todos os call sites analisados
```

```text
CALL_SITE: modules/settings/pages/Configuracoes.tsx — openExternalOAuth
ENDPOINT: POST .../integrations/oauth/init
STATUS_CODES_TRATADOS: nenhum — só `!response.ok`
ERROR_SHAPE_ESPERADO: não parseado
CAMPOS_DE_ERRO_ACESSADOS: nenhum
MENSAGEM_EXIBIDA_AO_USUÁRIO: "Não foi possível iniciar a autorização." — mensagem fixa
COMPORTAMENTO: toast (toast.error) + fecha o popup aberto (`popup.close()`)
```

```text
CALL_SITE: modules/integrations/pages/OAuthCallbackPage.tsx — troca de código
ENDPOINT: POST .../integrations/oauth/exchange
STATUS_CODES_TRATADOS: nenhum — só `!res.ok`
ERROR_SHAPE_ESPERADO: Record<string,unknown> com campo `message` (string ou string[])
CAMPOS_DE_ERRO_ACESSADOS: body["message"] (com fallback para array[0], depois `HTTP {status}`)
MENSAGEM_EXIBIDA_AO_USUÁRIO: "Falha na troca do código de autorização: {msg}"
COMPORTAMENTO: form error / outro — define `setState({status:"error", message})`, renderizado na própria página de callback (não toast)
```

```text
CALL_SITE: modules/integrations/components/MarketingOAuthDialog.tsx — início do OAuth
ENDPOINT: POST .../integrations/oauth/init
STATUS_CODES_TRATADOS: nenhum — só `!res.ok`
ERROR_SHAPE_ESPERADO: Record<string,unknown> com campo `message`
CAMPOS_DE_ERRO_ACESSADOS: body["message"]
MENSAGEM_EXIBIDA_AO_USUÁRIO: "Erro ao iniciar autenticação: {msg}" (console.error também, com o mesmo msg)
COMPORTAMENTO: toast + fecha popup + `console.error`
```

```text
CALL_SITE: modules/integrations/pages/OAuthPopupPage.tsx — fetch do endpoint de auth (spotify_ads/corp_spotify)
ENDPOINT: GET .../integrations/spotify/auth
STATUS_CODES_TRATADOS: UNRESOLVED — o trecho lido (via `.then(response => response.json())`) não mostra checagem explícita de `response.ok` antes de tentar `.json()`, diferente de todos os outros fetch diretos
ERROR_SHAPE_ESPERADO: UNRESOLVED — não confirmado se há tratamento de erro de rede/status nesta chamada específica
COMPORTAMENTO: UNRESOLVED
```

---

## Erro de autenticação Supabase (caminho totalmente separado do `api-client.ts`)

```text
CALL_SITE: modules/auth/pages/Auth.tsx — handleLogin (via describeAuthError/isCredentialsError de shared/lib/auth-error-messages.ts)
ENDPOINT: N/A — não é uma chamada REST a apps/api; é o SDK do Supabase Auth (signInWithPassword), mas trata explicitamente um "status" (error.status) retornado pelo SDK, por isso incluído aqui

STATUS_CODES_TRATADOS:
- 429 — checado explicitamente (`error.status === 429`), OU por regex na mensagem (/rate limit|too many requests/i)
- "invalid login credentials" (não é status HTTP, é padrão de mensagem — tratado como categoria própria, deliberadamente genérico para não revelar se o e-mail existe — anti-enumeração)
- "email not confirmed" (padrão de mensagem)
- falha de rede (/failed to fetch|network|fetch failed/i)

ERROR_SHAPE_ESPERADO: AuthError (tipo do SDK Supabase) — { message?: string, status?: number }

CAMPOS_DE_ERRO_ACESSADOS: error.message, error.status

MENSAGEM_EXIBIDA_AO_USUÁRIO:
- credenciais inválidas: "Credenciais inválidas." + contador de tentativas restantes (rate limiting client-side via `authRateLimiter`)
- e-mail não confirmado: "E-mail ainda não confirmado. Verifique sua caixa de entrada."
- 429/rate limit: "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente."
- rede: "Falha de conexão. Verifique sua internet e tente novamente."
- outro: a própria `error.message`, ou "Não foi possível entrar. Tente novamente."

COMPORTAMENTO: toast + rate-limiting client-side (só erros de credencial genuína consomem uma tentativa do limitador local; erros de rede/servidor/503 explicitamente NÃO contam — comentário no código referencia um incidente real, "Parte 77")
```

---

## Padrão dominante não status-diferenciado (não enumerado call-a-call)

A esmagadora maioria dos hooks de mutation do frontend (dezenas de arquivos: `useTikTok.ts`, `useTikTokAds.ts`, `useSoundCloud.ts`, `useGoogleAds.ts`, `useAppleMusic.ts`, `useAbramus.ts`, `useSpotify.ts`, `useSupport.ts`, `useRoles.ts`, etc.) usa o padrão idêntico `onError: (err: Error) => toast.error(err.message)` do React Query — captura QUALQUER erro (já tipado pelo handler central de `api-client.ts` quando aplicável) e exibe `err.message` cru num toast, sem nenhuma diferenciação por status code. Não foram listados individualmente porque não acrescentam informação nova além de "existe um catch-all genérico com toast" — já coberto pela documentação do handler central acima.

---

## Totais

```text
CALLS_WITH_EXPLICIT_ERROR_HANDLING: 15

UNIQUE_STATUS_CODES_HANDLED: 7

CALLS_HANDLING_401: 1

CALLS_HANDLING_403: 2

CALLS_HANDLING_404: 2

CALLS_HANDLING_409: 1

CALLS_HANDLING_422: 0

CALLS_HANDLING_429: 1

CALLS_HANDLING_5XX: 3

UNRESOLVED_ERROR_SHAPES: 1
```

Notas sobre os totais:
- `CALLS_WITH_EXPLICIT_ERROR_HANDLING` (15) = handler central de `api-client.ts` (1) + `storage.ts` findById (1) + `TenantContext.tsx` (1) + `BillingContext.tsx` (1) + `useUploadToR2.ts` (1) + `useAI.ts` (1) + `useACRCloud.ts` (1) + `semantic-parser.service.ts` (1) + `reports-api.ts` (2 call sites — export e import/template) + `company-logo.service.ts` (1) + `Configuracoes.tsx` (1) + `OAuthCallbackPage.tsx` (1) + `MarketingOAuthDialog.tsx` (1) + `Auth.tsx`/Supabase (1). Os dezenas de `onError: toast.error(err.message)` genéricos NÃO foram contados individualmente (ver seção "padrão dominante" acima) por não implementarem diferenciação alguma.
- `UNIQUE_STATUS_CODES_HANDLED` (7): 400, 401, 403, 404, 409, 429, 503.
- `CALLS_HANDLING_401`/`403`/`404`/`409` contam o handler central como 1 chamada arquitetural (é uma função compartilhada, não replicada por endpoint) mais os call sites que adicionam diferenciação própria em cima do erro já tipado (403→BillingContext; 404→storage.ts findById).
- `CALLS_HANDLING_5XX` (3) = handler central (branch default genérico, cobre 500 entre outros) + `TenantContext.tsx` (503 específico) + `useUploadToR2.ts` (503 específico).
- `UNRESOLVED_ERROR_SHAPES` (1) = `OAuthPopupPage.tsx`, cujo tratamento de erro (se houver) não foi confirmado no trecho lido.

## Cobertura

Cobertos: o handler central de `api-client.ts` (aplica-se a ~256 dos 270 call sites oficiais), os 4 call sites com diferenciação adicional sobre esse handler, os 9 pontos de `fetch()` direto (SPECIALIZED/DUPLICATE), e o caminho de erro do Supabase Auth em `Auth.tsx`. Não foram enumerados individualmente os dezenas de `onError` genéricos (catch-all sem diferenciação) por não constituírem tratamento status-específico comprovado. Erros HTTP de chamadas fora do escopo desta etapa (permissões, regras de negócio) não foram analisados.
