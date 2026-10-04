import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MessageAttachmentDto } from '../../modules/conversations/dto/conversations.dto';
import { InternalMessageAttachmentDto } from '../../modules/internal-chat/dto/internal-chat.dto';
import { CreatePayrollEntryDto } from '../../modules/hr/dto/create-payroll-entry.dto';
import { CreateLeaveRequestDto } from '../../modules/hr/dto/create-leave-request.dto';
import { CreateEcadReportDto } from '../../modules/ecad-reports/dto/create-ecad-report.dto';
import { SyncPlatformProfileDto } from '../../modules/artists/dto/sync-platform-profile.dto';

// S2-7: class-validator's isURL() accepts these (host `javascript`, port `1`).
const EVIL = ['javascript:1/alert(document.domain)', 'vbscript:1/x', 'ftp://example.com/x', 'data:1/x'];
const GOOD = ['https://cdn.example.com/a.pdf', 'http://localhost:54321/x.png', 'r2://music-os/tenants/t/a.pdf'];

async function badProps<T extends object>(cls: new () => T, plain: Record<string, unknown>): Promise<string[]> {
  const errs = await validate(plainToInstance(cls, plain));
  return errs.map((e) => e.property);
}

describe('legacy @IsUrl() DTOs now use the shared http/storage rule (S2-7)', () => {
  it.each(EVIL)('rejects %j on every migrated field', async (url) => {
    expect(await badProps(MessageAttachmentDto, { kind: 'FILE', name: 'n', mime: 'a/b', url })).toContain('url');
    expect(await badProps(InternalMessageAttachmentDto, { name: 'n', url })).toContain('url');
    expect(await badProps(CreatePayrollEntryDto, { file_url: url })).toContain('file_url');
    expect(await badProps(CreatePayrollEntryDto, { arquivo_url: url })).toContain('arquivo_url');
    expect(await badProps(CreateLeaveRequestDto, { document_url: url })).toContain('document_url');
    expect(await badProps(CreateLeaveRequestDto, { documento_url: url })).toContain('documento_url');
    expect(await badProps(CreateEcadReportDto, { file_url: url })).toContain('file_url');
  });
  it.each(['javascript:1/alert(1)', 'vbscript:1/x', 'data:1/x'])('sync profile url rejects %j', async (profileUrl) => {
    expect(await badProps(SyncPlatformProfileDto, { profileUrl })).toContain('profileUrl');
  });
  it.each(GOOD)('accepts %s', async (url) => {
    expect(await badProps(InternalMessageAttachmentDto, { name: 'n', url })).not.toContain('url');
    expect(await badProps(CreatePayrollEntryDto, { file_url: url })).not.toContain('file_url');
    expect(await badProps(CreateEcadReportDto, { file_url: url })).not.toContain('file_url');
  });
  it('a chat attachment url may not be blank, a real profile url still passes', async () => {
    expect(await badProps(InternalMessageAttachmentDto, { name: 'n', url: '' })).toContain('url');
    expect(await badProps(SyncPlatformProfileDto, { profileUrl: 'https://open.spotify.com/artist/abc' })).not.toContain('profileUrl');
  });
});

describe('CreatePayrollEntryDto: deprecated `competencia` stands in for reference_month', () => {
  const base = { employee_id: '223e4567-e89b-12d3-a456-426614174000', gross_salary: '5000', net_salary: '4700' };
  const strict = (plain: Record<string, unknown>) => validate(plainToInstance(CreatePayrollEntryDto, plain), { whitelist: true, forbidNonWhitelisted: true });

  it('accepts competencia in place of reference_month (declared property, requirement waived)', async () => {
    expect(await strict({ ...base, competencia: '2025-03' })).toEqual([]);
  });

  it('still requires one of reference_month / competencia / mes_referencia', async () => {
    expect((await strict(base)).map((e) => e.property)).toContain('reference_month');
  });

  it('validates competencia as a string', async () => {
    expect((await strict({ ...base, competencia: 202503 })).map((e) => e.property)).toContain('competencia');
  });
});
