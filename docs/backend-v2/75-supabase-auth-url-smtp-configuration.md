> Historical record. Kept as recorded; not the current contract.

# 75 — Auditoria de Site URL, Redirect URLs e SMTP do Supabase Auth (MUSIC OS 360)

Auditoria parcial: esta sessão NÃO possui acesso autenticado ao projeto Supabase real ("MUSIC OS 360") — nem via MCP (`plugin:supabase:supabase` requer autorização não disponível neste ambiente não-interativo), nem via Supabase CLI (`npx supabase projects list` falhou por ausência de perfil/token de login válido). Como consequência, a CONFIGURAÇÃO ATUAL de Site URL/Redirect URLs/SMTP do projeto real **não pôde ser lida**, e nenhuma alteração foi ou poderia ter sido feita no projeto remoto. Este documento registra apenas o que é determinável a partir do repositório (código do frontend, arquivos de ambiente da raiz) — os requisitos derivados dele — e marca explicitamente como pendente tudo que dependeria de acesso ao painel/API do Supabase.

Nenhum database schema, RLS, storage, realtime ou Edge Function foi tocado (fora do escopo desta etapa de qualquer forma). Nenhum secret foi registrado neste documento.

## Incidente de segurança registrado nesta sessão

```text
Durante a auditoria, um comando de busca amplo demais (grep por "URL" em .env.development) expôs em
texto claro, no transcript desta conversa, a senha real do Postgres do branch de desenvolvimento
Supabase (embutida na connection string de DATABASE_URL/DIRECT_DATABASE_URL). O usuário foi alertado
diretamente no momento em que isso ocorreu. RECOMENDAÇÃO: rotacionar a senha do Postgres do branch de
desenvolvimento (ref rypnevnfipygyhysqpdo) o quanto antes, já que ela foi exibida nesta sessão. Nenhum
outro valor de secret foi exposto nesta auditoria — todas as leituras subsequentes foram escopadas a
variáveis não-secretas (VITE_API_URL, VITE_SUPABASE_URL, CORS_ORIGINS, etc.).
```

---

## 1. Projeto Supabase

```text
SUPABASE_PROJECT (nome):
MUSIC OS 360

PROJECT_REF (projeto MAIN/produção — fonte: SUPABASE_PROD_REF em scripts/env-check.mjs, doc42/49,
não reaberto):
sxmfeocztlztvpdnxayk

PROJECT_REGION:
NÃO CONFIRMADO via acesso autenticado. Indício indireto (não prova): o hostname do pooler usado pelo
branch de DESENVOLVIMENTO (ref rypnevnfipygyhysqpdo) em .env.development aponta para
"aws-0-us-east-1.pooler.supabase.com", sugerindo us-east-1 — branches tipicamente herdam a região do
projeto MAIN, mas isso não foi verificado para o projeto MAIN em si nesta etapa.

BRANCHES conhecidas (contexto, doc42/49, não reabertas):
PROD_REF: sxmfeocztlztvpdnxayk
STAGING_REF: jjnnjnxjkqipgqebijen
DEV_REF: rypnevnfipygyhysqpdo (branch atualmente linkado ao Supabase CLI local deste repositório,
  confirmado via supabase/.temp/project-ref)

Toda leitura realizada nesta etapa foi de ARQUIVOS DO REPOSITÓRIO, nunca de uma chamada de rede ao
projeto Supabase real — nenhum outro projeto Supabase foi tocado, pela simples razão de que NENHUM foi
acessado remotamente nesta etapa.
```

---

## 2. Configuração atual do Supabase Auth — NÃO VERIFICÁVEL nesta sessão

