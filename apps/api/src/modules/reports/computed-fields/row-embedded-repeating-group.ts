/**
 * Resolver/writer for repeatable groups stored in a JSONB column of the
 * parent record. Each item is flattened into a row of the same XLSX sheet.
 */
import type { DataSource, QueryRunner } from 'typeorm';

export interface RowEmbeddedRepeatingGroupSpec {
  tableName: string;
  jsonColumn: string;
  arrayKey: string | null;
}

export function makeRowEmbeddedRepeatingGroupExportResolver(
  spec: RowEmbeddedRepeatingGroupSpec,
) {
  return async (
    ds: DataSource,
    tenantId: string,
    parentIds: string[],
  ): Promise<Map<string, Record<string, unknown>[]>> => {
    const result = new Map<string, Record<string, unknown>[]>();
    if (parentIds.length === 0) return result;

    const selectExpression = spec.arrayKey
      ? `"${spec.jsonColumn}"->'${spec.arrayKey}'`
      : `"${spec.jsonColumn}"`;
    const rows = (await ds.query(
      `SELECT "id", ${selectExpression} AS items FROM "${spec.tableName}" WHERE "tenant_id" = $1 AND "id" = ANY($2::uuid[])`,
      [tenantId, parentIds],
    )) as Array<{ id: string; items: unknown }>;

    for (const row of rows) {
      result.set(
        row.id,
        Array.isArray(row.items) ? row.items as Record<string, unknown>[] : [],
      );
    }
    return result;
  };
}

export function makeRowEmbeddedRepeatingGroupImportWriter(
  spec: RowEmbeddedRepeatingGroupSpec,
) {
  return async (
    queryRunner: QueryRunner,
    tenantId: string,
    parentId: string,
    items: unknown,
  ): Promise<void> => {
    const list = Array.isArray(items) ? items : [];
    if (spec.arrayKey) {
      await queryRunner.query(
        `UPDATE "${spec.tableName}" SET "${spec.jsonColumn}" = jsonb_set(COALESCE("${spec.jsonColumn}", '{}'::jsonb), '{${spec.arrayKey}}', $1::jsonb) WHERE "id" = $2 AND "tenant_id" = $3`,
        [JSON.stringify(list), parentId, tenantId],
      );
      return;
    }

    await queryRunner.query(
      `UPDATE "${spec.tableName}" SET "${spec.jsonColumn}" = $1::jsonb WHERE "id" = $2 AND "tenant_id" = $3`,
      [JSON.stringify(list), parentId, tenantId],
    );
  };
}
