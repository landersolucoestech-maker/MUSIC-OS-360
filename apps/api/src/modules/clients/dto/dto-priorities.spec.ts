import { RELATIONSHIP_PRIORITIES, SupportTicketPriority, WORK_PRIORITIES } from '@music-os-360/types';
import { PROJECT_PRIORITIES } from '../../audiovisual/dto/audiovisual.dto';
import { MARKETING_PROJECT_PRIORITIES } from '../../marketing/dto/marketing-projects.dto';
import { CreateClientDto } from './clients.dto';
import { CreateSupportRequestDto } from '../../support-requests/dto/support-requests.dto';
import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

const priorityErrors = (cls: new () => object, base: Record<string, unknown>, priority: string) =>
  validateSync(plainToInstance(cls, { ...base, priority })).filter((e) => e.property === 'priority');

describe('DTO priority vocabularies reuse packages/types priorities (finding 11)', () => {
  it('audiovisual and marketing project DTOs use the shared WORK_PRIORITIES', () => {
    expect(PROJECT_PRIORITIES).toBe(WORK_PRIORITIES);
    expect(MARKETING_PROJECT_PRIORITIES).toBe(WORK_PRIORITIES);
  });

  it('client DTO accepts exactly RELATIONSHIP_PRIORITIES', () => {
    for (const p of RELATIONSHIP_PRIORITIES) expect(priorityErrors(CreateClientDto, { name: 'x' }, p)).toHaveLength(0);
    expect(priorityErrors(CreateClientDto, { name: 'x' }, 'urgent')).toHaveLength(1);
  });

  it('support request DTO accepts exactly SupportTicketPriority', () => {
    for (const p of Object.values(SupportTicketPriority)) {
      expect(priorityErrors(CreateSupportRequestDto, { title: 't', description: 'd', type: 'bug' }, p)).toHaveLength(0);
    }
    expect(priorityErrors(CreateSupportRequestDto, { title: 't', description: 'd', type: 'bug' }, 'urgent')).toHaveLength(1);
  });
});
