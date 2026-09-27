import type { DataSource } from 'typeorm';
import type { DomainEvent } from '../../../core/events/events.service';
import type { CampaignEndedPayload, CampaignStartedPayload } from '../../../core/events/domain-events.types';
import { CampaignEventsHandler } from './campaign-events.handler';

const USER_ID = '7f3c9b2e-0000-4000-8000-00000000000a';
const CAMPAIGN_ID = '7f3c9b2e-0000-4000-8000-00000000000b';

function handlerWithRepo() {
  const saved: Array<Record<string, unknown>> = [];
  const repo = {
    create: (row: Record<string, unknown>) => row,
    save: async (row: Record<string, unknown>) => {
      saved.push(row);
      return row;
    },
  };
  const ds = { getRepository: () => repo } as unknown as DataSource;
  return { handler: new CampaignEventsHandler(ds), saved };
}

/** Notification body is end-user copy: no actor UUID, no ISO timestamp. */
describe('CampaignEventsHandler notification copy', () => {
  it('start notification keeps actor and timestamp in metadata only', async () => {
    const { handler, saved } = handlerWithRepo();
    const event: DomainEvent<CampaignStartedPayload> = {
      type: 'campaign.started', tenantId: 't1', userId: USER_ID, occurredAt: '2026-01-05T12:00:00.000Z',
      payload: { campaignId: CAMPAIGN_ID, tenantId: 't1', title: 'Verão', startedBy: USER_ID, startedAt: '2026-01-05T12:00:00.000Z' },
    };
    await handler.onCampaignStarted(event);
    expect(saved).toHaveLength(1);
    expect(saved[0]['title']).toBe('Campanha iniciada: "Verão"');
    expect(saved[0]['body']).toBe('A campanha foi iniciada. O monitoramento foi configurado automaticamente.');
    expect(saved[0]['metadata']).toMatchObject({ startedBy: USER_ID, startedAt: '2026-01-05T12:00:00.000Z' });
  });

  it('end notification carries no ISO timestamp', async () => {
    const { handler, saved } = handlerWithRepo();
    const event: DomainEvent<CampaignEndedPayload> = {
      type: 'campaign.ended', tenantId: 't1', userId: USER_ID, occurredAt: '2026-02-05T12:00:00.000Z',
      payload: { campaignId: CAMPAIGN_ID, tenantId: 't1', title: 'Verão', endedAt: '2026-02-05T12:00:00.000Z' },
    };
    await handler.onCampaignEnded(event);
    expect(saved[0]['body']).toBe('A campanha foi encerrada. O relatório de performance está em processamento.');
    expect(String(saved[0]['body'])).not.toMatch(/\d{4}-\d{2}-\d{2}|[0-9a-f]{8}-[0-9a-f]{4}-/);
  });
});
