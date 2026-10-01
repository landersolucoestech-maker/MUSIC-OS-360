import { BadRequestException } from '@nestjs/common';
import { parseExportParams } from './reports.controller';

describe('parseExportParams — XLSX contract without pagination', () => {
  it('uses xlsx as the default format', () => {
    expect(parseExportParams({}).format).toBe('xlsx');
  });

  it('accepts explicit xlsx', () => {
    expect(parseExportParams({ format: 'xlsx' }).format).toBe('xlsx');
  });

  it('rejects any unimplemented format with a stable error code', () => {
    for (const format of ['xml', 'pdf', 'txt']) {
      try {
        parseExportParams({ format });
        throw new Error('should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getStatus()).toBe(400);
        expect((error as BadRequestException).getResponse()).toMatchObject({
          error: 'UNSUPPORTED_EXPORT_FORMAT',
        });
      }
    }
  });

  it('deduplicates columns, preserves safe filters and ignores legacy pagination', () => {
    const params = parseExportParams({
      format: 'xlsx',
      columns: 'a, b ,a,c',
      status: 'active',
      sort: 'name',
      order: 'desc',
      page: '2',
      pageSize: '50',
    });
    expect(params.columns).toEqual(['a', 'b', 'c']);
    expect(params.filters).toEqual({ status: 'active' });
    expect(params.sort).toBe('name');
    expect(params.order).toBe('DESC');
    expect(params).not.toHaveProperty('page');
    expect(params).not.toHaveProperty('pageSize');
  });

  it('discards unsafe filter keys', () => {
    const query = Object.create(null) as Record<string, string>;
    query.status = 'active';
    query.__proto__ = 'polluted-value';
    const params = parseExportParams(query);
    expect(params.filters).toEqual({ status: 'active' });
    expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined();
  });
});
