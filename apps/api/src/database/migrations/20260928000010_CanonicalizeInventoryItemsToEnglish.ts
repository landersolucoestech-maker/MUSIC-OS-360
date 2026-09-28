import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260928000010_CanonicalizeInventoryItemsToEnglish
 *
 * Technical-language mandate (technical = English, UX = PT-BR) for
 * `inventory_items`:
 *
 *   quantidade -> quantity, localizacao -> storage_location,
 *   responsavel -> responsible_person, setor -> sector,
 *   data_entrada -> entry_date, local_compra -> purchase_location
 *   (numero_nota_fiscal keeps its name: "nota fiscal" is a Brazilian fiscal
 *   document without a safe English equivalent — canonical map exception).
 *
 * Persisted status values (PT-BR labels live in the UI):
 *   disponivel -> available, em_uso -> in_use, emprestado -> on_loan,
 *   manutencao -> maintenance, danificado -> damaged, descartado -> discarded,
 *   reservado -> reserved; the column default becomes 'available'.
 *
 * No index, view, function or policy references the renamed columns (checked
 * against a freshly migrated catalog). Every step is guarded, so the migration
 * is idempotent; down() restores the previous names, values and default.
 */
const COLUMNS: ReadonlyArray<[from: string, to: string]> = [
  ['quantidade', 'quantity'],
  ['localizacao', 'storage_location'],
  ['responsavel', 'responsible_person'],
  ['setor', 'sector'],
  ['data_entrada', 'entry_date'],
  ['local_compra', 'purchase_location'],
];

const STATUSES: ReadonlyArray<[legacy: string, canonical: string]> = [
  ['disponivel', 'available'],
  ['em_uso', 'in_use'],
  ['emprestado', 'on_loan'],
  ['manutencao', 'maintenance'],
  ['danificado', 'damaged'],
  ['descartado', 'discarded'],
  ['reservado', 'reserved'],
];

function renameColumn(from: string, to: string): string {
  return `
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = '${from}'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = '${to}'
      ) THEN
        ALTER TABLE "inventory_items" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;`;
}

export class CanonicalizeInventoryItemsToEnglish20260928000010 implements MigrationInterface {
  name = 'CanonicalizeInventoryItemsToEnglish20260928000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const [from, to] of COLUMNS) await queryRunner.query(renameColumn(from, to));
    for (const [legacy, canonical] of STATUSES) {
      await queryRunner.query(`UPDATE "inventory_items" SET "status" = $1 WHERE "status" = $2`, [canonical, legacy]);
    }
    await queryRunner.query(`ALTER TABLE "inventory_items" ALTER COLUMN "status" SET DEFAULT 'available'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inventory_items" ALTER COLUMN "status" SET DEFAULT 'disponivel'`);
    for (const [legacy, canonical] of STATUSES) {
      await queryRunner.query(`UPDATE "inventory_items" SET "status" = $1 WHERE "status" = $2`, [legacy, canonical]);
    }
    for (const [from, to] of [...COLUMNS].reverse()) await queryRunner.query(renameColumn(to, from));
  }
}
