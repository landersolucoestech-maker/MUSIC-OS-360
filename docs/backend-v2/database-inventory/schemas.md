> Historical record. Kept as recorded; not the current contract.

# Schemas — Inventário Completo

Fonte: MUSIC OS 360 / DEV / rypnevnfipygyhysqpdo (leitura, PostgreSQL 17). Gerado programaticamente a partir de introspecção real via information_schema/pg_catalog.

Total de schemas reais (excluindo pg_temp_N/pg_toast_temp_N efêmeros de sessão, que não são estruturas persistentes do projeto): 10

| SCHEMA | CLASSIFICATION | TABLE_COUNT |
|---|---|---|
| auth | SUPABASE_MANAGED | 23 |
| extensions | SUPABASE_MANAGED | 2 |
| graphql | SUPABASE_MANAGED | 0 |
| graphql_public | SUPABASE_MANAGED | 0 |
| pgbouncer | SUPABASE_MANAGED | 0 |
| public | LEGACY_APPLICATION | 142 |
| realtime | SUPABASE_MANAGED | 9 |
| storage | SUPABASE_MANAGED | 8 |
| supabase_migrations | SUPABASE_MANAGED | 1 |
| vault | SUPABASE_MANAGED | 2 |

## Schemas de sistema excluídos do inventário detalhado

119 schemas: pg_catalog, information_schema, 58 pg_temp_N (efêmeros, 1 por sessão de conexão), 59 pg_toast/pg_toast_temp_N (armazenamento TOAST interno). Nenhum contém estrutura de negócio ou específica deste projeto — pg_catalog/information_schema são o catálogo padrão do PostgreSQL 17 (idêntico em qualquer instância), e pg_temp_N/pg_toast_temp_N são artefatos de sessão que não persistem. Classificados como SYSTEM, não enumerados coluna a coluna.
