> Historical record. Kept as recorded; not the current contract.

# 46 — Estratégia de Migrations do Database v2

Decisão read-only baseada em [`42-api-v2-technical-constraints.md`](./42-api-v2-technical-constraints.md) e [`45-api-v2-database-access-decision.md`](./45-api-v2-database-access-decision.md). `Database access: Drizzle ORM` permanece fixo, não reaberto. Nenhuma migration/schema/tabela foi criada. Nenhuma conexão ao banco foi feita. Supabase não foi alterado. Nenhuma dependência foi instalada. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados.

## Decisões fixas (não reabertas)

```text
Banco: PostgreSQL
Database access: Drizzle ORM
Banco v2: schema novo e consolidado
Migrations legacy: não serão herdadas automaticamente
```

## Evidência de contexto usada nesta decisão

```text
apps/api/drizzle/_DEPRECATED.md (doc45, já registrado)
  → drizzle-kit generate já foi usado neste repositório numa fase anterior; a
  descontinuação foi por consolidação em executor único (TypeORM), não por defeito
  técnico da ferramenta em si — não influencia esta decisão, apenas confirma que a
  equipe já tem exposição prévia ao formato de arquivo gerado por drizzle-kit.
  Nomenclatura observada nos arquivos arquivados: "0000_mixed_jimmy_woo.sql" —
  nomes aleatórios gerados automaticamente pelo drizzle-kit quando nenhum --name
  é fornecido; relevante para a convenção de nomenclatura desta estratégia (abaixo).

apps/api/src/database/migration-validator.service.ts
  → padrão já em produção: validação de migrations pendentes no boot (fatal em
  produção, warn em dev), usando uma conexão "owner" dedicada porque a própria
  tabela de controle de migrations tem RLS habilitado sem policy para o role de
  aplicação. Este padrão é agnóstico de ferramenta — depende apenas de existir uma
  tabela de controle de migrations aplicadas, algo que tanto drizzle-kit quanto SQL
  manual versionado fornecem igualmente.

.github/workflows/staging.yml
  → migrations em staging já rodam hoje como uma etapa CI explicitamente
  gated por autorização humana (checkbox "apply_migrations"), separada de uma
  verificação read-only de pendências (db:check) — um padrão de segurança
  operacional já validado neste projeto, reutilizável com qualquer executor de
  migration baseado em arquivos SQL versionados, incluindo Drizzle.

.env.example (DIRECT_DATABASE_URL)
  → "Para migrations (sem pooler)" — já existe uma convenção estabelecida de usar
  uma connection string SEM pgbouncer/pooler especificamente para aplicar
  migrations, distinta da DATABASE_URL/APP_DATABASE_URL usadas em runtime — também
  agnóstica de ferramenta, diretamente aplicável ao Drizzle.
```

---

## Opções avaliadas

```text
OPTION:
Drizzle Kit (100% automático — geração exclusivamente a partir do schema TypeScript)

COMPATIBLE_WITH_DRIZZLE:
SIM — é a ferramenta de migration do próprio ecossistema Drizzle.

SUPPORTS_SCHEMA_FROM_SCRATCH:
SIM — `drizzle-kit generate` faz diff contra um schema vazio na primeira execução, produzindo a migration inicial completa a partir de pgTable()/relations definidas em TypeScript.

SUPPORTS_RAW_SQL:
NÃO como fluxo padrão — o modo 100% automático só produz o SQL que o próprio diff de schema consegue inferir a partir das definições TypeScript; não há como inserir SQL arbitrário dentro do arquivo gerado sem sair do fluxo "somente automático" (isso já seria o modo híbrido, avaliado à parte abaixo).

SUPPORTS_RLS:
PARCIAL/INSUFICIENTE — versões recentes do Drizzle introduziram `pgPolicy()`/`.enableRLS()` no schema TypeScript, mas a cobertura de políticas RLS complexas (USING/WITH CHECK com expressões arbitrárias referenciando funções/session variables como `current_setting('app.current_tenant_id')`) não é garantidamente representável de forma completa e auditável só pela DSL do schema — o requisito obrigatório deste prompt (versionar explicitamente ENABLE ROW LEVEL SECURITY / CREATE POLICY / ALTER POLICY / DROP POLICY como SQL legível) não é atendido com segurança apenas por geração automática.

SUPPORTS_POSTGRES_EXTENSIONS:
NÃO — `CREATE EXTENSION` não faz parte da DSL de schema do Drizzle; não há como expressar isso em pgTable() para geração automática.

SUPPORTS_FUNCTIONS_AND_TRIGGERS:
NÃO — funções PL/pgSQL e triggers não são representáveis na DSL de schema do Drizzle; ficariam fora do que o modo 100% automático consegue gerar.

CI_COMPATIBILITY:
Forte para o que consegue gerar — arquivos .sql versionados em pasta, aplicáveis via `drizzle-kit migrate` num step de CI, compatível com o padrão de gating por autorização já usado em staging.yml.

SUPABASE_POSTGRES_COMPATIBILITY:
Compatível como Postgres padrão, mas por não cobrir RLS/extensions/functions/triggers, deixaria justamente as partes mais específicas de Supabase (RLS é o mecanismo central de isolamento de tenant deste projeto) fora do versionamento automático — obrigando, na prática, a complementar com SQL manual de qualquer forma.

RISKS:
- Não atende ao requisito obrigatório deste prompt (RLS versionada explicitamente) de forma confiável.
- Cria uma falsa sensação de "schema totalmente gerido pela ferramenta" quando, na prática, RLS/extensions/functions/triggers ficariam sistematicamente fora do fluxo — pior que admitir a necessidade de SQL manual desde o início.
```

