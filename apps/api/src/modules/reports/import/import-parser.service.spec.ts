import { BadRequestException, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportParserService } from './import-parser.service';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_CONCURRENT_PARSES,
  IMPORT_MAX_PARSES_PER_TENANT,
  IMPORT_MAX_QUEUED_PARSES,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_UNCOMPRESSED_BYTES,
} from './import.types';

function workbookBuffer(
  rows: unknown[][],
  sheetNames: string[] = ['Dados'],
  configure?: (workbook: XLSX.WorkBook, worksheet: XLSX.WorkSheet) => void,
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const name of sheetNames) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    configure?.(workbook, worksheet);
    XLSX.utils.book_append_sheet(workbook, worksheet, name);
  }
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

type RejectionBody = { error?: string; message?: string; reason?: string };

async function rejectionBody(run: () => Promise<unknown>): Promise<RejectionBody> {
  try {
    await run();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse() as RejectionBody;
  }
  throw new Error('expected the parser to reject the input');
}

function mutateFirstCentralDirectoryEntry(
  input: Buffer,
  mutate: (copy: Buffer, offset: number) => void,
): Buffer {
  const copy = Buffer.from(input);
  for (let offset = 0; offset <= copy.length - 4; offset += 1) {
    if (copy.readUInt32LE(offset) === 0x02014b50) {
      mutate(copy, offset);
      return copy;
    }
  }
  throw new Error('Central directory not found in the fixture.');
}

/** Every local and central-directory entry declares an unknown compression method: the ZIP
 *  pre-scan accepts the container, SheetJS itself throws. */
function unsupportedCompressionWorkbook(): Buffer {
  const copy = Buffer.from(workbookBuffer([['a'], ['1']]));
  for (let offset = 0; offset <= copy.length - 4; offset += 1) {
    const signature = copy.readUInt32LE(offset);
    if (signature === 0x04034b50) copy.writeUInt16LE(99, offset + 8);
    if (signature === 0x02014b50) copy.writeUInt16LE(99, offset + 10);
  }
  return copy;
}

class ShortDeadlineParser extends ImportParserService {
  protected override parseTimeoutMs = 1;
}

