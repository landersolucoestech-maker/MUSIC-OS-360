import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ShareStatus } from '@music-os-360/types';
import { SharesService } from './shares.service';
import { CreateShareDto, QueryShareDto } from './dto/shares.dto';
import {
  SHARE_DEPRECATED_FIELDS,
  SHARE_HISTORY_ENTRY_DEPRECATED_FIELDS,
  SHARE_QUERY_DEPRECATED_FIELDS,
  canonicalizeShareHistory,
  canonicalizeShareValues,
} from './share-legacy-fields';
import { applyDeprecatedFieldAliases } from '../../common/compat/deprecated-field-aliases.util';

/**
 * CZ-037: share fields and values are English. LEGACY_WEB_SHARE is the payload a
 * pre-CZ-037 web build sends (Portuguese names and values, artist mirrored in
 * artista_project_id); it must validate and persist with canonical columns and
 * values only. Before CZ-037 every financial share save failed because the web
 * statuses (pendente, enviado, ...) were rejected by chk_shares_status.
 */
const errorsFor = (dto: new () => object, plain: Record<string, unknown>) =>
  validateSync(plainToInstance(dto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

const ARTIST = '11111111-1111-4111-8111-111111111111';

const LEGACY_WEB_SHARE = {
  share_type: 'external_receivable',
  music_title: 'Canção',
  artista_externo: 'Banda X',
  artista_project_id: ARTIST,
  artist_id: ARTIST,
  pagador: 'Gravadora Y',
  pagador_contato: 'contato@y.com',
  origem_acordo: 'Contrato 2025',
  data_prevista: '2026-10-01',
  acordo_notas: 'Notas',
  acordo_url: 'https://example.com/acordo.pdf',
  versao: 2,
  historico: [{ versao: 1, data: '2026-09-01', percentage: 10, autor: 'Sistema', descricao: 'Registro inicial' }],
  percentage: 10,
  status: 'enviado',
  direction: 'a_receber',
  type: 'interprete',
};

function makeService() {
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: unknown) => ({ id: 'share-1', ...(v as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, jest.Mock> = {};
      qb['where'] = jest.fn(() => qb);
      qb['getOne'] = jest.fn(async () => ({ id: 'share-1', tenant_id: 'tenant-1', work_id: null, phonogram_id: null }));
      return qb;
    }),
  };
  const manager = { getRepository: jest.fn(() => repo), query: jest.fn().mockResolvedValue([]) };
  const ds = {
    getRepository: jest.fn(() => repo),
    transaction: jest.fn(async (cb: (m: unknown) => unknown) => cb(manager)),
  };
  return { service: new SharesService(ds as never), repo };
}

describe('Share request contract (CZ-037)', () => {
  it('the pre-CZ-037 web payload validates', () => {
    expect(errorsFor(CreateShareDto, LEGACY_WEB_SHARE)).toEqual([]);
  });

  it('rejects a status outside the canonical and legacy vocabularies', () => {
    expect(errorsFor(CreateShareDto, { status: 'whatever' })).toContain('status');
    expect(errorsFor(CreateShareDto, { direction: 'sideways' })).toContain('direction');
  });

  it('accepts every canonical status and both directions', () => {
    for (const status of Object.values(ShareStatus)) expect(errorsFor(CreateShareDto, { status })).toEqual([]);
    for (const direction of ['receivable', 'payable']) expect(errorsFor(QueryShareDto, { direction })).toEqual([]);
  });

  it('persists the pre-CZ-037 payload with canonical columns and values only', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', LEGACY_WEB_SHARE as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      external_artist_name: 'Banda X', artist_id: ARTIST, payer: 'Gravadora Y', payer_contact: 'contato@y.com',
      agreement_source: 'Contrato 2025', expected_at: '2026-10-01', agreement_notes: 'Notas',
      agreement_url: 'https://example.com/acordo.pdf', version: 2,
      history: [{ version: 1, date: '2026-09-01', percentage: 10, author: 'Sistema', description: 'Registro inicial' }],
      status: ShareStatus.SENT, direction: 'receivable', type: 'performer',
    });
    for (const legacy of Object.keys(SHARE_DEPRECATED_FIELDS)) expect(row).not.toHaveProperty(legacy);
    expect(row).not.toHaveProperty('legacy_artist_project_id');
  });

  it('the canonical field wins over its deprecated alias', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', { payer: 'Novo', pagador: 'Antigo', status: 'pending' } as never);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ payer: 'Novo', status: 'pending' });
  });

  it('an edit from a pre-CZ-037 build never wipes canonical values with the blanks it read (deploy skew)', async () => {
    // The old edit form reads the English response as blanks and sends them
    // back as nulls under the Portuguese names.
    const { service, repo } = makeService();
    await service.update('tenant-1', 'share-1', {
      status: 'recebido', pagador: null, artista_externo: null, acordo_notas: null, data_prevista: null, origem_acordo: null,
      settled_amount: 800,
    } as never);
    const written = (repo.update.mock.calls as unknown as unknown[][])[0][1] as Record<string, unknown>;
    expect(written).toMatchObject({ status: ShareStatus.RECEIVED, settled_amount: 800 });
    for (const canonical of ['payer', 'external_artist_name', 'agreement_notes', 'expected_at', 'agreement_source']) {
      expect(written).not.toHaveProperty(canonical);
    }
  });

  it('maps residual legacy directions and party roles (entrada/saida/a_pagar, outro)', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', { direction: 'entrada', party_role: 'outro', holderName: 'X' } as never);
    expect(repo.create.mock.calls[0][0]).toMatchObject({ direction: 'receivable', party_role: 'other' });
    for (const direction of ['saida', 'a_pagar']) expect(errorsFor(QueryShareDto, { direction })).toEqual([]);
  });
});

