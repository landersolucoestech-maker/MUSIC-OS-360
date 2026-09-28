import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/leads.dto';
import { canonicalCrmInternalData, canonicalServicePayload, LEAD_SERVICE_TYPES, LEGACY_LEAD_SERVICE_TYPES } from './lead-vocabulary';

/**
 * CZ-033: the lead contract is English. LEGACY_WEB_LEAD is the payload a
 * pre-CZ-033 web build really sends (LeadsPage payloadToLead + toApiPayload);
 * it must still validate and must be persisted with canonical columns, keys
 * and values only. Responses carry the canonical fields only.
 */
const LEGACY_WEB_LEAD = {
  name: 'Fulano de Tal',
  nomeArtistico: 'MC Fulano',
  empresa: 'Fulano Produções',
  email: 'fulano@example.test',
  phone: '+5511999990000',
  whatsapp: '+5511999990000',
  city: 'São Paulo',
  state: 'SP',
  country: 'BR',
  clientType: 'artist',
  serviceType: 'producaoMusical',
  payloadServico: {
    tipo_lead: 'artista_banda',
    servico: 'producao_musical',
    descricao: 'Single de estreia',
    data_entrada: '2026-09-01',
    responsavel: 'Ana',
    nome_evento: 'Festa',
    tipo_evento: 'casamento',
    interacoes: [{ id: 'i1', type: 'ligacao', data: '2026-09-02', horario: '10:00', descricao: 'Primeiro contato' }],
  },
  dadosInternosCRM: {
    statusLead: 'new',
    prioridade: 'alta',
    origemLead: 'indicacao',
    responsavel: 'Ana',
    campanha_marketing: 'Verão',
    proximoFollowUp: '2026-09-10',
    valorEstimado: 5000,
    temperatura: 'quente',
  },
  uploads: [],
};

const errorsFor = (plain: Record<string, unknown>) =>
  validateSync(plainToInstance(CreateLeadDto, plain, { enableImplicitConversion: true }), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).map((e) => e.property);

function makeService() {
  const repo = {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'lead-1', status: 'new', ...(entity as object) })),
  };
  const ds = { getRepository: jest.fn(() => repo) };
  const enc = {
    encryptNullable: jest.fn((v: string | null | undefined) => (v != null ? `enc:${v}` : null)),
    decryptNullable: jest.fn((v: string | null | undefined) => (v ? v.replace(/^enc:/, '') : null)),
  };
  const svc = new LeadsService(
    ds as never, null, {} as never, { getAllowedTransitions: jest.fn(() => []) } as never,
    { emitTyped: jest.fn() } as never, enc as never, {} as never,
  );
  return { svc, repo };
}

describe('Lead request contract (CZ-033)', () => {
  it('maps every legacy service type to a canonical one', () => {
    for (const v of Object.values(LEGACY_LEAD_SERVICE_TYPES)) expect(LEAD_SERVICE_TYPES).toContain(v);
  });

  it('the pre-CZ-033 web payload validates', () => {
    expect(errorsFor(LEGACY_WEB_LEAD)).toEqual([]);
  });

  it('persists the pre-CZ-033 payload with canonical columns, keys and values only', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', LEGACY_WEB_LEAD as never);
    const row = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(row).toMatchObject({
      name: 'Fulano de Tal', stage_name: 'MC Fulano', company: 'Fulano Produções',
      service_type: 'musicProduction', phone_encrypted: 'enc:+5511999990000',
    });
    expect(row['service_payload']).toEqual({
      leadType: 'artist_or_band', service: 'music_production', description: 'Single de estreia',
      entryDate: '2026-09-01', responsiblePerson: 'Ana', eventName: 'Festa', eventType: 'wedding',
      interactions: [{ id: 'i1', type: 'call', date: '2026-09-02', time: '10:00', description: 'Primeiro contato' }],
    });
    expect(row['crm_internal_data']).toEqual({
      priority: 'high', leadSource: 'referral', responsiblePerson: 'Ana', marketingCampaign: 'Verão',
      nextFollowUpAt: '2026-09-10', estimatedValue: 5000, temperature: 'hot',
    });
    for (const legacy of ['nome', 'empresa', 'nome_artistico', 'payload_servico', 'dados_internos_crm', 'nomeArtistico', 'payloadServico', 'dadosInternosCRM']) {
      expect(row).not.toHaveProperty(legacy);
    }
  });

  it('responds with the canonical fields only', async () => {
    const { svc } = makeService();
    const res = await svc.create('tenant-1', 'user-1', LEGACY_WEB_LEAD as never) as unknown as Record<string, unknown>;
    expect(res).toMatchObject({ name: 'Fulano de Tal', stageName: 'MC Fulano', company: 'Fulano Produções', serviceType: 'musicProduction', phone: '+5511999990000' });
    expect(res['servicePayload']).toMatchObject({ leadType: 'artist_or_band' });
    expect(res['crmInternalData']).toMatchObject({ priority: 'high' });
    for (const key of ['stage_name', 'service_payload', 'crm_internal_data', 'service_type', 'phone_encrypted', 'nomeArtistico', 'payloadServico', 'dadosInternosCRM']) {
      expect(res[key]).toBeUndefined();
    }
  });

  it('canonical payloads pass through unchanged, and the canonical key wins over a legacy duplicate', () => {
    const canonical = { leadType: 'influencer', interactions: [{ type: 'meeting', date: '2026-01-01' }] };
    expect(canonicalServicePayload(canonical)).toEqual(canonical);
    expect(canonicalCrmInternalData({ priority: 'low', prioridade: 'alta' })).toEqual({ priority: 'low' });
  });
});
