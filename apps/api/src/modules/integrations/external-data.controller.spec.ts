import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate as validate_ } from 'class-validator';
import { ExternalDataStatusCheckDto } from './dto/integrations.dto';
import { ROLES_KEY } from '../../core/decorators/roles.decorator';
import { ExternalDataController } from './external-data.controller';
import { ExternalDataExchangeService } from '../../core/external-data/external-data-exchange.service';
import { ExternalDataProviderRegistry } from '../../core/external-data/external-data-provider-registry.service';

describe('ExternalDataController GET capabilities', () => {
  const exchange = new ExternalDataExchangeService(
    null, new ExternalDataProviderRegistry(), { emitTyped: jest.fn() } as never, {} as never,
  );
  const controller = new ExternalDataController(exchange, {} as never, { get: jest.fn() } as never);

  it('requires viewer role', () => {
    expect(Reflect.getMetadata(ROLES_KEY, ExternalDataController.prototype.listCapabilities)).toEqual(['viewer']);
  });

  it('returns the four unavailable capabilities with stable codes only', () => {
    const body = controller.listCapabilities({ id: 't1' });
    expect(body.map((c) => c.capability).sort()).toEqual(['audio_transcription', 'distributor_status', 'distributor_submission', 'payout']);
    expect(body.every((c) => c.available === false)).toBe(true);
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/Error|stack|Unconfigured|not-configured|ECONN|token|secret/i);
    expect(text).toContain('CAPABILITY_UNAVAILABLE');
  });
});

describe('ExternalDataController status-check POSTs (abuse paths)', () => {
  it('both status-check POSTs require the same role as submit (editor), not viewer', () => {
    const role = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    expect(role(ExternalDataController.prototype.submitDistributor)).toEqual(['editor']);
    expect(role(ExternalDataController.prototype.checkDistributor)).toEqual(['editor']);
    expect(role(ExternalDataController.prototype.checkSociety)).toEqual(['editor']);
  });

  const validate = async (entityId: unknown) => {
    const dto = plainToInstance(ExternalDataStatusCheckDto, { providerId: 'p', submissionId: 's1', entityType: 'artist', entityId });
    return validate_(dto);
  };

  it('rejects a non-UUID entityId', async () => {
    for (const bad of ['not-a-uuid', "1' OR '1'='1", '../../etc/passwd', '']) {
      const errors = await validate(bad);
      expect(errors.some((e) => e.property === 'entityId')).toBe(true);
    }
  });

  it('accepts a UUID entityId and an omitted entityId', async () => {
    expect(await validate('7b0f1b0e-5a53-4c47-9a58-0c6b6d1d2f10')).toHaveLength(0);
    expect(await validate(undefined)).toHaveLength(0);
  });
});