// ─── Exhaustive pins of every legacy name of share-legacy-fields.ts (explicit static tables, not derived from the module) ───
type Row2 = ReadonlyArray<readonly [string, string]>;
type Row3 = ReadonlyArray<readonly [string, string, string]>;
const X_SHARE_FIELDS: Row2 = [
  ['artista_externo', 'external_artist_name'],
  ['artista_project_id', 'artist_id'],
  ['pagador', 'payer'],
  ['pagador_contato', 'payer_contact'],
  ['origem_acordo', 'agreement_source'],
  ['data_prevista', 'expected_at'],
  ['acordo_notas', 'agreement_notes'],
  ['acordo_url', 'agreement_url'],
  ['versao', 'version'],
  ['historico', 'history'],
];

const X_SHARE_QUERY_FIELDS: Row2 = [
  ['workId', 'work_id'],
  ['trackId', 'phonogram_id'],
  ['role', 'party_role'],
];

const X_SHARE_HISTORY_KEYS: Row2 = [
  ['versao', 'version'],
  ['data', 'date'],
  ['autor', 'author'],
  ['descricao', 'description'],
  ['acao', 'action'],
  ['usuario', 'user'],
  ['observacao', 'note'],
  ['valor_anterior', 'previous_value'],
  ['valor_novo', 'new_value'],
];

/** [column, legacy value, canonical value] */
const X_SHARE_VALUES: Row3 = [
  ['status', 'ativo', 'active'],
  ['status', 'inativo', 'inactive'],
  ['status', 'pendente', 'pending'],
  ['status', 'liquidado', 'settled'],
  ['status', 'parcial', 'partial'],
  ['status', 'enviado', 'sent'],
  ['status', 'aceito', 'accepted'],
  ['status', 'recebido', 'received'],
  ['status', 'recusado', 'refused'],
  ['status', 'erro', 'error'],
  ['status', 'cancelado', 'cancelled'],
  ['direction', 'a_receber', 'receivable'],
  ['direction', 'a_enviar', 'payable'],
  ['direction', 'entrada', 'receivable'],
  ['direction', 'saida', 'payable'],
  ['direction', 'a_pagar', 'payable'],
  ['type', 'compositor', 'composer'],
  ['type', 'interprete', 'performer'],
  ['type', 'produtor', 'producer'],
  ['type', 'editora', 'publisher'],
  ['type', 'gravadora', 'record_label'],
  ['type', 'empresario', 'manager'],
  ['type', 'outro', 'other'],
  ['party_role', 'autor', 'author'],
  ['party_role', 'compositor', 'composer'],
  ['party_role', 'interprete', 'performer'],
  ['party_role', 'produtor', 'producer'],
  ['party_role', 'editora', 'publisher'],
  ['party_role', 'outro', 'other'],
];

describe('share legacy names: every deprecated field, query key, history key and value, one by one', () => {
  it('the exported alias tables declare exactly the expected pairs', () => {
    expect({ ...SHARE_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_SHARE_FIELDS));
    expect({ ...SHARE_QUERY_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_SHARE_QUERY_FIELDS));
    expect({ ...SHARE_HISTORY_ENTRY_DEPRECATED_FIELDS }).toEqual(Object.fromEntries(X_SHARE_HISTORY_KEYS));
  });

  describe.each([
    ['request field', SHARE_DEPRECATED_FIELDS, X_SHARE_FIELDS],
    ['query key', SHARE_QUERY_DEPRECATED_FIELDS, X_SHARE_QUERY_FIELDS],
  ] as const)('%s', (_n, table, rows) => {
    it.each(rows)('%s -> %s: legacy-only moves, the CANONICAL value wins when both are sent', (legacy, canonical) => {
      expect(applyDeprecatedFieldAliases({ [legacy]: 'legacy-value' }, table)).toEqual({ [canonical]: 'legacy-value' });
      expect(applyDeprecatedFieldAliases({ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }, table)).toEqual({ [canonical]: 'canonical-value' });
    });
  });

  it.each(X_SHARE_HISTORY_KEYS)('history entry key %s -> %s: legacy-only moves, canonical wins when both are present', (legacy, canonical) => {
    expect(canonicalizeShareHistory([{ [legacy]: 'legacy-value' }])).toEqual([{ [canonical]: 'legacy-value' }]);
    expect(canonicalizeShareHistory([{ [legacy]: 'legacy-value', [canonical]: 'canonical-value' }])).toEqual([{ [canonical]: 'canonical-value' }]);
  });

  it('history: percentual of an old entry is historical data and is NOT remapped; non-array and non-object entries pass through', () => {
    expect(canonicalizeShareHistory([{ percentual: 5 }, 'x', null])).toEqual([{ percentual: 5 }, 'x', null]);
    expect(canonicalizeShareHistory('x')).toBe('x');
  });

  it.each(X_SHARE_VALUES)('column %s: legacy value %s -> %s; the canonical value is unchanged', (column, legacy, canonical) => {
    expect(canonicalizeShareValues({ [column]: legacy })).toEqual({ [column]: canonical });
    expect(canonicalizeShareValues({ [column]: canonical })).toEqual({ [column]: canonical });
  });

  it('a legacy value of one column is not translated under another column; unknown text is kept', () => {
    expect(canonicalizeShareValues({ direction: 'ativo' })).toEqual({ direction: 'ativo' });
    expect(canonicalizeShareValues({ status: 'custom' })).toEqual({ status: 'custom' });
  });
});