```text
OPTION:
SQL migrations manuais (100% hand-written, sem drizzle-kit)

COMPATIBLE_WITH_DRIZZLE:
SIM — Drizzle Client não exige nenhuma ferramenta específica de migration; qualquer sequência de arquivos .sql aplicados em ordem é compatível, desde que o schema resultante no banco corresponda ao schema TypeScript declarado para o Drizzle Client.

SUPPORTS_SCHEMA_FROM_SCRATCH:
SIM — nada impede escrever manualmente a migration inicial completa.

SUPPORTS_RAW_SQL:
SIM — é inteiramente SQL cru, por definição.

SUPPORTS_RLS:
SIM — RLS é SQL puro (ENABLE ROW LEVEL SECURITY/CREATE POLICY/etc.), sem nenhuma limitação.

SUPPORTS_POSTGRES_EXTENSIONS:
SIM — CREATE EXTENSION é apenas mais uma instrução SQL.

SUPPORTS_FUNCTIONS_AND_TRIGGERS:
SIM — sem limitação, é SQL/PLpgSQL direto.

CI_COMPATIBILITY:
Forte — mesmo padrão de pasta versionada + tabela de controle de migrations aplicadas, compatível com o mesmo modelo de gating já usado em staging.yml; só exige um runner simples (ex.: um script que aplica arquivos .sql em ordem numérica dentro de uma transação, registrando cada um numa tabela de controle).

SUPABASE_POSTGRES_COMPATIBILITY:
Total — por ser SQL puro, qualquer recurso específico de Postgres/Supabase é suportado sem limitação de DSL.

RISKS:
- Nenhuma verificação automática de que o schema TypeScript usado pelo Drizzle Client em runtime corresponde ao schema real do banco — essa sincronia passa a ser inteiramente manual/disciplinar, sem nenhuma rede de segurança de geração de diff, o que é significativo para 35 domínios/250 endpoints ao longo do tempo.
- Perde-se o benefício mais forte do Drizzle citado no doc45 (tipos inferidos diretamente do schema TypeScript) como fonte confiável de verdade — nada garante que alguém não esqueça de refletir uma alteração de schema manual no lado TypeScript, ou vice-versa.
```

```text
OPTION:
Drizzle Kit + SQL manual controlado (híbrido)

COMPATIBLE_WITH_DRIZZLE:
SIM — é o fluxo oficialmente documentado pelo próprio Drizzle Kit para casos que a DSL de schema não cobre: `drizzle-kit generate` para diffs derivados do schema TypeScript, e `drizzle-kit generate --custom` para criar um arquivo de migration vazio, numerado na mesma sequência, para SQL manual controlado.

SUPPORTS_SCHEMA_FROM_SCRATCH:
SIM — a migration inicial (tabelas, colunas, constraints e índices compostos) é gerada automaticamente a partir do schema TypeScript completo do zero.

SUPPORTS_RAW_SQL:
SIM — via `--custom`, o arquivo gerado é um .sql vazio dentro da mesma pasta/sequência versionada, livre para conter qualquer SQL.

SUPPORTS_RLS:
SIM, de forma explícita e auditável — exatamente o requisito obrigatório deste prompt: cada migration de RLS (ENABLE ROW LEVEL SECURITY / CREATE POLICY / ALTER POLICY / DROP POLICY) é um arquivo próprio, versionado, criado via `--custom`, nunca implícito e nunca inferido de uma abstração de schema.

SUPPORTS_POSTGRES_EXTENSIONS:
SIM — via `--custom` (CREATE EXTENSION é SQL puro dentro do arquivo manual).

SUPPORTS_FUNCTIONS_AND_TRIGGERS:
SIM — via `--custom`, mesma via.

CI_COMPATIBILITY:
Forte — a pasta de migrations resultante (mistura de arquivos gerados automaticamente e arquivos manuais) é uma única sequência de arquivos .sql numerados, aplicável com o mesmo runner/gating já validado em staging.yml (checagem read-only de pendências + aplicação apenas com autorização explícita), sem distinção operacional entre migration "automática" e "manual" no momento de aplicar.

SUPABASE_POSTGRES_COMPATIBILITY:
Total — a parte automática cobre o schema relacional padrão (tabelas/colunas/constraints/índices, incluindo os compostos exigidos pelo doc45); a parte manual cobre exatamente os recursos mais específicos de Postgres/Supabase (RLS, extensions, functions, triggers) sem nenhuma limitação de DSL, sem abrir mão do diff automático para os ~90% do schema que são tabelas/colunas relacionais simples.

RISKS:
- Exige disciplina de revisão para não deixar uma migration `--custom` divergir silenciosamente do schema TypeScript ao longo do tempo (mesmo risco do SQL 100% manual, mas circunscrito apenas às partes que realmente precisam ser manuais — RLS/extensions/functions/triggers — não ao schema relacional inteiro).
- Duas convenções de criação de arquivo coexistindo (`generate` automático vs `generate --custom` manual) exige uma regra clara de quando usar cada uma, documentada nesta decisão (ver abaixo) para não virar decisão ad-hoc por desenvolvedor.
```

