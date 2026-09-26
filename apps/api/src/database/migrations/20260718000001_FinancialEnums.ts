import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M1 — financial domain enums (Phase 12 §3).
 *
 * CLOSED sets approved in Phases 11/12 — nothing beyond what was decided:
 * - transaction_status does NOT include separate payment/receipt states
 *   (unified into settled), nor the overdue state (DERIVED: pending with an
 *   expired due_date — never persisted), nor partial settlement (reserved
 *   for wave 2; it will be added via ALTER TYPE when authorized — not
 *   created in advance).
 * - currency is NOT an enum (ISO-4217 char(3) with a format CHECK, see M4).
 */
export class FinancialEnums20260718000001 implements MigrationInterface {
  name = 'FinancialEnums20260718000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "transaction_type" AS ENUM ('revenue', 'expense', 'transfer')
    `);
    await queryRunner.query(`
      CREATE TYPE "transaction_status" AS ENUM ('pending', 'settled', 'cancelled', 'reversed')
    `);
    await queryRunner.query(`
      CREATE TYPE "category_nature" AS ENUM
        ('revenue', 'revenue_deduction', 'direct_cost', 'operating_expense', 'non_operational')
    `);
    await queryRunner.query(`
      CREATE TYPE "allocation_dimension" AS ENUM ('project', 'artist', 'phonogram', 'release')
    `);
    await queryRunner.query(`
      CREATE TYPE "account_type" AS ENUM
        ('bank', 'cash', 'digital_wallet', 'payment_provider', 'aggregator')
    `);
    await queryRunner.query(`
      CREATE TYPE "counterparty_type" AS ENUM
        ('client', 'supplier', 'artist', 'producer', 'publisher', 'distributor',
         'aggregator', 'employee', 'collecting_agency', 'other')
    `);
    await queryRunner.query(`
      CREATE TYPE "installment_interval" AS ENUM
        ('weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')
    `);
    await queryRunner.query(`
      CREATE TYPE "performance_metric_type" AS ENUM
        ('streams', 'plays', 'views', 'downloads', 'saves', 'listeners',
         'playlist_additions', 'watch_time', 'impressions', 'reach',
         'followers', 'subscribers', 'monthly_listeners')
    `);
    await queryRunner.query(`
      CREATE TYPE "metric_source" AS ENUM ('manual', 'import', 'api')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Enums can only be dropped after ALL the columns that use them (M2–M8 down).
    await queryRunner.query(`DROP TYPE "metric_source"`);
    await queryRunner.query(`DROP TYPE "performance_metric_type"`);
    await queryRunner.query(`DROP TYPE "installment_interval"`);
    await queryRunner.query(`DROP TYPE "counterparty_type"`);
    await queryRunner.query(`DROP TYPE "account_type"`);
    await queryRunner.query(`DROP TYPE "allocation_dimension"`);
    await queryRunner.query(`DROP TYPE "category_nature"`);
    await queryRunner.query(`DROP TYPE "transaction_status"`);
    await queryRunner.query(`DROP TYPE "transaction_type"`);
  }
}
