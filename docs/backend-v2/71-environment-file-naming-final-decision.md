> Historical record. Kept as recorded; not the current contract.

# 71 — Convenção Final de Arquivos `.env` por Ambiente

Definição read-only da convenção única de arquivos de configuração por ambiente do MUSIC OS 360, para uso a partir da reconstrução da API v2. Nenhum arquivo `.env`/`.env.example`/`.env.staging.example`/`.gitignore` foi renomeado, criado ou alterado. Nenhum valor/secret foi alterado. Vite, NestJS, Docker, CI/CD e Git não foram alterados. `apps/api-v2` não foi criado.

## Mapeamento de branches confirmado no repositório (evidência real, não presumida)

```text
.github/workflows/branch-policy.yml:7-9 — branches permanentes explicitamente declaradas: "main, dev,
  staging" (linha 80: "Permanent branches: main, dev, staging")
.github/workflows/staging.yml:17 — dispara especificamente em push para a branch "staging"
.github/workflows/ci.yml:8 + security.yml:6 — rodam nas 3 branches: dev, staging, main
docker-compose.yml:64 — serviço "api" já fixa NODE_ENV: staging explicitamente (ambiente local de
  staging simulado)

MAPEAMENTO CONFIRMADO:
dev     → development
staging → staging
main    → production
(test não é uma branch — é um modo de execução de CI/local, doc42/49: "test → NENHUM projeto remoto",
já uma regra de isolamento existente, não branch-dependente)
```

---

## Princípio (reafirmado)

```text
A identidade interna do ambiente da aplicação nunca é a branch em si — é um dos 4 nomes canônicos:
development, staging, production, test. O mapeamento de branch→ambiente (acima) é documentação
operacional de CI/CD, não uma variável ou convenção de nome de arquivo de configuração.
```

---

## Convenção final de templates versionados

```text
DEVELOPMENT: .env.development.example
STAGING:      .env.staging.example
PRODUCTION:    .env.production.example
TEST:           .env.test.example
```

## Convenção final de arquivos locais (nunca versionados)

```text
LOCAL_OVERRIDE_PATTERN:
.env.{environment}.local

.env.development.local
.env.staging.local
.env.production.local
.env.test.local
```

---

## Verificação de compatibilidade

```text
Vite (apps/web):
Vite carrega .env.[mode]/.env.[mode].local por convenção nativa própria (modes arbitrários suportados
via --mode <nome>, não limitado a "development"/"production" default) — compatível com os 4 nomes
canônicos, incluindo "staging" como mode customizado. RESSALVA CONCRETA encontrada nesta verificação:
o runner atual do projeto (apps/web/scripts/run-vite.mjs) invoca createServer()/build()/preview() sem
passar um "mode" explícito — hoje decide só entre "dev"/"build"/"preview" via argv, sem selecionar
staging/test como mode Vite dedicado. Isso não invalida a convenção (Vite já suporta nativamente); é um
ajuste de INVOCAÇÃO a ser feito quando os arquivos forem de fato adotados (fora do escopo desta etapa —
"não alterar Vite").

Node.js 24 / NestJS 11 / Docker / GitHub Actions / deployment long-running:
Nenhum desses componentes lê arquivo .env diretamente por convenção própria de framework (NestJS não
carrega .env sozinho — depende de @nestjs/config, já decidido e configurável para apontar a um arquivo
específico por ambiente, doc53, não reaberto aqui) — todos compatíveis com qualquer nome de arquivo,
desde que a aplicação/pipeline seja explicitamente instruída a carregá-lo. GitHub Actions já injeta
variáveis diretamente via secrets (staging.yml, doc42/53), sem depender de arquivo físico. A única
EXCEÇÃO PARA ATENÇÃO é o Docker Compose (ver seção .env abaixo).
```

---

## `.env.example` (arquivo genérico atual)