```text
SITE_URL_CURRENT:
NÃO VERIFICÁVEL (sem acesso autenticado ao Dashboard/Management API/CLI logado)

REDIRECT_URLS_CURRENT:
NÃO VERIFICÁVEL (idem)

CUSTOM_SMTP_ENABLED:
NÃO VERIFICÁVEL (idem) — supabase/config.toml (config LOCAL do emulador `supabase start`, não do
  projeto remoto hospedado) tem [auth.email.smtp] comentado/desabilitado, mas isso descreve apenas o
  ambiente local Docker, não o projeto real "MUSIC OS 360" hospedado.

SMTP_HOST_CONFIGURED:
NÃO VERIFICÁVEL

SMTP_PORT:
NÃO VERIFICÁVEL

SMTP_SENDER_NAME_CONFIGURED:
NÃO VERIFICÁVEL

SMTP_SENDER_EMAIL_CONFIGURED:
NÃO VERIFICÁVEL

SMTP_USERNAME_CONFIGURED:
NÃO VERIFICÁVEL

SMTP_PASSWORD_CONFIGURED:
NÃO VERIFICÁVEL

Para desbloquear esta seção em uma etapa futura: autorizar o MCP `plugin:supabase:supabase` (via
configurações de conector do claude.ai) OU autenticar o Supabase CLI localmente (`supabase login`) com
um access token válido, e então reexecutar apenas esta seção da auditoria.
```

---

## 3. URLs canônicas identificadas por ambiente (a partir do repositório)

```text
DEVELOPMENT_WEB_URL:
http://localhost:5000

  Fonte: apps/web/scripts/run-vite.mjs:10 — `const port = Number(process.env.VITE_PORT ??
  process.env.PORT ?? 5000)`, o runner real usado por `npm run dev` (apps/web/package.json: "dev":
  "node scripts/run-vite.mjs dev") — porta 5000 é o comportamento de código, não apenas documentação.
  Confirmado de forma independente por docker-compose.observability.yml (serviço `web`, porta "5000:5000").

  DISCREPÂNCIA REGISTRADA (não resolvida silenciosamente): .env.development define
  CORS_ORIGINS=http://localhost:5173,http://localhost:3000 — nenhuma dessas 2 portas é 5000. Não é
  possível determinar, só pelo repositório, se essa lista é apenas uma allowlist permissiva/desatualizada
  (permitindo rodar o Vite numa porta alternativa manualmente) ou um requisito real ainda não reconciliado
  com o default do run-vite.mjs. Registrado como pendência, não escolhido silenciosamente.

STAGING_WEB_URL:
UNRESOLVED — nenhum domínio de staging real está comprometido no repositório. .env.staging define
  apenas `STAGING_API_URL=https://<STAGING_API_URL>` (placeholder), sem nenhuma variável de URL do WEB
  de staging. Nenhum arquivo de configuração de deployment do repositório contém um domínio.

PRODUCTION_WEB_URL:
UNRESOLVED — .env.production define `FRONTEND_URL=https://<PRODUCTION_FRONTEND_DOMAIN>` (placeholder,
  registrado deliberadamente assim no PROMPT 82, sem inventar domínio). Nenhum arquivo do repositório declara
  alias/domínio (esse tipo de configuração vive na plataforma de hospedagem, não no repositório).
```

---

## 4. Site URL — regra e valor requerido

```text
SITE_URL = URL canônica de produção do frontend (regra registrada, não reaberta pelo prompt)

SITE_URL_REQUIRED:
UNRESOLVED (PRODUCTION_WEB_URL é UNRESOLVED — ver seção 3; nenhuma URL de produção real está provada no
  repositório, portanto nenhum valor é inventado aqui, conforme regra explícita do prompt)

Como SITE_URL_REQUIRED é UNRESOLVED E a configuração atual também não pôde ser lida (seção 2), NENHUMA
alteração de Site URL foi ou poderia ter sido proposta/aplicada nesta etapa.
```

---

## 5-8. Redirect URLs — auditoria de uso real no frontend

```text
Busca exaustiva em apps/web/src por: redirectTo, emailRedirectTo, resetPasswordForEmail, signUp,
updateUser, OAuth redirect, callback, auth callback.

ÚNICO redirect explícito de Supabase Auth encontrado no código:

FLUXO: Password reset
ARQUIVO: apps/web/src/app/providers/AuthContext.tsx:314-315
CÓDIGO: `const redirectTo = ${window.location.origin}/reset-password;` passado a
  `auth.resetPasswordForEmail(email, { redirectTo })`
ROTA REGISTRADA: apps/web/src/app/routes/public.routes.tsx:31 — `<Route path="/reset-password"
  element={<ResetPassword />} />` — rota real, componente real, não hipotética.

