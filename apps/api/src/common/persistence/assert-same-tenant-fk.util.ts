import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * contracts/licensing/takedowns/shares.create() all accepted a FK id
 * (artist_id/client_id/work_id/phonogram_id) straight from the request
 * DTO and persisted it with no check that the referenced row belongs to
 * the SAME tenant. No read-side leak resulted (every list/get query still
 * filters by the entity's own tenant_id), but a tenant could create a
 * license/takedown/contract/share dangling-referencing another tenant's
 * artist/work/client — corrupting downstream joins/reports, and acting as
 * a weak cross-tenant UUID-existence oracle.
 *
 * `table` is always a static, code-controlled string from call sites in
 * this codebase — never derived from request input — so interpolating it
 * into the query is safe (same trust boundary as import-commit.service.ts's
 * quote(def.tableName)).
 */
export async function assertSameTenantFk(
  ds: DataSource,
  table: string,
  id: string | null | undefined,
  tenantId: string,
  label: string,
): Promise<void> {
  if (!id) return;
  const rows = await ds.query(
    `SELECT 1 FROM "${table}" WHERE "id" = $1 AND "tenant_id" = $2 LIMIT 1`,
    [id, tenantId],
  ) as unknown[];
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new BadRequestException(`${label} não encontrado(a) neste workspace.`);
  }
}