describe('ImportParserService — hardening XLSX', () => {
  const service = new ImportParserService();

  it('preserves Unicode, accents and leading zeros in text cells', async () => {
    const content = workbookBuffer([
      ['Nome artístico', 'Código'],
      ['João d’Ávila 🎵', '00123'],
    ]);
    const result = await service.parse('artists.xlsx', content, 'Dados');
    expect(result.headers).toEqual(['Nome artístico', 'Código']);
    expect(result.rows).toEqual([
      expect.objectContaining({ 'Nome artístico': 'João d’Ávila 🎵', Código: '00123' }),
    ]);
  });

  it('rejects empty file', async () => {
    await expect(service.parse('artists.xlsx', Buffer.alloc(0))).rejects.toThrow(BadRequestException);
  });

  it('rejects unsupported extension with stable error code', async () => {
    const content = workbookBuffer([['Campo']]);
    const body = await rejectionBody(() => service.parse('artists.txt', content));
    expect(body).toMatchObject({ error: 'UNSUPPORTED_IMPORT_FORMAT' });
  });

  it('rejects plain text renamed as workbook', async () => {
    const fakeContent = Buffer.from('nome;email\nAna;a@example.com\n', 'utf8');
    const body = await rejectionBody(() => service.parse('artists.xlsx', fakeContent));
    expect(body).toMatchObject({ error: 'INVALID_XLSX_WORKBOOK' });
  });

  it('rejects content above the limit before the OpenXML parser', async () => {
    const oversized = Buffer.alloc(IMPORT_MAX_BYTES + 1, 0x41);
    await expect(service.parse('artists.xlsx', oversized)).rejects.toThrow(/limite de .* bytes/);
  });

  it('rejects workbook with more than one sheet', async () => {
    const content = workbookBuffer([['a'], ['1']], ['Principal', 'Auxiliar']);
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(BadRequestException);
  });

  it('rejects sheet name that diverges from the contract', async () => {
    const content = workbookBuffer([['a'], ['1']], ['Outra']);
    await expect(service.parse('artists.xlsx', content, 'Artistas')).rejects.toThrow(/Nome da aba inválido/);
  });

  it('rejects hidden sheet', async () => {
    const content = workbookBuffer([['a'], ['1']], ['Dados'], (workbook) => {
      workbook.Workbook = { Sheets: [{ Hidden: 1 }] };
    });
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/deve estar visível/);
  });

  it('rejects merged cells', async () => {
    const content = workbookBuffer([['a', 'b'], ['1', '2']], ['Dados'], (_workbook, worksheet) => {
      worksheet['!merges'] = [XLSX.utils.decode_range('A1:B1')];
    });
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/mescladas/);
  });

  it('rejects formulas', async () => {
    const content = workbookBuffer([['a'], ['valor']], ['Dados'], (_workbook, worksheet) => {
      worksheet.A2 = { t: 'n', f: '1+1', v: 2 };
    });
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/Fórmula não permitida na célula A2/);
  });

  it('rejects duplicate headers after Unicode and case normalization', async () => {
    const content = workbookBuffer([['Nome', 'NOME'], ['A', 'B']]);
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/Cabeçalho duplicado/);
  });

  it('rejects empty header between used columns', async () => {
    const content = workbookBuffer([['Nome', '', 'E-mail'], ['A', '', 'a@example.com']]);
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/Cabeçalho vazio/);
  });

  it('rejects column count above the limit', async () => {
    const headers = Array.from({ length: IMPORT_MAX_COLUMNS + 1 }, (_, index) => `Campo ${index}`);
    const content = workbookBuffer([headers, headers.map(() => 'x')]);
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/colunas excede/);
  });

  it('rejects file with more rows than the limit without silent truncation', async () => {
    const rows: string[][] = [['nome']];
    for (let index = 0; index < IMPORT_MAX_ROWS + 5; index += 1) rows.push([`Artista ${index}`]);
    const content = workbookBuffer(rows);
    await expect(service.parse('artists.xlsx', content)).rejects.toThrow(/limite de \d+ registros/);
  });

  it('accepts exactly the row limit', async () => {
    const rows: string[][] = [['nome']];
    for (let index = 0; index < IMPORT_MAX_ROWS; index += 1) rows.push([`Artista ${index}`]);
    const result = await service.parse('artists.xlsx', workbookBuffer(rows));
    expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
  });

  it('rejects encrypted ZIP input before interpreting the workbook', async () => {
    const content = mutateFirstCentralDirectoryEntry(
      workbookBuffer([['a'], ['1']]),
      (copy, offset) => copy.writeUInt16LE(copy.readUInt16LE(offset + 8) | 0x1, offset + 8),
    );
    const body = await rejectionBody(() => service.parse('artists.xlsx', content));
    expect(body.error).toBe('INVALID_XLSX_WORKBOOK');
    expect(body.message).toBe('Planilha XLSX rejeitada. Planilhas protegidas por senha não são permitidas.');
    expect(body.reason).toBe('Encrypted ZIP entry.');
  });

  it('rejects decompressed expansion incompatible with the limit', async () => {
    const content = mutateFirstCentralDirectoryEntry(
      workbookBuffer([['a'], ['1']]),
      (copy, offset) => copy.writeUInt32LE(IMPORT_MAX_UNCOMPRESSED_BYTES + 1, offset + 24),
    );
    const body = await rejectionBody(() => service.parse('artists.xlsx', content));
    expect(body.message).toBe('Planilha XLSX rejeitada. O conteúdo da planilha excede o limite permitido.');
    expect(body.reason).toMatch(/^Uncompressed ZIP entry exceeds the limit: /);
  });

  it('rejects truncated workbook', async () => {
    const valid = workbookBuffer([['a'], ['1']]);
    const body = await rejectionBody(() => service.parse('artists.xlsx', valid.subarray(0, valid.length - 32)));
    expect(body.message).toBe(
      'Planilha XLSX rejeitada. O arquivo não é uma planilha XLSX válida ou está corrompido.',
    );
    expect(body.reason).toMatch(/central directory|Invalid ZIP central directory entry|OpenXML parse failure/);
  });

  it('never forwards the raw OpenXML parser error to the response; it goes to the log', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const body = await rejectionBody(() => service.parse('artists.xlsx', unsupportedCompressionWorkbook()));
      expect(body.error).toBe('INVALID_XLSX_WORKBOOK');
      expect(body.message).toBe(
        'Planilha XLSX rejeitada. O arquivo não é uma planilha XLSX válida ou está corrompido.',
      );
      expect(body.reason).toBe('OpenXML parse failure.');
      expect(JSON.stringify(body)).not.toContain('Compression method');
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('Unsupported ZIP Compression method 99'));
    } finally {
      warn.mockRestore();
    }
  });
});

