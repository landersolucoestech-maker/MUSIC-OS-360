/**
 * Distributor id `outros` -> `other` (MUSIC-OS-360 BUG1). The id is persisted inside the artists jsonb columns
 * general_distributors[].id and the `distributors` list of relationships / linked_contacts / team_contacts items.
 * Old web builds still send `outros`: it is accepted and stored as `other` (exact match; backfill 20260930000027).
 */
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateArtistDto } from './dto/create-artist.dto';
import { UpdateArtistDto } from './dto/update-artist.dto';
import { canonicalArtistNestedColumn, canonicalDistributorId, canonicalizeArtistInput } from './artist-legacy-fields';

describe('canonicalDistributorId', () => {
  it('maps the exact legacy id only', () => {
    expect(canonicalDistributorId('outros')).toBe('other');
    expect(canonicalDistributorId('other')).toBe('other');
    expect(canonicalDistributorId('onerpm')).toBe('onerpm');
    expect(canonicalDistributorId('Outros')).toBe('Outros');
    expect(canonicalDistributorId(undefined)).toBeUndefined();
  });
});

describe('canonicalArtistNestedColumn — distributor ids', () => {
  it('rewrites general_distributors[].id and keeps the other fields', () => {
    expect(canonicalArtistNestedColumn('general_distributors', [
      { id: 'outros', email: 'a@x.com', customName: 'Minha Distro' }, { id: 'onerpm', email: '' },
    ])).toEqual([{ id: 'other', email: 'a@x.com', customName: 'Minha Distro' }, { id: 'onerpm', email: '' }]);
  });

  it.each(['relationships', 'linked_contacts', 'team_contacts'])('rewrites %s[].distributors[].id', (column) => {
    expect(canonicalArtistNestedColumn(column, [{ name: 'X', distributors: [{ id: 'outros', email: '' }] }, { name: 'Y' }]))
      .toEqual([{ name: 'X', distributors: [{ id: 'other', email: '' }] }, { name: 'Y' }]);
  });

  it('also handles the pre-CZ-042 nested key `distribuidoras`', () => {
    expect(canonicalArtistNestedColumn('team_contacts', [{ nome: 'Eva', distribuidoras: [{ id: 'outros', nomeCustom: 'Z' }] }]))
      .toEqual([{ name: 'Eva', distributors: [{ id: 'other', customName: 'Z' }] }]);
  });

  it('does not touch other columns or non-array values', () => {
    expect(canonicalArtistNestedColumn('documents', [{ id: 'outros' }])).toEqual([{ id: 'outros' }]);
    expect(canonicalArtistNestedColumn('general_distributors', null)).toBeNull();
  });

  it('canonicalizeArtistInput applies it to the request body (deprecated column name included)', () => {
    const out = canonicalizeArtistInput({ distribuidoras_gerais: [{ id: 'outros', email: '' }] } as Record<string, unknown>);
    expect(out.general_distributors).toEqual([{ id: 'other', email: '' }]);
  });
});

describe('Create/UpdateArtistDto — Transform before validation', () => {
  const body = {
    stage_name: 'A',
    general_distributors: [{ id: 'outros', email: '' }],
    team_contacts: [{ name: 'Eva', distributors: [{ id: 'outros', email: '' }] }],
    linked_contacts: [{ contactId: 'c1', distributors: [{ id: 'outros', email: '' }] }],
    relationships: [{ type: 'agent', distributors: [{ id: 'outros', email: '' }] }],
  };

  it.each([['create', CreateArtistDto], ['update', UpdateArtistDto]] as const)('%s accepts both and emits other', async (_n, Dto) => {
    const legacy = plainToInstance(Dto, body);
    expect(await validate(legacy)).toEqual([]);
    expect(legacy.general_distributors).toEqual([{ id: 'other', email: '' }]);
    expect((legacy.team_contacts as Array<{ distributors: unknown[] }>)[0].distributors).toEqual([{ id: 'other', email: '' }]);
    expect((legacy.linked_contacts as Array<{ distributors: unknown[] }>)[0].distributors).toEqual([{ id: 'other', email: '' }]);
    expect((legacy.relationships as Array<{ distributors: unknown[] }>)[0].distributors).toEqual([{ id: 'other', email: '' }]);

    const canonical = plainToInstance(Dto, { stage_name: 'A', general_distributors: [{ id: 'other', email: '' }] });
    expect(await validate(canonical)).toEqual([]);
    expect(canonical.general_distributors).toEqual([{ id: 'other', email: '' }]);
  });
});
