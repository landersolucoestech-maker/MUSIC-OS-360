import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import type { OrgMemberEntity } from '../../database/entities';

/**
 * Conversation assignees and MusicChat notification recipients are org members
 * (`org_members.auth_user_id`). A user id from another tenant, a removed or
 * inactive member, or free text is rejected before it is persisted — it would
 * route conversations and notifications to nobody (or to someone outside the
 * tenant).
 */
export async function assertActiveTenantMembers(
  repo: Pick<Repository<OrgMemberEntity>, 'createQueryBuilder'>,
  tenantId: string,
  userIds: ReadonlyArray<string | null | undefined>,
): Promise<void> {
  const wanted = [...new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))];
  if (wanted.length === 0) return;
  const rows: Array<{ auth_user_id: string }> = await repo
    .createQueryBuilder('m')
    .select('m.auth_user_id', 'auth_user_id')
    .where('m.tenant_id = :tenantId', { tenantId })
    .andWhere('m.auth_user_id IN (:...wanted)', { wanted })
    .andWhere('m.is_active = true')
    .andWhere('m.deleted_at IS NULL')
    .getRawMany();
  const found = new Set(rows.map((row) => row.auth_user_id));
  if (wanted.some((id) => !found.has(id))) {
    throw new BadRequestException('Responsável não encontrado entre os membros ativos desta organização.');
  }
}
