> Historical record. Kept as recorded; not the current contract.

# 30 — Auditoria dos Serviços Externos Acessados pelo Frontend

Continuação read-only de [`03-frontend-data-access-surface.md`](./03-frontend-data-access-surface.md) (`EXTERNAL_SERVICE_FILES: 3`). Nenhum arquivo foi alterado. Nenhuma integração foi corrigida ou implementada. Nenhuma credencial foi alterada. `apps/api` não foi consultado — toda evidência de mediação por backend vem de comentários e do comportamento observável nos 3 arquivos do frontend (ex.: o comentário de `OAuthCallbackPage.tsx` que descreve o que o backend faz, tratado como declaração de design, não como verificação do código do backend em si).

## Arquitetura geral observada (contexto para os 3 casos)

Os 3 arquivos implementam, juntos, um único fluxo de OAuth de 3 etapas usado por várias plataformas de marketing/anúncios, mais duas vitrines não-OAuth (distribuidoras digitais e NF-e):

```text
1. MarketingOAuthDialog.tsx  → abre popup, obtém exchange_token do backend (POST /oauth/init)
2. OAuthPopupPage.tsx        → dentro do popup, redireciona para a URL de autorização real do provedor
3. OAuthCallbackPage.tsx     → recebe o code de volta, troca por token via backend (POST /oauth/exchange)
```

Em nenhum dos 3 arquivos um `client_secret`/token de acesso do provedor chega a aparecer no código-fonte ou em uma resposta lida pelo frontend — apenas `client_id` (identificador público, não-secreto, por definição do protocolo OAuth 2.0) e um `exchange_token`/nonce de curta duração e uso único.

---

## 1 — `apps/web/src/modules/integrations/components/MarketingOAuthDialog.tsx`

```text
ARQUIVO:
apps/web/src/modules/integrations/components/MarketingOAuthDialog.tsx

SERVIÇO:
19 plataformas de marketing/anúncios (Meta/Facebook, Google, YouTube, TikTok, Spotify, Deezer, SoundCloud, Apple Music — contas corporativas e de anúncios), listadas em PLATFORM_META

FUNÇÃO/HOOK:
MarketingOAuthDialog (componente) — openPopup(), handleSuccess()

TIPO_DE_ACESSO:
THROUGH_BACKEND

FINALIDADE:
apresentar a UI de consentimento (réplica visual da tela do provedor, não a tela real) e orquestrar a abertura de um popup que conduzirá o usuário à autorização real no domínio do provedor

OPERAÇÕES:
- POST /api/v1/integrations/oauth/init (via fetch direto, não api-client.ts) — obtém um exchange_token de uso único
- abre popup do browser (window.open) navegando para a rota interna /oauth/:platform (renderizada por OAuthPopupPage.tsx)
- escuta postMessage do popup (mesma origem) para saber quando a conexão foi concluída
- grava o exchange_token em sessionStorage (musicos360_oauth_nonce_${platform}) para validação de CSRF no callback

AUTENTICAÇÃO:
Bearer token da própria sessão do app (getAccessToken(), JWT do MUSIC OS 360) enviado ao backend em /oauth/init — não é autenticação com o provedor externo, é a autenticação do usuário contra o próprio backend

ORIGEM_DA_CREDENCIAL:
sessão (JWT em memória, via api-client.ts)

CREDENCIAL_EXPOSTA_AO_BROWSER:
NÃO — nenhuma credencial do provedor externo aparece neste arquivo; o único "segredo" manuseado é o exchange_token, que é de curta duração, uso único, e não é uma credencial de provedor

TENANT_SPECIFIC:
SIM — a chamada a /oauth/init leva o Bearer token do usuário, que carrega o tenant; a conexão resultante fica associada ao tenant autenticado

DADOS_ENVIADOS:
{ platform } no corpo de POST /oauth/init; nenhum dado de negócio, nenhuma credencial do provedor

DADOS_RECEBIDOS:
{ exchange_token } do backend
```

```text
CLASSIFICAÇÃO ARQUITETURAL:
ALREADY_BACKEND_MEDIATED

JUSTIFICATIVA:
não há segredo nenhum no browser neste arquivo — o fluxo já delega ao backend tanto a emissão do token de troca quanto (nos arquivos seguintes) a troca do código de autorização. Não há nada aqui que precise "mover" para a API v2; o padrão já É o padrão correto de uma integração backend-mediada.
```

---

## 2 — `apps/web/src/modules/integrations/pages/OAuthCallbackPage.tsx`

