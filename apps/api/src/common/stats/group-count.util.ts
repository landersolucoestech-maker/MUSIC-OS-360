import { SelectQueryBuilder } from 'typeorm';

export interface GroupStatsResult {
  total: number;
  byGroup: Record<string, number>;
  /** Present only when a valueColumn was summed along with the count. */
  sumByGroup?: Record<string, number>;
  totalSum?: number;
}

/**
 * Counts records grouped by a column (e.g. status), optionally
 * summing a numeric column in the same grouping (e.g. valor).
 *
 * Task H: eliminates the "download the whole table and count/sum in the
 * client" pattern — used by every `GET /<resource>/stats` endpoint. `qb` must already
 * come with tenant_id/deleted_at/other filters applied; this function only
 * adds SELECT/GROUP BY and executes.
 */
export async function groupCount<T extends object>(
  qb: SelectQueryBuilder<T>,
  alias: string,
  groupColumn: string,
  valueColumn?: string,
): Promise<GroupStatsResult> {
  qb.select(`${alias}.${groupColumn}`, 'grp').addSelect('COUNT(*)::int', 'cnt');
  if (valueColumn) qb.addSelect(`COALESCE(SUM(${alias}.${valueColumn}::numeric), 0)`, 'sum');
  qb.groupBy(`${alias}.${groupColumn}`);

  const rows = await qb.getRawMany<{ grp: string | null; cnt: string; sum?: string }>();

  const byGroup: Record<string, number> = {};
  const sumByGroup: Record<string, number> = {};
  let total = 0;
  let totalSum = 0;
  for (const r of rows) {
    const key = r.grp ?? '—';
    const cnt = parseInt(r.cnt, 10) || 0;
    byGroup[key] = cnt;
    total += cnt;
    if (valueColumn) {
      const sum = parseFloat(r.sum ?? '0') || 0;
      sumByGroup[key] = sum;
      totalSum += sum;
    }
  }

  return valueColumn
    ? { total, byGroup, sumByGroup, totalSum }
    : { total, byGroup };
}
