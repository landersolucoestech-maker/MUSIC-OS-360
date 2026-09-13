import { BadRequestException } from '@nestjs/common';
import { ExternalIdentifierService } from './external-identifiers.service';
import { IdentifierType } from '@music-os-360/types';
import type { CreateExternalIdentifierDto } from './dto/external-identifier.dto';

/**
 * find-bb1178da: entityId (route param) had no ownership check against its
 * backing table (works/phonograms/rights_holders/releases/society_submissions)
 * — an external identifier could silently attach to another tenant's entity.
 */
describe('ExternalIdentifierService — cross-tenant FK ownership (find-bb1178da)', () => {
  function makeService(queryImpl: jest.Mock) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'ext-1', ...(v as object) })),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new ExternalIdentifierService(ds as never);
    return { service };
  }

  it('rejects an entityId (work) belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', 'work', 'work-from-tenant-2', {
        provider: 'abramus', identifier_type: IdentifierType.ISRC, identifier_value: 'BRABC2600001',
      } as unknown as CreateExternalIdentifierDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an entityId that belongs to the same tenant', async () => {
    const { service } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', 'work', 'work-1', {
        provider: 'abramus', identifier_type: IdentifierType.ISRC, identifier_value: 'BRABC2600001',
      } as unknown as CreateExternalIdentifierDto),
    ).resolves.toBeDefined();
  });

  it('validates against the correct table for each entity type alias', async () => {
    const query = jest.fn(async (_sql: string, _params: unknown[]) => [{ exists: 1 }]);
    const { service } = makeService(query);
    await service.create('tenant-1', 'user-1', 'recording', 'phono-1', {
      provider: 'abramus', identifier_type: IdentifierType.ISRC, identifier_value: 'BRABC2600001',
    } as unknown as CreateExternalIdentifierDto);
    expect(query.mock.calls[0][0]).toContain('"phonograms"');
  });
});