```text
ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthCallbackPage.tsx

SERVIÇO:
mesmas 19 plataformas de marketing/anúncios (recebe o callback de qualquer uma delas — rota genérica /oauth/callback)

FUNÇÃO/HOOK:
OAuthCallbackPage (componente de rota pública, sem layout)

TIPO_DE_ACESSO:
THROUGH_BACKEND

FINALIDADE:
receber o `code` de autorização devolvido pelo provedor externo (após o usuário autorizar no domínio real dele), validar o nonce anti-CSRF, e delegar ao backend a troca do código por um token de acesso

OPERAÇÕES:
- lê `code`/`state`/`error` da query string
- valida o nonce contra sessionStorage do `window.opener` (mesma origem) — anti-CSRF/anti-account-linking
- POST /api/v1/integrations/oauth/exchange (via fetch direto) com { code, platform, exchange_token: nonce }
- postMessage({type, platform}) de volta ao opener (mesma origem) só com o resultado da conexão (connected: true/false), nunca com o token
- fecha a própria janela

AUTENTICAÇÃO:
nenhuma no lado do frontend — o comentário do próprio arquivo (linhas 14-15) declara que o endpoint /oauth/exchange "NestJS, no auth required" (autenticação por posse do nonce/exchange_token de uso único, não por Bearer token)

ORIGEM_DA_CREDENCIAL:
nenhuma (o `code` vem do provedor externo via redirect; o `exchange_token`/nonce vem do passo anterior)

CREDENCIAL_EXPOSTA_AO_BROWSER:
NÃO — o comentário do arquivo declara explicitamente: "Backend holds client secrets, exchanges the code and persists encrypted tokens" / "no token enters the browser". A resposta lida pelo frontend é só `{ connected: boolean, platform: string }`

TENANT_SPECIFIC:
SIM (indiretamente) — embora esta chamada específica não carregue um Bearer token, o `exchange_token` foi originalmente emitido pelo backend em nome de um tenant específico (Caso 1 acima); presume-se que o backend associa a troca ao tenant através do exchange_token, não verificado nesta etapa (fora do escopo — não consultar apps/api)

DADOS_ENVIADOS:
{ code, platform, exchange_token }

DADOS_RECEBIDOS:
{ connected: boolean, platform: string } (ou { data: { connected, platform } }) — nenhum token, nenhuma credencial
```

```text
CLASSIFICAÇÃO ARQUITETURAL:
ALREADY_BACKEND_MEDIATED

JUSTIFICATIVA:
este é o ponto crítico do fluxo (troca de code por token, operação que exige client_secret) e já está inteiramente no backend, por design explícito e documentado no próprio arquivo. Nenhuma ação de "mover para API v2" é necessária — o padrão já é o correto.
```

---

## 3 — `apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx`

Este arquivo cobre 3 mecanismos distintos, tratados separadamente porque têm perfis arquiteturais diferentes.

### 3a — Plataformas OAuth com URL construída no cliente (Meta, Google, YouTube, TikTok, DocuSign, Stripe Connect)

```text
ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx

SERVIÇO:
Facebook/Meta, Google (contas Business e YouTube), TikTok for Business, DocuSign, Stripe Connect

FUNÇÃO/HOOK:
buildOAuthUrl(), PRODUCTION_OAUTH_CONFIGS, OAuthExperience (para meta_business/tiktok_business/google_business/youtube_business/docusign/stripe_connect)

TIPO_DE_ACESSO:
REDIRECT (navegação de página inteira construída no browser, não uma chamada fetch/XHR ao provedor)

FINALIDADE:
construir a URL de autorização OAuth oficial de cada provedor e redirecionar o browser (window.location.replace) para o domínio real do provedor

OPERAÇÕES:
- monta a URL de autorização com client_id (público), redirect_uri (fixo, mesma origem: /oauth/callback), response_type=code, scope, state=platform:nonce
- window.location.replace(url) — navegação de página inteira, não XHR

AUTENTICAÇÃO:
OAuth 2.0 Authorization Code (fluxo de "public client" — client_id público, sem client_secret no browser)

ORIGEM_DA_CREDENCIAL:
env (import.meta.env.VITE_META_APP_ID / VITE_GOOGLE_CLIENT_ID / VITE_TIKTOK_CLIENT_KEY / VITE_DOCUSIGN_INTEGRATION_KEY / VITE_STRIPE_CONNECT_CLIENT_ID) — valores injetados no bundle em build-time pelo Vite

CREDENCIAL_EXPOSTA_AO_BROWSER:
SIM — mas apenas o `client_id` (identificador público do aplicativo perante o provedor), não o `client_secret`. Pelo próprio desenho do protocolo OAuth 2.0, o client_id é destinado a ser público (aparece na URL de autorização, visível na barra de endereço); não é, por si, uma exposição de segredo.

TENANT_SPECIFIC:
NÃO APLICÁVEL — o client_id é do aplicativo MUSIC OS 360 como um todo perante o provedor (Meta/Google/TikTok/DocuSign/Stripe), não varia por tenant; o vínculo com o tenant acontece depois, no backend, durante a troca do código (Caso 2)

DADOS_ENVIADOS:
client_id (público), redirect_uri, response_type=code, scope, state (platform:nonce) — tudo via query string da navegação, nada enviado por fetch/XHR

DADOS_RECEBIDOS:
nenhum diretamente — o provedor redireciona de volta para /oauth/callback (Caso 2) com um `code`
```

