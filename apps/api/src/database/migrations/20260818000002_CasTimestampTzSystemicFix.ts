import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Systemic fix of the same bug class solved for `artists` in
 * `ArtistsTimestampTzFix20260818000001`: any table whose service uses
 * `casUpdate`/`buildExpectedUpdatedAtCriterion` (common/persistence/optimistic-update.util.ts)
 * needs `updated_at` to be `timestamptz` — the comparison `date_trunc(...) =
 * date_trunc(... ::timestamptz)` casts implicitly using the Postgres SESSION
 * TimeZone (UTC), while a naive `timestamp` column is read
 * back by the `pg` driver using the Node process's LOCAL time zone. Reproduced
 * live in this fix (not just inherited from the artists fix) against real rows
 * in `works` and `clients`: an idempotent PATCH, resending exactly the
 * `updated_at` the API itself had just returned, fails the comparison and
 * would return 409 — without any real concurrent edit.
 *
 * List obtained by grepping every caller of `casUpdate`/
 * `buildExpectedUpdatedAtCriterion` in apps/api/src/modules/**\/*.service.ts,
 * cross-checked against the column's REAL physical type queried via
 * information_schema.columns on the DEV Postgres (not only the TypeORM
 * declaration in entities.ts — a registered migration does not imply an applied
 * migration; see the note on `ArtistsTimestampTzFix20260818000001` below).
 * Tables with CAS that were already `timestamptz` (financial_categories,
 * financial_rules, finance_category_keyword_rules, licenses, forms,
 * inventory_items, conversations, marketing_*, audiovisual_*) are not included
 * here — nothing to fix.
 *
 * `org_members` is on this list because `UsersService.update/updateRole/
 * updateStatus` (modules/users/users.service.ts) uses `casUpdate` over
 * `OrgMemberEntity`, not over `UserEntity` (which is already timestamptz) — a finding
 * of this audit, not in the original report's scope.
 *
 * Interpretation of the historical time zone (Task 3 of this fix — do not blindly
 * copy `AT TIME ZONE 'UTC'` without proving it is the correct interpretation):
 * tested live in this session that the `pg` driver, when serializing a Node `Date`
 * into a `timestamp` (tz-less) column, writes the raw digits using the
 * LOCAL time zone of the PROCESS that did the INSERT/UPDATE — not UTC (proof: an INSERT
 * of `new Date()` into a temp table with `timestamp` and `timestamptz` columns
 * side by side wrote "14:45:59" in the naive one and "17:45:59Z" in the tz one, process in
 * America/Sao_Paulo). This means the real provenance of the historical digits
 * depends on the time zone of the PROCESS that wrote them — which may have
 * been a production/staging deploy (typically UTC) OR a local developer
 * machine (e.g. America/Sao_Paulo, as proven here) —
 * undeterminable and probably mixed across old rows, exactly the
 * ambiguity the original comment of the artists fix already identified
 * as "risky to infer per environment/deploy". Given this genuine and proven
 * (not presumed) ambiguity, `AT TIME ZONE 'UTC'` remains the
 * most conservative choice: it shifts no already written digit (it is a
 * non-destructive reinterpretation, mathematically idempotent when the Postgres session
 * is already in UTC — confirmed: `SHOW TIMEZONE` = UTC in this
 * environment), as opposed to assuming a single source time zone (e.g.
 * America/Sao_Paulo) for ALL historical rows, which would incorrectly
 * shift any row actually written by a
 * process in UTC. Keeps consistency with the precedent already applied to
 * `artists`.
 *
 * NOTE — state of the migration runner found during this fix:
 * `ArtistsTimestampTzFix20260818000001` is REGISTERED in the code and the real
 * DEV Postgres schema already reflects its result (`artists.updated_at` is already
 * `timestamptz`), but the migration was NOT marked as applied in
 * `musicos360_migrations` — it was applied manually (direct SQL, as the
 * migration file's own "Proven with direct SQL" comment says)
 * without going through the tracked runner, probably because `db:migrate`
 * (plain TypeORM) stops at the first pending migration in order — which is
 * `RealtimeBroadcastAuthorization20260801000001`, classified
 * EXTERNAL_MANAGED in migration-classification.ts (Supabase's `realtime` schema,
 * outside the control of the application's connection role). This fix
 * reconciles that by really running `ArtistsTimestampTzFix20260818000001`
 * via `npm run db:migrate:application` (which skips EXTERNAL_MANAGED without aborting
 * the queue) — reapplying `ALTER COLUMN ... USING ... AT TIME ZONE 'UTC'` to a
 * column that is already timestamptz with a UTC session is mathematically idempotent
 * (verified before running), so the re-execution is safe and the tracking
 * reflects reality, without artificially marking anything as applied.
 */
export class CasTimestampTzSystemicFix20260818000002 implements MigrationInterface {
  name = 'CasTimestampTzSystemicFix20260818000002';

  private readonly tables: readonly string[] = [
    'org_members',
    'works',
    'phonograms',
    'contracts',
    'contract_templates',
    'transactions',
    'invoices',
    'clients',
    'leads',
    'campaigns',
    'events',
    'projects',
    'releases',
    'shares',
    'takedowns',
    'support_tickets',
    'content_detections',
    'ecad_reports',
    'employees',
    'rights_holders',
    'external_identifiers',
    'society_accounts',
    'society_submissions',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.tables) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
          ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC'
      `);
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "created_at" SET DEFAULT now()`);
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "updated_at" SET DEFAULT now()`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of [...this.tables].reverse()) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ALTER COLUMN "created_at" TYPE timestamp USING "created_at" AT TIME ZONE 'UTC',
          ALTER COLUMN "updated_at" TYPE timestamp USING "updated_at" AT TIME ZONE 'UTC'
      `);
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "created_at" SET DEFAULT now()`);
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "updated_at" SET DEFAULT now()`);
    }
  }
}