describe('ImportParserService — isolated OpenXML parse (advisories 1108110 / 1108111)', () => {
  const service = new ImportParserService();

  afterEach(() => {
    for (const key of ['polluted', 'isAdmin', 'f']) delete (Object.prototype as Record<string, unknown>)[key];
  });

  it('rejects a misleading extension or a non-XLSX payload before any parse', async () => {
    for (const name of ['artists.ods', 'artists.xlsm', 'artists.xlsx.exe', 'artists']) {
      expect(await rejectionBody(() => service.parse(name, workbookBuffer([['a'], ['1']])))).toMatchObject({
        error: 'UNSUPPORTED_IMPORT_FORMAT',
      });
    }
    const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n', 'latin1');
    expect(await rejectionBody(() => service.parse('artists.xlsx', pdf))).toMatchObject({
      error: 'INVALID_XLSX_WORKBOOK',
      reason: 'Invalid OpenXML ZIP signature.',
    });
    const upper = await service.parse('ARTISTS.XLSX', workbookBuffer([['name'], ['Ana']]));
    expect(upper.rows).toHaveLength(1);
  });

  it('rejects a workbook with many sheets', async () => {
    const names = Array.from({ length: 40 }, (_, index) => `Aba ${index}`);
    const body = await rejectionBody(() => service.parse('artists.xlsx', workbookBuffer([['a'], ['1']], names)));
    expect(body).toMatchObject({ error: 'SINGLE_SHEET_REQUIRED' });
    expect(body.message).toContain('Abas encontradas: 40');
  });

  it('keeps prototype-polluting names out of this process and out of the parsed rows', async () => {
    const hostile = workbookBuffer([['__proto__', 'constructor'], ['{"polluted":"yes"}', 'x']], ['__proto__'], (workbook) => {
      workbook.Props = { Title: '__proto__' };
      workbook.Custprops = JSON.parse('{"__proto__":"polluted","isAdmin":"true"}') as Record<string, unknown>;
    });
    const body = await rejectionBody(() => service.parse('artists.xlsx', hostile));
    expect(body.message).toMatch(/Cabeçalho inseguro/);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).isAdmin).toBeUndefined();

    const safeHeaders = workbookBuffer([['name', 'role'], ['Ana', '__proto__']], ['Dados'], (workbook) => {
      workbook.Custprops = JSON.parse('{"__proto__":"polluted"}') as Record<string, unknown>;
    });
    const parsed = await service.parse('artists.xlsx', safeHeaders);
    expect(Object.getPrototypeOf(parsed.rows[0])).toBeNull();
    expect(parsed.rows[0]).toEqual(Object.assign(Object.create(null), { name: 'Ana', role: '__proto__' }));
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('runs SheetJS in another realm, not in this process', async () => {
    // SheetJS reads each cell's `f` (formula) through ordinary property access. With this realm's
    // Object.prototype polluted, an in-process parse would see a formula in every cell; the worker's
    // fresh realm does not. Reverting to an in-process XLSX.read makes this test fail.
    const clean = workbookBuffer([['name'], ['Ana']]);
    (Object.prototype as Record<string, unknown>).f = '1+1';
    try {
      const result = await service.parse('artists.xlsx', clean);
      expect(result.rows).toHaveLength(1);
    } finally {
      delete (Object.prototype as Record<string, unknown>).f;
    }
  });

  it('maps a parse that exceeds the deadline to a PT-BR rejection and logs the technical cause', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const body = await rejectionBody(() => new ShortDeadlineParser().parse('artists.xlsx', workbookBuffer([['a'], ['1']])));
      expect(body).toEqual({
        error: 'INVALID_XLSX_WORKBOOK',
        message: 'Planilha XLSX rejeitada. O processamento da planilha excedeu o tempo limite.',
        reason: 'OpenXML parse exceeded the time limit.',
      });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('timed out'));
    } finally {
      warn.mockRestore();
    }
  });

  it('keeps the event loop free while a workbook is parsed', async () => {
    const rows: string[][] = [['name']];
    for (let index = 0; index < IMPORT_MAX_ROWS; index += 1) rows.push([`Artista ${index}`]);
    const content = workbookBuffer(rows);
    let ticks = 0;
    const interval = setInterval(() => {
      ticks += 1;
    }, 1);
    try {
      const result = await service.parse('artists.xlsx', content);
      expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
    } finally {
      clearInterval(interval);
    }
    expect(ticks).toBeGreaterThan(0);
  });

  it('rejects a workbook carrying macros before any parse', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['a'], ['1']]), 'Dados');
    (workbook as XLSX.WorkBook & { vbaraw?: Buffer }).vbaraw = Buffer.from('vba project');
    const content = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsm', bookVBA: true }) as Buffer;
    const body = await rejectionBody(() => service.parse('artists.xlsx', content));
    expect(body.message).toBe('Planilha XLSX rejeitada. Macros e vínculos externos não são permitidos.');
  });

  it('maps a crashed parser worker to safe PT-BR copy and logs the cause', async () => {
    const workers = await import('../../../core/security/disposable-worker');
    const run = jest
      .spyOn(workers, 'runInDisposableWorker')
      .mockRejectedValueOnce(new workers.DisposableWorkerError('crashed', 'worker exited with code 134 before replying'));
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    try {
      const body = await rejectionBody(() => service.parse('artists.xlsx', workbookBuffer([['a'], ['1']])));
      expect(body).toEqual({
        error: 'INVALID_XLSX_WORKBOOK',
        message: 'Planilha XLSX rejeitada. O arquivo não é uma planilha XLSX válida ou está corrompido.',
        reason: 'OpenXML parser unavailable.',
      });
      expect(error).toHaveBeenCalledWith(expect.stringContaining('code 134'));
    } finally {
      run.mockRestore();
      error.mockRestore();
    }
  });
});

