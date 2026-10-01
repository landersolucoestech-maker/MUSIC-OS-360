> Historical record. Kept as recorded; not the current contract.

# 14 — Resolução Final do Error Shape Restante

Continuação read-only de [`13-http-error-contracts.md`](./13-http-error-contracts.md). Nenhum arquivo foi alterado. Doc 13 não foi modificado.

## Caso único — `OAuthPopupPage.tsx` (GET /integrations/spotify/auth)

```text
CALL_SITE:
modules/integrations/pages/OAuthPopupPage.tsx — useEffect de redirecionamento OAuth (plataformas spotify_ads/corp_spotify)

ENDPOINT:
GET /integrations/spotify/auth (via ${apiBase}${backendPath}, backendPath = BACKEND_AUTH_ENDPOINTS[platform])

ERROR_SHAPE_ANTERIOR:
UNRESOLVED

EVIDÊNCIA_FRONTEND:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx:911-922. Trecho completo agora lido:

fetch(`${apiBase}${backendPath}`, { headers: { Authorization: `Bearer ${sessionData.access_token}` } })
  .then((response) => response.json())
  .then((data: { url?: string }) => {
    if (data.url) window.location.replace(data.url);
    else setOauthError(true);
  })
  .catch(() => setOauthError(true));

O `try { ... } catch { setOauthError(true); }` externo cobre falhas síncronas de `JSON.parse(localStorage.getItem(...))`, não a chamada de rede em si.

EVIDÊNCIA_LEGACY:
NÃO NECESSÁRIA — a evidência do frontend já é conclusiva e não requer consulta ao backend (a pergunta era "o frontend diferencia algum shape/status de erro aqui?", não "o que o backend retorna").

ERROR_SHAPE_RESOLVIDO:
Nenhum shape de erro é extraído. A cadeia:
1. NÃO verifica `response.ok`/`response.status` antes de chamar `.json()` — ou seja, mesmo uma resposta HTTP de erro (4xx/5xx) com corpo JSON válido segue para o `.then(data => ...)`.
2. Só verifica a presença do campo `data.url` (`string | undefined`) — se ausente (que é o caso tanto de um erro estruturado `{message: "..."}` quanto de qualquer outro corpo sem `url`), cai no `else setOauthError(true)`.
3. `.catch(() => setOauthError(true))` cobre falhas de rede/parsing (`response.json()` falhando em corpo não-JSON, promise rejeitada), sem inspecionar `err.message` ou status algum.

Em todos os 3 casos (HTTP erro com JSON válido, corpo sem `url`, falha de rede/parsing), o resultado observável é idêntico: `oauthError` vira `true`, e a UI renderiza `<OAuthUnavailable definition={definition} />` — um componente estático, sem nenhuma mensagem dinâmica extraída da resposta.

STATUS:
RESOLVED

JUSTIFICATIVA:
A pergunta original ("qual shape de erro este call site espera?") tem agora resposta definitiva a partir do próprio código: a resposta é "nenhum — o tratamento é um booleano cego que não distingue HTTP erro, corpo inesperado, ou falha de rede/parsing entre si, e não lê nenhum campo de mensagem". Isso não é uma lacuna de investigação (o trecho relevante foi lido por completo) nem um conflito com o backend (o frontend não declara nenhuma expectativa de shape para comparar) — é uma característica confirmada do código: entre os 9 pontos de `fetch()` direto documentados no doc 13, este é o único que nem sequer checa `response.ok` antes de interpretar o corpo, e o único que não exibe mensagem alguma ao usuário (comparado aos irmãos `Configuracoes.tsx`/`MarketingOAuthDialog.tsx`/`OAuthCallbackPage.tsx`, que extraem `body.message` e mostram texto específico).
```

## Resumo

```text
ERROR_SHAPES_INITIAL_THIS_STEP: 1
ERROR_SHAPES_RESOLVED: 1
ERROR_SHAPES_CONFLICTING: 0
ERROR_SHAPES_REMAINING: 0
```

## Cobertura

Resolvido inteiramente a partir de `apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx` (linhas 896-940, incluindo o trecho de erro em 911-922, não lido por completo no doc 13). `apps/api` não foi consultado — não era necessário para responder a pergunta específica deste caso.
