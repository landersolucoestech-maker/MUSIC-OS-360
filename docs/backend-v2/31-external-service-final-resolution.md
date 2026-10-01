> Historical record. Kept as recorded; not the current contract.

# 31 — Resolução da Integração Incerta e da Credencial Exposta

Continuação read-only de [`30-external-service-audit.md`](./30-external-service-audit.md) (`UNRESOLVED_INTEGRATIONS: 1`, `BROWSER_EXPOSED_CREDENTIAL_CASES: 1`). Nenhum arquivo foi alterado. Nenhuma credencial foi movida, revogada ou alterada. Nenhum `.env` foi alterado. Nenhuma integração foi implementada. Nenhuma documentação externa foi pesquisada — a resolução usa apenas evidência já produzida em `apps/web/**` e nos docs desta auditoria (doc19-21, doc25). `apps/api` não foi consultado — não foi estritamente necessário, dado que `OAuthCallbackPage.tsx` já documenta explicitamente a mediação de servidor (doc30, Caso 2).

Os dois casos são **diferentes sub-partes do mesmo arquivo** (`OAuthPopupPage.tsx`), mas serviços distintos: a integração não resolvida é o subcaso 3c (distribuidoras + NF-e); a credencial exposta é o subcaso 3a (client_id de Meta/Google/TikTok/DocuSign/Stripe).

---

## Caso 1 — Integração Não Resolvida (distribuidoras + NF-e)

### 1a — Distribuidoras digitais (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe)

```text
SERVIÇO:
ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe

ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx (DISTRIBUTOR_DEFINITIONS, DistributorExperience)

FLUXO:
tela informativa com instruções + link `<a target="_blank">` para o portal oficial de cada distribuidora; o próprio texto do componente declara "Abrir o portal não conecta a conta ao sistema" — nenhuma troca de dados ocorre

AUTENTICAÇÃO:
nenhuma (sem OAuth, sem API key, sem qualquer mecanismo de autenticação real implementado hoje)

CREDENCIAIS:
nenhuma

DADOS_ENVIADOS:
nenhum

DADOS_RECEBIDOS:
nenhum

TENANT_SPECIFIC:
NÃO APLICÁVEL

FINAL_CLASSIFICATION:
MUST_USE_PROVIDER_AUTH

STATUS:
RESOLVED
```

**Justificativa:** a Decisão D1, já aprovada (doc25 — [`25-distributor-integration-decision.md`](./25-distributor-integration-decision.md)), resolve a questão arquitetural desta etapa: "as integrações com distribuidoras devem utilizar a API oficial de cada distribuidora quando essa API existir... o mecanismo de autenticação deve seguir obrigatoriamente o método oficial suportado pela API... distribuidoras sem API oficial disponível não devem receber integração simulada". Isso classifica definitivamente o caso como `MUST_USE_PROVIDER_AUTH` (condicionado à existência real de API, não presumida) — sem prever `MAY_REMAIN_CLIENT_SIDE` nem `MUST_MOVE_TO_API_V2` isoladamente, porque nenhuma das duas se aplica: não há nenhum mecanismo hoje para "manter" ou "mover", há apenas um placeholder informativo aguardando a pesquisa de API por distribuidora, que D1 já determinou ser a próxima etapa (explicitamente fora do escopo desta auditoria: "não pesquisar documentação externa"). Não é uma nova decisão pendente — D1 já decidiu o princípio; falta apenas execução técnica futura.

### 1b — NF-e (Nota Fiscal Eletrônica)

```text
SERVIÇO:
NF-e — método de emissão (não é um provedor único, é uma escolha entre certificado A1/A3 ou provedor fiscal terceirizado — Focus NFe, NFe.io, PlugNotas etc.)

ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx (NfeExperience)

FLUXO:
seletor visual de método (A1/A3/provedor fiscal), sem qualquer coleta ou envio de dado — o próprio componente declara: "Certificados, senhas e tokens fiscais devem ser enviados somente ao backend seguro do MUSIC OS 360. Eles não são solicitados nesta página"

AUTENTICAÇÃO:
nenhuma nesta tela (não é OAuth — NF-e não usa OAuth, conforme o próprio texto do componente: "A NF-e não utiliza um login OAuth único da SEFAZ")

CREDENCIAIS:
nenhuma nesta tela; a configuração real (cnpj, certificado, token_provedor) já foi auditada em docs 19-21 (Caso 3) como vivendo hoje em sessionStorage (apps/web/src/modules/integrations/hooks/useNfe.ts), sem endpoint de backend

DADOS_ENVIADOS:
nenhum nesta tela

DADOS_RECEBIDOS:
nenhum nesta tela

TENANT_SPECIFIC:
NÃO APLICÁVEL (nesta tela específica) — mas a configuração real (fora desta tela) é por tenant, conforme já registrado no doc21

FINAL_CLASSIFICATION:
MUST_MOVE_TO_API_V2 + MUST_USE_PROVIDER_AUTH

STATUS:
RESOLVED
```

