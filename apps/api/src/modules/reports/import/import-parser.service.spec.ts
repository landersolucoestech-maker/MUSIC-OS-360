import { BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { ImportParserService } from './import-parser.service';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_COLUMNS,
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
  throw new Error('Diretório central não encontrado no fixture.');
}

describe('ImportParserService — hardening XLSX', () => {
  const service = new ImportParserService();

  it('preserves Unicode, accents and leading zeros in text cells', () => {
    const content = workbookBuffer([
      ['Nome artístico', 'Código'],
      ['João d’Ávila 🎵', '00123'],
    ]);
    const result = service.parse('artists.xlsx', content, 'Dados');
    expect(result.headers).toEqual(['Nome artístico', 'Código']);
    expect(result.rows).toEqual([
      expect.objectContaining({ 'Nome artístico': 'João d’Ávila 🎵', Código: '00123' }),
    ]);
  });

  it('rejects empty file', () => {
    expect(() => service.parse('artists.xlsx', Buffer.alloc(0))).toThrow(BadRequestException);
  });

  it('rejects unsupported extension with stable error code', () => {
    const content = workbookBuffer([['Campo']]);
    try {
      service.parse('artists.txt', content);
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: 'UNSUPPORTED_IMPORT_FORMAT',
      });
    }
  });

  it('rejects plain text renamed as workbook', () => {
    const fakeContent = Buffer.from('nome;email\nAna;a@example.com\n', 'utf8');
    try {
      service.parse('artists.xlsx', fakeContent);
      throw new Error('deveria ter lançado');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        error: 'INVALID_XLSX_WORKBOOK',
      });
    }
  });

  it('rejects content above the limit before the OpenXML parser', () => {
    const oversized = Buffer.alloc(IMPORT_MAX_BYTES + 1, 0x41);
    expect(() => service.parse('artists.xlsx', oversized)).toThrow(/limite de .* bytes/);
  });

  it('rejects workbook with more than one sheet', () => {
    const content = workbookBuffer([['a'], ['1']], ['Principal', 'Auxiliar']);
    expect(() => service.parse('artists.xlsx', content)).toThrow(BadRequestException);
  });

  it('rejects sheet name that diverges from the contract', () => {
    const content = workbookBuffer([['a'], ['1']], ['Outra']);
    expect(() => service.parse('artists.xlsx', content, 'Artistas')).toThrow(/Nome da aba inválido/);
  });

  it('rejects hidden sheet', () => {
    const content = workbookBuffer([['a'], ['1']], ['Dados'], (workbook) => {
      workbook.Workbook = { Sheets: [{ Hidden: 1 }] };
    });
    expect(() => service.parse('artists.xlsx', content)).toThrow(/deve estar visível/);
  });

  it('rejects merged cells', () => {
    const content = workbookBuffer([['a', 'b'], ['1', '2']], ['Dados'], (_workbook, worksheet) => {
      worksheet['!merges'] = [XLSX.utils.decode_range('A1:B1')];
    });
    expect(() => service.parse('artists.xlsx', content)).toThrow(/mescladas/);
  });

  it('rejects formulas', () => {
    const content = workbookBuffer([['a'], ['valor']], ['Dados'], (_workbook, worksheet) => {
      worksheet.A2 = { t: 'n', f: '1+1', v: 2 };
    });
    expect(() => service.parse('artists.xlsx', content)).toThrow(/Fórmula não permitida/);
  });

  it('rejects duplicate headers after Unicode and case normalization', () => {
    const content = workbookBuffer([['Nome', 'NOME'], ['A', 'B']]);
    expect(() => service.parse('artists.xlsx', content)).toThrow(/Cabeçalho duplicado/);
  });

  it('rejects empty header between used columns', () => {
    const content = workbookBuffer([['Nome', '', 'E-mail'], ['A', '', 'a@example.com']]);
    expect(() => service.parse('artists.xlsx', content)).toThrow(/Cabeçalho vazio/);
  });

  it('rejects column count above the limit', () => {
    const headers = Array.from({ length: IMPORT_MAX_COLUMNS + 1 }, (_, index) => `Campo ${index}`);
    const content = workbookBuffer([headers, headers.map(() => 'x')]);
    expect(() => service.parse('artists.xlsx', content)).toThrow(/colunas excede/);
  });

  it('rejects file with more rows than the limit without silent truncation', () => {
    const rows: string[][] = [['nome']];
    for (let index = 0; index < IMPORT_MAX_ROWS + 5; index += 1) rows.push([`Artista ${index}`]);
    const content = workbookBuffer(rows);
    expect(() => service.parse('artists.xlsx', content)).toThrow(/limite de \d+ registros/);
  });

  it('accepts exactly the row limit', () => {
    const rows: string[][] = [['nome']];
    for (let index = 0; index < IMPORT_MAX_ROWS; index += 1) rows.push([`Artista ${index}`]);
    const result = service.parse('artists.xlsx', workbookBuffer(rows));
    expect(result.rows).toHaveLength(IMPORT_MAX_ROWS);
  });

  it('rejects encrypted ZIP input before interpreting the workbook', () => {
    const content = mutateFirstCentralDirectoryEntry(
      workbookBuffer([['a'], ['1']]),
      (copy, offset) => copy.writeUInt16LE(copy.readUInt16LE(offset + 8) | 0x1, offset + 8),
    );
    expect(() => service.parse('artists.xlsx', content)).toThrow(/criptografadas/);
  });

  it('rejects decompressed expansion incompatible with the limit', () => {
    const content = mutateFirstCentralDirectoryEntry(
      workbookBuffer([['a'], ['1']]),
      (copy, offset) => copy.writeUInt32LE(IMPORT_MAX_UNCOMPRESSED_BYTES + 1, offset + 24),
    );
    expect(() => service.parse('artists.xlsx', content)).toThrow(/descompactada excede/);
  });

  it('rejects truncated workbook', () => {
    const valid = workbookBuffer([['a'], ['1']]);
    expect(() => service.parse('artists.xlsx', valid.subarray(0, valid.length - 32))).toThrow(
      /Diretório central ZIP ausente|truncado/,
    );
  });
});
