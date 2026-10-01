import * as XLSX from 'xlsx';
import { ManualExportAdapter } from './manual-export.adapter';

describe('ManualExportAdapter — exportPayload XLSX', () => {
  const adapter = new ManualExportAdapter();

  it('produces a real OpenXML workbook with intact structure and content', async () => {
    const payload = {
      title: 'Minha Obra',
      authors: [{ name: 'Fulano', percentage: 100 }],
      year: 2026,
    };
    const result = await adapter.exportPayload(payload, 'xlsx', 'submission-test');

    expect(result.format).toBe('xlsx');
    expect(result.fileName).toBe('submission-test.xlsx');
    expect(result.mimeType).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(Buffer.isBuffer(result.content)).toBe(true);
    expect((result.content as Buffer).subarray(0, 2).toString('hex')).toBe('504b');

    const workbook = XLSX.read(result.content as Buffer, { type: 'buffer' });
    expect(workbook.SheetNames).toHaveLength(1);
    const sheet = workbook.Sheets[workbook.SheetNames[0]!]!;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
    expect(rows[0]).toEqual(['field', 'value']);
    expect(rows.some((row) => row[0] === 'title' && row[1] === 'Minha Obra')).toBe(true);
    expect(rows.some((row) => row[0] === 'authors[0].name' && row[1] === 'Fulano')).toBe(true);
    expect(rows.some((row) => row[0] === 'authors[0].percentage' && row[1] === '100')).toBe(true);
  });

  it('the json format stays available for technical integration', async () => {
    const payload = { title: 'Outra Obra' };
    const result = await adapter.exportPayload(payload, 'json', 'submission-json');
    expect(result.format).toBe('json');
    expect(result.fileName).toBe('submission-json.json');
    expect(result.mimeType).toContain('application/json');
    expect(JSON.parse(result.content as string)).toEqual(payload);
  });
});