**Justificativa:** não é uma decisão nova — reaplica o que já foi estabelecido nos docs 19/20/21 (Caso 3 do mapeamento de storage local): a configuração fiscal (CNPJ, certificado, `token_provedor`) é um segredo que hoje fica em `sessionStorage` sem proteção (`useNfe.ts`, achado de CWE-312 já registrado no doc18/19) e precisa de backend/vault — critério explícito desta etapa: "segredo que não pode ficar no browser" + "persistência de credenciais/tokens". `MUST_USE_PROVIDER_AUTH` também se aplica porque, quando implementado, o modelo de autenticação deve seguir o que cada provedor fiscal (Focus NFe/NFe.io/PlugNotas) ou o modelo A1/A3 da própria SEFAZ exigir — não um modelo inventado. Esta tela específica (`NfeExperience`) já está corretamente desenhada para não coletar nada — o problema já identificado está noutro arquivo (`useNfe.ts`), não aqui.

---

## Caso 2 — Credencial Exposta ao Browser (client_id OAuth de 5 provedores)

```text
SERVIÇO:
Meta/Facebook, Google (Business + YouTube), TikTok for Business, DocuSign, Stripe Connect

ARQUIVO:
apps/web/src/modules/integrations/pages/OAuthPopupPage.tsx (PRODUCTION_OAUTH_CONFIGS, buildOAuthUrl)

CREDENCIAL:
client_id OAuth (identificador de aplicativo) de 5 provedores — variáveis VITE_META_APP_ID, VITE_GOOGLE_CLIENT_ID, VITE_TIKTOK_CLIENT_KEY, VITE_DOCUSIGN_INTEGRATION_KEY, VITE_STRIPE_CONNECT_CLIENT_ID (nomes de variável, sem valores — conforme regra de segurança desta etapa)

ORIGEM:
env — variáveis com prefixo VITE_, lidas via import.meta.env, portanto injetadas no bundle JavaScript público em build-time (comportamento padrão e documentado do Vite: qualquer env var com prefixo VITE_ é exposta ao cliente)

UTILIZADA_NO_BROWSER:
SIM — usada para montar a query string da URL de autorização (buildOAuthUrl), enviada como parâmetro `client_id` (ou `client_key`/`client_id` conforme o provedor) na navegação para o domínio do provedor

É_SEGREDO_PRIVADO:
NÃO

PODE_SER_PÚBLICA:
SIM

IMPACTO:
nenhum — client_id é, por definição do protocolo OAuth 2.0 Authorization Code (fluxo de "public client", usado por SPAs), um identificador público do aplicativo perante o provedor, não um segredo. Ele aparece de qualquer forma na barra de endereço durante o redirect, independentemente de estar ou não em uma env var VITE_*. O componente que de fato exige sigilo (client_secret, usado para trocar o `code` por um token) NÃO aparece em nenhuma variável VITE_* lida neste arquivo nem em nenhum dos 3 arquivos do doc30 — a troca acontece inteiramente no backend (OAuthCallbackPage.tsx → POST /oauth/exchange, doc30 Caso 2), conforme já verificado.

API_V2_REQUIRED:
NÃO

AÇÃO_FUTURA_NECESSÁRIA:
nenhuma correção — client_id público no bundle do frontend é o comportamento esperado e correto para este padrão de OAuth; não deve ser movido para o backend (isso não reduziria exposição nenhuma, já que o mesmo valor apareceria de qualquer forma na URL de redirect visível ao usuário). Único cuidado a preservar (não uma ação corretiva, apenas uma invariante a não violar): garantir que nenhuma dessas 5 variáveis VITE_* jamais contenha um client_secret em vez de um client_id — não há evidência, nesta leitura, de que isso esteja ocorrendo hoje.
```

---

## Resumo

```text
UNRESOLVED_INTEGRATIONS_INITIAL:
1

INTEGRATIONS_RESOLVED:
1

INTEGRATIONS_REQUIRING_DECISION:
0

BROWSER_CREDENTIAL_CASES_INITIAL:
1

PRIVATE_SECRETS_EXPOSED:
0

PUBLIC_CLIENT_CREDENTIALS:
1

UNCERTAIN_CREDENTIAL_CASES:
0

NEW_API_V2_REQUIREMENTS:
0
```

`INTEGRATIONS_RESOLVED` (1) cobre a única integração pendente do doc30, tratada em duas partes (distribuidoras + NF-e) porque tinham naturezas distintas — ambas resolvidas com evidência já existente (D1/doc25 para distribuidoras; docs 19-21 Caso 3 para NF-e), sem exigir nenhuma decisão nova (`INTEGRATIONS_REQUIRING_DECISION: 0`). `NEW_API_V2_REQUIREMENTS: 0` porque nenhum requisito novo foi descoberto nesta etapa — o requisito de NF-e já estava rastreado desde o doc19/21, e o requisito de distribuidoras já está coberto pelo princípio geral de D1, não sendo um item avulso novo.

## Cobertura

Os 2 itens pendentes do doc30 foram resolvidos com evidência de `apps/web/**` já lida (neste documento e em docs anteriores da auditoria) — nenhuma consulta a `apps/api` foi necessária, nenhuma pesquisa de documentação externa foi feita. Nenhum valor de credencial foi impresso, apenas nomes de variável. `apps/web` e `apps/api` não foram alterados. Nenhuma credencial foi movida ou revogada.