SIGNUP (Register.tsx → AuthContext.tsx signUp): `auth.signUp({ email, password, options: { data: {...} }
  })` — SEM `emailRedirectTo` explícito. O redirect do link de confirmação de email depende inteiramente
  do Site URL configurado no projeto (que não pôde ser lido, seção 2) — nenhuma rota
  /confirm-email ou /auth/callback dedicada foi encontrada no roteador.

/oauth/callback e /oauth/:platform (public.routes.tsx:24-25): NÃO são redirects de Supabase Auth — são o
  callback de OAuth de integrações de terceiros (Spotify/Meta/TikTok/Google, doc17/30/31, mediado pela
  apps/api, não pelo Supabase Auth diretamente) — fora do escopo desta auditoria (ver instrução do
  prompt: "auditar exclusivamente Site URL/Redirect URLs/SMTP/fluxos de e-mail do Supabase Auth").

Allowlist REQUERIDA (derivada exclusivamente do uso real acima — apenas o path /reset-password,
  nenhuma URL inventada):

development: http://localhost:5000/reset-password
staging:     UNRESOLVED (depende de STAGING_WEB_URL, seção 3)
production:  UNRESOLVED (depende de PRODUCTION_WEB_URL, seção 3)

DEVELOPMENT_REDIRECTS_PRESERVED:
SIM — nenhuma alteração foi feita (nem poderia, sem acesso), portanto o redirect local
  (http://localhost:5000/reset-password, e qualquer outro já configurado hoje) permanece como está.

STAGING_REDIRECTS_SEPARATE:
UNRESOLVED — não verificável sem 1) acesso à config atual (seção 2) e 2) STAGING_WEB_URL resolvido
  (seção 3).

PRODUCTION_REDIRECTS_SEPARATE:
UNRESOLVED — mesma razão, para PRODUCTION_WEB_URL.
```

---

## 9-11. SMTP

```text
SMTP_CONFIGURATION_REQUIRES_CREDENTIALS:
SIM

Não foi possível determinar, nesta etapa, se o projeto real já usa Custom SMTP ou o SMTP padrão do
Supabase (seção 2, não verificável). Nenhuma credencial de SMTP (host/username/password/sender/provider)
foi inventada, adivinhada ou configurada — conforme proibição explícita do prompt. Nenhuma credencial
real de SMTP foi localizada em nenhum arquivo do repositório (.env.development/.env.staging/
.env.production não contêm nenhuma variável SMTP_* — apenas RESEND_API_KEY, referente ao Resend,
usado pela apps/api para envio transacional de e-mail de NEGÓCIO, um sistema distinto do SMTP do
Supabase Auth, doc53, não confundido aqui).
```

---

## 12-13. Fluxos de email e templates

```text
Fluxos de email do Supabase Auth confirmados em uso pelo código real do frontend:
- signup confirmation (auth.signUp, sem emailRedirectTo explícito — depende do Site URL)
- password reset (auth.resetPasswordForEmail, redirectTo explícito para /reset-password)

Não encontrada nenhuma evidência de uso de: email change confirmation com redirect dedicado, magic link,
ou invite flow no código atual de apps/web/src — não habilitados/assumidos nesta auditoria (regra
explícita do prompt: não habilitar fluxo novo sem contrato funcional já existente).

Templates de email do Supabase Auth não foram redesenhados (fora de escopo, conforme instrução). A
verificação de compatibilidade entre as URLs usadas pelos templates e o Site URL/Redirect URLs real do
projeto não pôde ser feita nesta etapa, pela mesma limitação de acesso da seção 2.
```

---

## 14. Site URL vs. API URL

```text
SUPABASE_SITE_URL:
frontend (apps/web) — NUNCA a apps/api-v2. Confirmado pelo próprio uso no código: todo redirectTo
  observado (seção 5-8) resolve para uma rota do frontend (`/reset-password`, roteador React de
  apps/web), nunca para um endpoint HTTP da API.

API_V2_URL:
backend (apps/api-v2) — não relacionado ao Site URL do Supabase Auth em nenhuma circunstância.
```

---

## 15. Segurança de redirect

```text
OPEN_REDIRECT_RISK:
NÃO (baseado no que foi encontrado no código)