```text
CLASSIFICAÇÃO ARQUITETURAL:
MAY_REMAIN_CLIENT_SIDE

JUSTIFICATIVA:
critério explícito atendido: "OAuth redirect/public client" — construir e navegar para a URL de autorização com um client_id público é exatamente o padrão de "public client" do OAuth 2.0 para aplicações SPA, sem necessidade de segredo algum nesta etapa. A etapa que de fato exige segredo (troca do code por token) já está no backend (Caso 2). Não há operação privilegiada, não há persistência de credencial, não há regra de negócio de servidor nesta parte — apenas montagem de uma URL pública e uma navegação.
```

### 3b — Spotify (spotify_ads, corp_spotify) — URL obtida do backend

```text
ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx

SERVIÇO:
Spotify (Spotify Ad Studio / Spotify for Artists)

FUNÇÃO/HOOK:
BACKEND_AUTH_ENDPOINTS, useEffect principal de OAuthPopupPage (ramo `if (backendPath)`)

TIPO_DE_ACESSO:
THROUGH_BACKEND (para obter a URL) + REDIRECT (para navegar até ela)

FINALIDADE:
obter do backend a URL de autorização Spotify já pronta (o backend decide o client_id/redirect_uri/scopes do lado do servidor) e redirecionar o browser para ela

OPERAÇÕES:
- GET {apiBase}/integrations/spotify/auth, com Authorization: Bearer {access_token} (lido diretamente de localStorage["musicos360_auth"], não via api-client.ts)
- window.location.replace(data.url) com a URL devolvida

AUTENTICAÇÃO:
Bearer token da sessão do app (JWT do MUSIC OS 360) para autenticar contra o PRÓPRIO backend; a autenticação com o Spotify em si acontece inteiramente após o redirect, no domínio do Spotify

ORIGEM_DA_CREDENCIAL:
sessão (localStorage "musicos360_auth", lido diretamente em vez de via api-client.ts — pequena inconsistência de acesso registrada por completude, sem julgamento de correção nesta etapa)

CREDENCIAL_EXPOSTA_AO_BROWSER:
NÃO — nenhum client_id/secret do Spotify aparece neste arquivo; a URL de autorização inteira (já com client_id do lado do Spotify) vem pronta do backend

TENANT_SPECIFIC:
SIM — o Bearer token identifica o tenant, e o backend presumivelmente usa isso para associar a conexão resultante ao tenant correto (não verificado — apps/api fora do escopo)

DADOS_ENVIADOS:
nenhum corpo; só o header Authorization

DADOS_RECEBIDOS:
{ url: string } — a URL de autorização Spotify pronta para navegação
```

```text
CLASSIFICAÇÃO ARQUITETURAL:
ALREADY_BACKEND_MEDIATED

JUSTIFICATIVA:
diferente do grupo 3a, aqui nem o client_id aparece no frontend — o backend decide e entrega a URL pronta. É o padrão mais conservador dos três, plenamente backend-mediado mesmo na etapa de montagem da URL de autorização.
```

### 3c — Distribuidoras digitais (6) e NF-e — sem OAuth, sem troca de dados

