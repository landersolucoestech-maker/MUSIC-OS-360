-- Primitive benchmark behind docs/engineering/destructive-approval-dossier.md (lock estimate inputs).
-- Run ONLY against a disposable local database:
--   psql -h 127.0.0.1 -p <port> -U postgres -d <disposable> -v n=1000000 -f scripts/legacy-drop-primitive-benchmark.sql
-- It creates and drops its own synthetic tables t and t_arch; it touches no application table.
\set ON_ERROR_STOP on
\timing on
do $$ begin if current_database() !~ (chr(100)||chr(105)||chr(115)||chr(112)||chr(111)||chr(115)||chr(97)||chr(98)||chr(108)||chr(101)||chr(124)||chr(98)||chr(101)||chr(110)||chr(99)||chr(104)||chr(124)||chr(114)||chr(101)||chr(104)||chr(101)||chr(97)||chr(114)||chr(115)||chr(97)||chr(108)||chr(124)||chr(109)||chr(117)||chr(115)||chr(105)||chr(99)||chr(95)||chr(111)||chr(115)||chr(95)||chr(100)||chr(114)||chr(111)||chr(112)||chr(115)) then raise exception $m$refusing to run: database % is not a disposable benchmark database$m$, current_database(); end if; end $$;
drop table if exists t, t_arch;
create table t(id uuid primary key default gen_random_uuid(), tenant_id uuid not null, legacy_a text, legacy_b jsonb, legacy_c uuid, canonical_a text, filler text);
insert into t(tenant_id, legacy_a, legacy_b, legacy_c, canonical_a, filler) select gen_random_uuid(), 'v'||g, '{"k":1}'::jsonb, gen_random_uuid(), 'v'||g, repeat('x',120) from generate_series(1,:n) g;
analyze t;
select 'table_size_mb', pg_total_relation_size('t')/1024/1024;
-- precondition scan over every row
select count(*) from t where legacy_a is not null or legacy_b is not null or legacy_c is not null;
-- archive insert of the rows holding legacy values (the draft inserts into a PK table: this CTAS is a lower bound)
create table t_arch as select id, legacy_a, legacy_b, legacy_c from t where legacy_a is not null or legacy_b is not null or legacy_c is not null;
-- the draft's two verification queries (NOT EXISTS coverage and archive-to-live stale join)
select count(*) from t where (legacy_a is not null or legacy_b is not null or legacy_c is not null) and not exists (select 1 from t_arch a where a.id = t.id and a.legacy_a is not distinct from t.legacy_a and a.legacy_b is not distinct from t.legacy_b and a.legacy_c is not distinct from t.legacy_c);
select count(*) from t_arch a join t on t.id = a.id where not (a.legacy_a is not distinct from t.legacy_a and a.legacy_b is not distinct from t.legacy_b and a.legacy_c is not distinct from t.legacy_c);
-- the drop (catalog change) under the draft's lock
begin; set local lock_timeout = '15s'; lock table t in share row exclusive mode; alter table t drop column legacy_a, drop column legacy_b, drop column legacy_c; commit;
-- down(): re-add and restore by id
begin; alter table t add column legacy_a text, add column legacy_b jsonb, add column legacy_c uuid; update t set legacy_a=a.legacy_a, legacy_b=a.legacy_b, legacy_c=a.legacy_c from t_arch a where a.id=t.id; commit;
drop table t, t_arch;