O único redirect dinâmico encontrado (`${window.location.origin}/reset-password`) é construído a partir
de `window.location.origin` do PRÓPRIO app (nunca de um parâmetro de URL/query string controlado por um
terceiro) e aponta para um path fixo dentro do próprio domínio do frontend — não há concatenação de
input externo/arbitrário na construção do redirect. A allowlist requerida (seção 5-8) usa paths exatos
por ambiente, nunca um wildcard amplo (`*`/`**`) — nenhuma necessidade funcional comprovada para
wildcard foi encontrada.

Nota: esta conclusão é sobre o CÓDIGO do frontend, não sobre a configuração atual do projeto Supabase
(que pode ou não já conter uma allowlist mais ampla do que o necessário — não verificável, seção 2).
```

---

## 16. Alterações realizadas

```text
NENHUMA. Toda alteração de Site URL/Redirect URLs/SMTP no projeto Supabase real está condicionada, pela
própria regra deste prompt, a valor comprovado — e a etapa de leitura da configuração ATUAL (pré-
requisito para saber o que precisaria mudar) não pôde ser executada por falta de acesso autenticado
(seção 2). Registrado como pendência total, não como decisão silenciosa.
```

---

## 17. Teste de entrega

```text
SMTP_DELIVERY_TEST:
NOT_RUN

Não executado — nenhuma configuração de SMTP pôde sequer ser lida (seção 2), e nenhum destinatário
humano real foi fornecido para um teste de entrega seguro. Não mascarado como PASS.
```

---

## Pendências consolidadas (para retomada quando houver acesso)

```text
1. Autorizar acesso (MCP `plugin:supabase:supabase` ou `supabase login` com token válido) para ler
   SITE_URL_CURRENT, REDIRECT_URLS_CURRENT e configuração SMTP reais do projeto "MUSIC OS 360" (ref
   sxmfeocztlztvpdnxayk).
2. Resolver STAGING_WEB_URL e PRODUCTION_WEB_URL (domínios reais, hoje inexistentes no repositório) antes
   de poder definir SITE_URL_REQUIRED ou a allowlist completa de Redirect URLs de staging/produção.
3. Reconciliar a discrepância de porta de desenvolvimento (run-vite.mjs default 5000 vs.
   CORS_ORIGINS=5173,3000 em .env.development) — não resolvida silenciosamente nesta etapa.
4. Rotacionar a senha do Postgres do branch de desenvolvimento Supabase (ref rypnevnfipygyhysqpdo),
   exposta acidentalmente no transcript desta sessão (ver seção "Incidente de segurança" acima).
```

---

## Resumo

```text
UNRESOLVED_AUTH_CONFIGURATION_ITEMS:
7 (SITE_URL_CURRENT, REDIRECT_URLS_CURRENT, CUSTOM_SMTP_ENABLED/detalhes SMTP, STAGING_WEB_URL,
   PRODUCTION_WEB_URL, discrepância de porta dev, rotação de senha exposta)
```

## Cobertura

Projeto identificado (MUSIC OS 360, ref MAIN sxmfeocztlztvpdnxayk, região não confirmada). Configuração
ATUAL de Auth do projeto real não pôde ser lida nesta sessão por ausência de acesso autenticado (MCP não
autorizado, CLI sem login) — registrado explicitamente, não mascarado. A partir do código real do
frontend, identificado o único redirect explícito de Supabase Auth em uso (`/reset-password`, password
reset) e confirmado que signup não usa redirect explícito (depende do Site URL). URLs canônicas por
ambiente determinadas onde possível (development: http://localhost:5000, confirmado por 2 fontes
independentes de código/config) e marcadas UNRESOLVED onde não há domínio real comprometido no
repositório (staging, production) — nenhum domínio foi inventado. SMTP não verificável nesta etapa;
nenhuma credencial inventada. Nenhuma alteração foi feita no projeto Supabase real. Um incidente de
exposição acidental de secret (senha de Postgres de desenvolvimento) ocorrido durante esta própria sessão
foi registrado com recomendação de rotação. Nenhum database schema, RLS, storage, realtime, Edge
Function, frontend ou backend legacy foi alterado. Git não foi modificado. Nenhum documento anterior foi
modificado.
