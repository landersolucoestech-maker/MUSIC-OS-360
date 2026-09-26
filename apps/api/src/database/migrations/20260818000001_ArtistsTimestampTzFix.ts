import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ROOT CAUSE of the spurious 409 when editing an Artist (reproduced: the `expectedUpdatedAt`
 * sent by the frontend was byte-identical to the `updated_at` returned by the API —
 * and still `casUpdate` rejected with 0 affected rows).
 *
 * `artists.updated_at`/`created_at` were `timestamp` (WITHOUT time zone) — the only
 * such column pair in this table among ~80 other project entities,
 * which correctly use `timestamptz`. A naive `timestamp` column is
 * ambiguous: the `pg`/TypeORM driver, when READING the value back for the API,
 * interprets the raw digits using the Node process's LOCAL time zone (e.g.
 * America/Sao_Paulo, UTC-3) — but `casUpdate`
 * (common/persistence/optimistic-update.util.ts) compares via SQL using an
 * implicit `timestamp -> timestamptz` cast that uses the Postgres SESSION TimeZone
 * (UTC). The two interpretations diverge by exactly the Node process's offset
 * (3h in this environment) — every artist CAS was
 * mathematically doomed to never match, even without any real concurrent
 * edit. Proven with direct SQL:
 *   date_trunc('milliseconds', updated_at) = date_trunc('milliseconds', $1::timestamptz)
 *   -> false, with $1 being the EXACT value returned by the API seconds earlier.
 *
 * `timestamptz` stores an unambiguous instant — it eliminates this bug class
 * for good, in any process/session time zone, always.
 *
 * `AT TIME ZONE 'UTC'` in USING is a non-destructive conversion: it preserves the
 * raw digits already written as the same UTC instant (without trying to "guess"
 * retroactively which process time zone wrote each historical row —
 * that is ambiguous and risky to infer per environment/deploy). Scope
 * deliberately restricted to `artists` (the table of the reported bug); the
 * other ~39 project entities with the same tz-less `timestamp` pattern
 * stay out of this migration.
 */
export class ArtistsTimestampTzFix20260818000001 implements MigrationInterface {
  name = 'ArtistsTimestampTzFix20260818000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artists"
        ALTER COLUMN "created_at" TYPE timestamptz USING "created_at" AT TIME ZONE 'UTC',
        ALTER COLUMN "updated_at" TYPE timestamptz USING "updated_at" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "created_at" SET DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "updated_at" SET DEFAULT now()`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "artists"
        ALTER COLUMN "created_at" TYPE timestamp USING "created_at" AT TIME ZONE 'UTC',
        ALTER COLUMN "updated_at" TYPE timestamp USING "updated_at" AT TIME ZONE 'UTC'
    `);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "created_at" SET DEFAULT now()`);
    await queryRunner.query(`ALTER TABLE "artists" ALTER COLUMN "updated_at" SET DEFAULT now()`);
  }
}