describe('ImportParserService — bounded parser concurrency', () => {
  const service = new ImportParserService();
  const content = workbookBuffer([['name'], ['Ana']]);

  async function outcomes(tenants: string[]): Promise<{ parsed: number; busy: RejectionBody[] }> {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      const results = await Promise.allSettled(tenants.map((tenant) => service.parse('artists.xlsx', content, undefined, tenant)));
      const busy = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => {
          expect(result.reason).toBeInstanceOf(ServiceUnavailableException);
          return (result.reason as ServiceUnavailableException).getResponse() as RejectionBody;
        });
      return { parsed: results.filter((result) => result.status === 'fulfilled').length, busy };
    } finally {
      warn.mockRestore();
    }
  }

  it(`runs at most ${IMPORT_MAX_CONCURRENT_PARSES} parses with ${IMPORT_MAX_QUEUED_PARSES} waiting; the rest get a fast busy answer`, async () => {
    const tenants = Array.from({ length: 10 }, (_, index) => `tenant-${index}`);
    const { parsed, busy } = await outcomes(tenants);
    expect(parsed).toBe(IMPORT_MAX_CONCURRENT_PARSES + IMPORT_MAX_QUEUED_PARSES);
    expect(busy).toHaveLength(tenants.length - parsed);
    expect(busy[0]).toEqual({
      error: 'IMPORT_PARSER_BUSY',
      message: 'Muitas planilhas em processamento no momento. Tente novamente em instantes.',
    });
  });

  it(`lets one tenant hold at most ${IMPORT_MAX_PARSES_PER_TENANT} parses in flight`, async () => {
    const { parsed, busy } = await outcomes(Array.from({ length: 6 }, () => 'tenant-a'));
    expect(parsed).toBe(IMPORT_MAX_PARSES_PER_TENANT);
    expect(busy).toHaveLength(6 - IMPORT_MAX_PARSES_PER_TENANT);
    const afterwards = await service.parse('artists.xlsx', content, undefined, 'tenant-a');
    expect(afterwards.rows).toHaveLength(1);
  });
});