```text
GENERIC_ENV_EXAMPLE:
KEEP

Decisão: B (permanecer), mas com papel REDEFINIDO e inequívoco para não ser redundante com os 4
templates por ambiente: .env.example passa a ser o CATÁLOGO COMPLETO de referência — todas as
variáveis que a aplicação pode usar em qualquer ambiente, documentadas uma única vez (nome, propósito,
exemplo de formato), nunca copiado diretamente para rodar a aplicação em nenhum ambiente específico.
Os 4 arquivos .env.{environment}.example são os TEMPLATES ACIONÁVEIS (subconjunto relevante a cada
ambiente, com obrigatoriedade/formato já ajustado a esse ambiente, prontos para copiar para
.env.{environment}.local) — papel distinto e complementar, não sobreposto.
```

---

## `.env` (arquivo genérico atual)

```text
GENERIC_ENV_FILE:
KEEP_AS_LOCAL_OVERRIDE

Decisão: B, mas ESCOPADA e explícita — não um "B genérico". Motivo concreto encontrado nesta
verificação: docker-compose.yml (usado hoje exclusivamente para desenvolvimento local, conforme o
próprio cabeçalho do arquivo) depende do comportamento NATIVO do Docker Compose de carregar
automaticamente um arquivo chamado literalmente ".env" no diretório do projeto para interpolação de
variável (sintaxe ${POSTGRES_PASSWORD:?...} já presente no arquivo) — renomear ou eliminar esse arquivo
sem reconfigurar o Compose (proibido nesta etapa: "não alterar Docker") quebraria a interpolação de
variável do stack local. Portanto: ".env" permanece, mas seu escopo é estritamente LOCAL/DEVELOPMENT —
funcionalmente equivalente ao conteúdo de ".env.development.local", nomeado ".env" apenas porque essa é
a convenção que a ferramenta Docker Compose exige para autodetecção. NUNCA usado para staging/produção
(que não rodam via este docker-compose, doc61 — deployment long-running via outro mecanismo) — não
determina, e nunca determinou nesta convenção, produção/staging silenciosamente.
```

---

## Frontend (`apps/web`)

```text
Mapeamento explícito de ambiente ↔ arquivo Vite:
development → .env.development.example / .env.development.local (Vite mode "development", default)
staging     → .env.staging.example / .env.staging.local (Vite mode "staging", customizado)
production  → .env.production.example / .env.production.local (Vite mode "production", default)
test         → .env.test.example / .env.test.local (Vite mode "test", customizado — usado por vitest)

Variáveis VITE_* continuam PÚBLICAS para o browser em qualquer um dos 4 arquivos — mesma regra já
fixada no doc53 (fronteira client-side vs. server-side), reafirmada, não reaberta. Nenhum secret
privado é permitido em nenhum arquivo .env.*.example nem .env.*.local do lado apps/web, em nenhum
ambiente, incluindo development.
```

---

## API v2 (`apps/api-v2`)

```text
Fonte canônica do ambiente da aplicação: NODE_ENV

Decisão e motivo: NÃO introduzir uma segunda variável (APP_ENV) competindo com NODE_ENV para a mesma
responsabilidade — evidência real já encontrada no legacy (docker-compose.yml:64 já fixa
"NODE_ENV: staging" literalmente; a função isProdLike já citada no doc49 já ramifica em
"nodeEnv === 'production' || nodeEnv === 'staging'") confirma que este projeto JÁ usa NODE_ENV com os 4
valores reais (development/staging/production/test), divergindo deliberadamente da convenção
tradicional do ecossistema Node (que tipicamente só reconhece development/production/test) — um padrão
já provado e funcional neste código-base específico. Introduzir APP_ENV como variável separada
duplicaria a mesma responsabilidade sem necessidade técnica comprovada, criando ambiguidade
("qual das duas manda quando divergem?") exatamente do tipo que este prompt pede para eliminar.

NODE_ENV values (4, mesmos nomes canônicos): development | staging | production | test

ConfigModule não foi implementado nesta etapa (proibido pelo prompt) — apenas a variável fonte de
verdade do ambiente foi definida.
```

---

## Legacy (`apps/api`)

