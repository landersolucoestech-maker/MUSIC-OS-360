> Historical record. Kept as recorded; not the current contract.

# 02 — Auditoria das Alterações Não Commitadas em `apps/web`

Documento gerado por inspeção read-only, escopo restrito a `apps/web/**`. Nenhum arquivo foi editado, nenhum comando de escrita Git foi executado.

## Comandos usados

- `git diff --name-status -- apps/web/` → 1 arquivo modificado.
- `git status --short -- apps/web/` → confirma apenas `M apps/web/.env.example`, nenhum deletado.
- `git ls-files --others --exclude-standard -- apps/web/` → vazio (nenhum arquivo novo/não rastreado em `apps/web`).
- `git diff -- apps/web/.env.example` → diff completo abaixo.

## Arquivos modificados em `apps/web`: 1

## Arquivos deletados em `apps/web`: 0

## Arquivos novos (não rastreados) em `apps/web`: 0

---

## ARQUIVO: `apps/web/.env.example`

**STATUS GIT:** M (modificado)

**TIPO DE ALTERAÇÃO:** configuração

**Diff real:**

```diff
diff --git a/apps/web/.env.example b/apps/web/.env.example
index f7b35f5f..32e9317b 100644
--- a/apps/web/.env.example
+++ b/apps/web/.env.example
@@ -5,6 +5,7 @@
 # R2/S3 secrets, Redis URLs with passwords, Stripe secrets, or provider API keys here.
 
 VITE_API_URL=http://localhost:3001
+VITE_PORT=5000
 VITE_SUPABASE_URL=https://<SUPABASE_PROJECT_REF>.supabase.co
 VITE_SUPABASE_ANON_KEY=<SUPABASE_ANON_PUBLIC_KEY>
 VITE_AUTH_DISABLED=false
@@ -12,6 +13,8 @@ VITE_WS_ENABLED=true
 VITE_APP_VERSION=0.0.1
 VITE_POSTHOG_KEY=<POSTHOG_PUBLIC_KEY>
 VITE_SENTRY_DSN=<SENTRY_PUBLIC_DSN>
+VITE_DOCUSIGN_INTEGRATION_KEY=<DOCUSIGN_INTEGRATION_KEY>
+VITE_DOCUSIGN_AUTH_BASE_URL=https://account-d.docusign.com
 VITE_STRIPE_CONNECT_CLIENT_ID=<STRIPE_CONNECT_CLIENT_ID>
 VITE_META_APP_ID=<META_APP_ID>
 VITE_GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
```

**RESUMO OBJETIVO DO DIFF:** 3 linhas adicionadas, 0 removidas, 0 arquivos além deste. Adiciona três chaves de exemplo ao template `.env.example`: `VITE_PORT=5000` (porta de dev do Vite) e um par novo `VITE_DOCUSIGN_INTEGRATION_KEY` / `VITE_DOCUSIGN_AUTH_BASE_URL` (placeholders para uma integração DocuSign). Nenhuma outra linha do arquivo foi alterada ou removida.

**IMPACTA COMPORTAMENTO DO FRONTEND: NÃO**
`.env.example` é um arquivo de template/documentação de variáveis — não é o `.env` real consumido em runtime pelo Vite/build, e não é importado por nenhum código-fonte. A adição de linhas aqui não muda nenhum comportamento em execução por si só.

**IMPACTA CONTRATO COM BACKEND: INCERTO**
As duas novas variáveis `VITE_DOCUSIGN_*` sugerem a existência (ou preparação) de uma integração com um provedor externo (DocuSign), não com `apps/api` diretamente. Se e como essas variáveis são consumidas por código real de `apps/web` (e se há um contrato correspondente em `apps/api`) não foi verificado nesta etapa — o escopo deste prompt limitou a análise ao diff do arquivo em si, sem inspecionar o código-fonte que eventualmente as consome.

---

## Totais

```text
TOTAL_APPS_WEB_CHANGED: 1

VISUAL_CHANGES: 0

FUNCTIONAL_CHANGES: 0

API_CONTRACT_CHANGES: 0

MOCK_OR_FALLBACK_CHANGES: 0

TEST_CHANGES: 0

UNCLASSIFIED: 0
```

(1 arquivo classificado como "configuração" — categoria própria fora das listadas acima; contabilizado em `TOTAL_APPS_WEB_CHANGED` mas não em nenhum dos contadores temáticos porque nenhum deles ("visual/UI", "comportamento funcional", "integração/API", "tipagem", "teste", "mock/fallback", "refatoração") descreve com precisão uma alteração restrita a um arquivo de exemplo de variáveis de ambiente.)

## Lista de arquivos de `apps/web` alterados

- `apps/web/.env.example` (M)
