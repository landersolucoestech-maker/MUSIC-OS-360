import { AiRepository } from './ai/repositories/ai.repository';
import { Audit_logRepository } from './audit-log/repositories/audit_log.repository';
import { AuthRepository } from './auth/repositories/auth.repository';
import { BillingRepository } from './billing/repositories/billing.repository';
import { BriefingRepository } from './briefings/repositories/briefing.repository';
import { CampaignRepository } from './campaigns/repositories/campaign.repository';
import { ClientRepository } from './clients/repositories/client.repository';
import { Content_detectionRepository } from './content-detections/repositories/content_detection.repository';
import { ContractRepository } from './contracts/repositories/contract.repository';
import { Ecad_reportRepository } from './ecad-reports/repositories/ecad_report.repository';
import { EventRepository } from './events/repositories/event.repository';
import { HealthRepository } from './health/repositories/health.repository';
import { InvoiceRepository } from './invoices/repositories/invoice.repository';
import { IntegrationRepository } from './integrations/repositories/integration.repository';
import { Lead_interactionRepository } from './lead-interactions/repositories/lead_interaction.repository';
import { LeadRepository } from './leads/repositories/lead.repository';
import { NotificationRepository } from './notifications/repositories/notification.repository';
import { PhonogramRepository } from './phonograms/repositories/phonogram.repository';
import { ReleaseRepository } from './releases/repositories/release.repository';
import { ShareRepository } from './shares/repositories/share.repository';
import { Support_ticketRepository } from './support-tickets/repositories/support_ticket.repository';
import { TransactionRepository } from './transactions/repositories/transaction.repository';
import { UploadRepository } from './uploads/repositories/upload.repository';
import { UserRepository } from './users/repositories/user.repository';
import { WorkRepository } from './works/repositories/work.repository';

type RepositoryCtor = new (repo: never) => {
  findAll: (tenantId: string) => unknown;
  findById: (tenantId: string, id: string) => unknown;
  create: (tenantId: string, data: Record<string, unknown>) => unknown;
  update: (tenantId: string, id: string, data: Record<string, unknown>) => unknown;
  remove: (tenantId: string, id: string) => unknown;
};

function makeRepoMock() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
    getOne: jest.fn(),
  };
  return {
    repo: {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((value) => value),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    qb,
  };
}

describe('tenant isolation in generated repositories', () => {
  const cases: Array<[string, RepositoryCtor, string]> = [
    ['ai', AiRepository as unknown as RepositoryCtor, 'entity'],
    ['audit-log', Audit_logRepository as unknown as RepositoryCtor, 'entity'],
    ['auth', AuthRepository as unknown as RepositoryCtor, 'entity'],
    ['billing', BillingRepository as unknown as RepositoryCtor, 'entity'],
    ['briefings', BriefingRepository as unknown as RepositoryCtor, 'entity'],
    ['campaigns', CampaignRepository as unknown as RepositoryCtor, 'entity'],
    ['works', WorkRepository as unknown as RepositoryCtor, 'work'],
    ['clients', ClientRepository as unknown as RepositoryCtor, 'client'],
    ['content-detections', Content_detectionRepository as unknown as RepositoryCtor, 'entity'],
    ['contracts', ContractRepository as unknown as RepositoryCtor, 'entity'],
    ['ecad-reports', Ecad_reportRepository as unknown as RepositoryCtor, 'entity'],
    ['events', EventRepository as unknown as RepositoryCtor, 'entity'],
    ['health', HealthRepository as unknown as RepositoryCtor, 'entity'],
    ['transactions', TransactionRepository as unknown as RepositoryCtor, 't'],
    ['invoices', InvoiceRepository as unknown as RepositoryCtor, 'invoice'],
    ['integrations', IntegrationRepository as unknown as RepositoryCtor, 'entity'],
    ['lead-interactions', Lead_interactionRepository as unknown as RepositoryCtor, 'entity'],
    ['leads', LeadRepository as unknown as RepositoryCtor, 'entity'],
    ['notifications', NotificationRepository as unknown as RepositoryCtor, 'entity'],
    ['phonograms', PhonogramRepository as unknown as RepositoryCtor, 'entity'],
    ['releases', ReleaseRepository as unknown as RepositoryCtor, 'entity'],
    ['shares', ShareRepository as unknown as RepositoryCtor, 'entity'],
    ['support-tickets', Support_ticketRepository as unknown as RepositoryCtor, 'entity'],
    ['uploads', UploadRepository as unknown as RepositoryCtor, 'entity'],
    ['users', UserRepository as unknown as RepositoryCtor, 'entity'],
  ];

  it.each(cases)('%s filters list/detail and writes by tenant', (_name, Repository, alias) => {
    const { repo, qb } = makeRepoMock();
    const sut = new Repository(repo as never);

    sut.findAll('tenant-1');
    expect(repo.createQueryBuilder).toHaveBeenCalledWith(alias);
    expect(qb.where).toHaveBeenCalledWith(`${alias}.tenant_id = :tenantId`, { tenantId: 'tenant-1' });

    sut.findById('tenant-1', 'row-1');
    expect(qb.where).toHaveBeenCalledWith(`${alias}.id = :id AND ${alias}.tenant_id = :tenantId`, {
      id: 'row-1',
      tenantId: 'tenant-1',
    });

    sut.create('tenant-1', { name: 'Example' });
    expect(repo.create).toHaveBeenCalledWith({ name: 'Example', tenant_id: 'tenant-1' });

    sut.update('tenant-1', 'row-1', { name: 'Updated' });
    expect(repo.update).toHaveBeenCalledWith({ id: 'row-1', tenant_id: 'tenant-1' }, { name: 'Updated' });

    sut.remove('tenant-1', 'row-1');
    expect(repo.delete).toHaveBeenCalledWith({ id: 'row-1', tenant_id: 'tenant-1' });
  });
});
