import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000017_CanonicalizeResidualShareValues
 *
 * Follow-up to 20260928000015 (CZ-037 independent review, finding L2): the
 * pre-CZ-037 web type also declared the direction values entrada / saida /
 * a_pagar, and `party_role` accepted `outro`. `direction` and `party_role`
 * have no CHECK, so rows holding them would survive unmapped and be invisible
 * to the receivable/payable KPIs and filters.
 *   direction: entrada -> receivable, saida -> payable, a_pagar -> payable
 *   party_role: outro -> other
 * down() only reverses the value that maps one-to-one (outro); the direction
 * values collapse onto receivable/payable, whose origin is not recorded.
 */
const FORWARD: ReadonlyArray<[column: string, legacy: string, canonical: string]> = [
  ['direction', 'entrada', 'receivable'],
  ['direction', 'saida', 'payable'],
  ['direction', 'a_pagar', 'payable'],
  ['party_role', 'outro', 'other'],
];

export class CanonicalizeResidualShareValues20260928000017 implements MigrationInterface {
  name = 'CanonicalizeResidualShareValues20260928000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [column, legacy, canonical] of FORWARD) {
      await queryRunner.query(`UPDATE "shares" SET "${column}" = $1 WHERE "${column}" = $2`, [canonical, legacy]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "shares" SET "party_role" = 'outro' WHERE "party_role" = 'other'`);
  }
}