---

## Definição

```text
SELECTED_MIGRATION_STRATEGY:
Drizzle Kit + SQL manual controlado (híbrido)

MIGRATION_GENERATION:
HÍBRIDA — schema relacional (tabelas, colunas, tipos, constraints simples/compostas, índices simples/compostos) gerado automaticamente via `drizzle-kit generate` a partir do schema TypeScript (fonte da verdade); RLS (ENABLE ROW LEVEL SECURITY/CREATE POLICY/ALTER POLICY/DROP POLICY), extensions (CREATE EXTENSION) e functions/triggers escritos manualmente via `drizzle-kit generate --custom`, na mesma sequência numerada.

MIGRATION_EXECUTION:
Drizzle Kit (`drizzle-kit migrate`, ou o runner programático equivalente de `drizzle-orm`) aplicando os arquivos .sql da pasta de migrations em ordem, contra a connection string direta/sem pooler (mesma convenção já estabelecida em .env.example — DIRECT_DATABASE_URL — reaplicável ao v2 sem necessidade de reinventar), com uma tabela de controle de migrations aplicadas equivalente em função à `musicos360_migrations` já usada pelo legacy (nome específico da tabela v2 não definido aqui — decisão de nomenclatura de schema, fora de escopo deste prompt).

RLS_IMPLEMENTATION:
Cada mudança de RLS é uma migration própria e explícita, criada via `drizzle-kit generate --custom`, contendo literalmente as instruções SQL (ENABLE ROW LEVEL SECURITY / CREATE POLICY / ALTER POLICY / DROP POLICY) — nunca inferida de decorators/DSL de schema, sempre legível e auditável linha a linha no arquivo versionado, seguindo o requisito obrigatório deste prompt.

RAW_SQL_ALLOWED:
SIM — explicitamente, para os casos cobertos pela via `--custom` (RLS, extensions, functions, triggers); não é a via padrão para o schema relacional simples, que continua gerado automaticamente a partir do TypeScript para preservar a fonte única de verdade tipada já justificada no doc45.

INITIAL_MIGRATION_CONVENTION:
Numeração sequencial de 4 dígitos + slug descritivo em snake_case, ex.: 0001_initial_schema_v2 — convenção explicitamente configurada via a flag `--name` do `drizzle-kit generate` (e do mesmo mecanismo para `--custom`), substituindo o padrão default do drizzle-kit de nomes aleatórios adjetivo-substantivo (observado nos arquivos arquivados de apps/api/drizzle/, ex.: "0000_mixed_jimmy_woo.sql") — inadequado para rastreabilidade num schema com 35 domínios.
```

## Regra futura (registrada, não implementada)

```text
Após uma migration ser aplicada em ambiente compartilhado,
ela não poderá ser alterada retroativamente.

Toda mudança estrutural posterior deverá gerar uma nova migration.
```

---

## Resumo

```text
OPTIONS_EVALUATED:
3

SELECTED_MIGRATION_STRATEGY:
Drizzle Kit + SQL manual controlado (híbrido)

MIGRATION_GENERATION:
HÍBRIDA

MIGRATION_EXECUTION:
Drizzle Kit (drizzle-kit migrate / runner programático drizzle-orm), contra connection string direta sem pooler

RLS_IMPLEMENTATION:
Migrations manuais dedicadas (via --custom), SQL explícito, nunca implícito

RAW_SQL_ALLOWED:
SIM (via --custom, para RLS/extensions/functions/triggers)

INITIAL_MIGRATION_CONVENTION:
NNNN_slug_descritivo (ex.: 0001_initial_schema_v2), nome explícito via --name

UNRESOLVED_MIGRATION_DECISIONS:
0
```

## Cobertura

3 opções avaliadas com os 8 critérios pedidos cada, mais o requisito obrigatório de RLS explicitamente versionada. Nenhuma migration/schema/tabela foi criada. Nenhuma conexão ao banco foi feita. Supabase não foi alterado. Nenhuma dependência foi instalada. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.