```text
Nenhum arquivo do legacy foi renomeado nesta etapa (proibido pelo prompt). Registrado apenas para
migração futura durante o cutover: os arquivos atuais na raiz do monorepo (.env, .env.example,
.env.staging.example) serão substituídos, no momento do cutover (não nesta etapa), pela convenção de 4
arquivos por ambiente definida aqui — .env.staging.example em particular é hoje um nome já parcialmente
alinhado à convenção final (só falta o sufixo ".example" já estar correto e os 3 arquivos irmãos
— development/production/test — ainda não existirem) — não é uma migração de zero, é uma extensão do
padrão parcialmente já presente.
```

---

## Secrets

```text
Arquivos com valor real (.env.development.local, .env.staging.local, .env.production.local,
.env.test.local, e o .env local de desenvolvimento já existente, escopo redefinido acima) permanecem
SEMPRE fora do Git — nenhuma exceção por ambiente, incluindo development (mesma regra já fixada no
doc53, "nenhum SECRET tem default em nenhum ambiente, nem development").

Arquivos *.example (os 4 templates + o catálogo genérico redefinido) contêm exclusivamente: nome da
variável, valor fictício/placeholder seguro, documentação — nunca um secret real, em nenhuma
circunstância.
```

---

## Gitignore (política conceitual, não implementada nesta etapa)

```text
COMMIT: *.example (os 4 templates por ambiente + o catálogo genérico redefinido)
DO_NOT_COMMIT: *.local (os 4 arquivos locais por ambiente) + o arquivo ".env" de desenvolvimento local
  (escopo já redefinido acima como equivalente a .env.development.local)

Nenhuma alteração ao .gitignore real foi feita nesta etapa (proibido pelo prompt) — apenas a política
que um futuro ajuste de .gitignore deveria implementar.
```

---

## CI/CD

```text
Production e staging NÃO dependem de arquivo .env físico no pipeline — GitHub Actions já injeta
variáveis diretamente via secrets (staging.yml, evidência já citada no doc42/53, não reaberta), o
runtime do container recebe variáveis de ambiente diretamente do mecanismo de deployment (provedor
ainda não escolhido, doc61, mesma categoria de decisão deferida). Os arquivos *.example (dos 4 ambientes
+ o catálogo genérico) servem como CONTRATO/DOCUMENTAÇÃO do que cada ambiente espera — nunca como
mecanismo de injeção real em produção/staging.
```

---

## Resultado esperado (confirmado)

```text
DEVELOPMENT → .env.development.example (+ .env.development.local)
STAGING      → .env.staging.example (+ .env.staging.local)
PRODUCTION    → .env.production.example (+ .env.production.local)
TEST           → .env.test.example (+ .env.test.local)

.env.example (genérico) → mantido como catálogo completo de referência, papel distinto dos 4 templates
.env (genérico)          → mantido, escopo redefinido e restrito a development local (exigência técnica
                          do Docker Compose), nunca determinando staging/produção
```

---

## Resumo

```text
UNRESOLVED_ENV_NAMING_DECISIONS:
0
```

## Cobertura

Mapeamento branch→ambiente confirmado com evidência real do repositório (branch-policy.yml, staging.yml,
ci.yml, docker-compose.yml), não presumido. Convenção de 4 templates versionados + 4 arquivos locais
não versionados definida. Compatibilidade com Vite (com ressalva concreta sobre o runner atual não
passar --mode ainda, registrada sem corrigir), Node.js 24, NestJS 11, Docker, GitHub Actions e
deployment long-running verificada. `.env.example` mantido com papel redefinido (catálogo, não
template). `.env` mantido com escopo redefinido e restrito (exigência técnica do Docker Compose para
desenvolvimento local, nunca silenciosamente determinando staging/produção). Fonte canônica de ambiente
da API v2 definida como NODE_ENV (não uma segunda variável APP_ENV), com evidência real de que o
próprio projeto já usa NODE_ENV com os 4 valores canônicos, divergindo deliberadamente da convenção
Node.js tradicional. Papel do legacy, política de secrets e gitignore, e comportamento de CI/CD
definidos conceitualmente, sem nenhuma alteração real de arquivo. Nenhum arquivo `.env`/`.env.example`/
`.env.staging.example`/`.gitignore` foi renomeado, criado ou alterado. Nenhum valor/secret foi alterado.
Vite, NestJS, Docker, CI/CD e Git não foram alterados. `apps/api-v2` não foi criado.