```text
ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx

SERVIÇO:
ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe (DISTRIBUTOR_DEFINITIONS) + NF-e (NfeExperience)

FUNÇÃO/HOOK:
DistributorExperience, NfeExperience

TIPO_DE_ACESSO:
REDIRECT (para as distribuidoras — link `<a target="_blank">` para o portal oficial) / OTHER (para NF-e — não há navegação nem chamada externa nenhuma, é só um seletor de método, sem submissão)

FINALIDADE:
para distribuidoras: apresentar instruções e um link para o painel oficial de cada distribuidora — texto do próprio componente confirma que "Abrir o portal não conecta a conta ao sistema"; para NF-e: apresentar as 3 opções de método de emissão (A1/A3/provedor fiscal) sem coletar nenhum dado real

OPERAÇÕES:
- distribuidoras: `<a href={portalUrl} target="_blank">` — navegação simples de browser para o domínio da distribuidora, sem parâmetros de autenticação nem client_id
- NF-e: apenas troca de estado local (setMethod), sem envio de dado algum

AUTENTICAÇÃO:
nenhuma (nem OAuth, nem API key) — consistente com o achado do doc20/23 (Caso 4): nenhuma das 6 distribuidoras tem mecanismo de autenticação real integrado hoje

ORIGEM_DA_CREDENCIAL:
nenhuma

CREDENCIAL_EXPOSTA_AO_BROWSER:
NÃO — não há credencial nenhuma envolvida nesta parte do arquivo

TENANT_SPECIFIC:
NÃO APLICÁVEL — não há conexão real sendo estabelecida

DADOS_ENVIADOS:
nenhum

DADOS_RECEBIDOS:
nenhum
```

```text
CLASSIFICAÇÃO ARQUITETURAL:
UNRESOLVED

JUSTIFICATIVA:
não se encaixa nos critérios objetivos de MUST_MOVE_TO_API_V2 (não há segredo, API key, operação privilegiada ou persistência de credencial acontecendo aqui) nem em MAY_REMAIN_CLIENT_SIDE no sentido pleno (não é uma integração real — é uma tela informativa que explicitamente admite não conectar nada). Coerente com a Decisão D1 já aprovada (doc25): a forma real de integração com cada distribuidora depende de existir uma API oficial, ainda não pesquisada. Esta tela em si não decide nada sobre isso — é apenas onde a UI atual pousa enquanto essa decisão de produto (D1) é executada.
```

---

## Resumo

```text
EXTERNAL_SERVICE_FILES_ANALYZED:
3

UNIQUE_EXTERNAL_SERVICES:
12

DIRECT_BROWSER_INTEGRATIONS:
0

BACKEND_MEDIATED_INTEGRATIONS:
2

SDK_CLIENT_SIDE_INTEGRATIONS:
0

INTEGRATIONS_REQUIRING_API_V2:
0

INTEGRATIONS_ALLOWED_CLIENT_SIDE:
1

INTEGRATIONS_REQUIRING_PROVIDER_AUTH:
3

BROWSER_EXPOSED_CREDENTIAL_CASES:
1

UNRESOLVED_INTEGRATIONS:
1
```

`UNIQUE_EXTERNAL_SERVICES` (12): Meta/Facebook, Google, TikTok, Spotify, DocuSign, Stripe, ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe (NF-e não contado — nenhum serviço externo é de fato contatado nessa tela). `BACKEND_MEDIATED_INTEGRATIONS` (2) conta os arquivos inteiramente `ALREADY_BACKEND_MEDIATED` (MarketingOAuthDialog.tsx, OAuthCallbackPage.tsx); o 3º arquivo (OAuthPopupPage.tsx) é misto e contado à parte. `INTEGRATIONS_ALLOWED_CLIENT_SIDE` (1) refere-se ao subcaso 3a (client_id público para Meta/Google/TikTok/DocuSign/Stripe). `INTEGRATIONS_REQUIRING_PROVIDER_AUTH` (3) conta os 3 arquivos como participantes de um fluxo que depende do mecanismo de autenticação oficial de cada provedor (OAuth), mesmo quando já mediado pelo backend — usar OAuth real é, em si, "usar autenticação do provedor". `BROWSER_EXPOSED_CREDENTIAL_CASES` (1) é o client_id público exposto no subcaso 3a — sinalizado como esperado/seguro por desenho do OAuth 2.0, não como falha. `UNRESOLVED_INTEGRATIONS` (1) é o subcaso 3c (distribuidoras/NF-e), que não é uma integração real hoje e por isso não se encaixa nos critérios objetivos dados — consistente com a Decisão D1 (doc25), já aprovada e aguardando pesquisa de API oficial por distribuidora.

## Cobertura

3/3 arquivos `EXTERNAL_SERVICE` do doc03 lidos por completo, incluindo os 3 sub-mecanismos distintos dentro de `OAuthPopupPage.tsx`. Nenhuma integração foi corrigida ou implementada. Nenhuma credencial foi alterada. `apps/api` não foi consultado. Nenhum doc anterior foi modificado.
