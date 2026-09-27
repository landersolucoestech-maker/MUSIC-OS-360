/**
 * Fail-closed parser for an XLSX workbook with exactly one sheet.
 */
import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { isWritableKey } from '../../../core/security/safe-object';
import {
  IMPORT_MAX_BYTES,
  IMPORT_MAX_COLUMNS,
  IMPORT_MAX_COMPRESSION_RATIO,
  IMPORT_MAX_ROWS,
  IMPORT_MAX_UNCOMPRESSED_BYTES,
  IMPORT_MAX_ZIP_ENTRIES,
  type ImportFormat,
  type ParsedFile,
} from './import.types';

const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const MAX_END_RECORD_SEARCH = 65_557;

/**
 * Rejection the user can act on: `detail` is PT-BR end-user copy describing
 * what to change in the spreadsheet.
 */
function invalidWorkbook(detail: string): BadRequestException {
  return new BadRequestException({
    error: 'INVALID_XLSX_WORKBOOK',
    message: `Planilha XLSX rejeitada. ${detail}`,
  });
}

const CORRUPT_WORKBOOK_MESSAGE =
  'Planilha XLSX rejeitada. O arquivo não é uma planilha XLSX válida ou está corrompido.';
const OVERSIZED_CONTENT_MESSAGE =
  'Planilha XLSX rejeitada. O conteúdo da planilha excede o limite permitido.';

/**
 * Structural (ZIP/OpenXML container) rejection. The user only gets `message`
 * (PT-BR copy); `reason` is the English technical diagnosis for operators and
 * API clients and is never meant to be rendered.
 */
function rejectedContainer(reason: string, message = CORRUPT_WORKBOOK_MESSAGE): BadRequestException {
  return new BadRequestException({
    error: 'INVALID_XLSX_WORKBOOK',
    message,
    reason,
  });
}

function formatFromName(filename: string): ImportFormat {
  if (/\.xlsx$/i.test(filename)) return 'xlsx';
  throw new BadRequestException({
    error: 'UNSUPPORTED_IMPORT_FORMAT',
    message: `Formato de arquivo não suportado. Apenas XLSX (.xlsx) é aceito. Extensão rejeitada: "${filename}".`,
  });
}

function findEndOfCentralDirectory(content: Buffer): number {
  const minimum = Math.max(0, content.length - MAX_END_RECORD_SEARCH);
  for (let offset = content.length - 22; offset >= minimum; offset -= 1) {
    if (content.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) return offset;
  }
  throw rejectedContainer('ZIP end of central directory record missing or truncated.');
}

function assertSafeZipContainer(content: Buffer): void {
  if (content.length < 4 || content.readUInt32LE(0) !== ZIP_LOCAL_FILE_HEADER) {
    throw rejectedContainer('Invalid OpenXML ZIP signature.');
  }

  const endOffset = findEndOfCentralDirectory(content);
  const entryCount = content.readUInt16LE(endOffset + 10);
  const centralDirectorySize = content.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = content.readUInt32LE(endOffset + 16);

  if (entryCount === 0 || entryCount > IMPORT_MAX_ZIP_ENTRIES) {
    throw rejectedContainer(`ZIP entry count out of bounds: ${entryCount}.`);
  }
  if (centralDirectoryOffset + centralDirectorySize > content.length) {
    throw rejectedContainer('ZIP central directory points outside the file.');
  }

  let cursor = centralDirectoryOffset;
  let totalCompressed = 0;
  let totalUncompressed = 0;
  let hasContentTypes = false;
  let hasWorkbook = false;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > content.length || content.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw rejectedContainer(`Invalid ZIP central directory entry ${index + 1}.`);
    }

    const flags = content.readUInt16LE(cursor + 8);
    const compressedSize = content.readUInt32LE(cursor + 20);
    const uncompressedSize = content.readUInt32LE(cursor + 24);
    const fileNameLength = content.readUInt16LE(cursor + 28);
    const extraLength = content.readUInt16LE(cursor + 30);
    const commentLength = content.readUInt16LE(cursor + 32);
    const nameStart = cursor + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > content.length) throw rejectedContainer('Truncated ZIP entry name.');
    if ((flags & 0x1) !== 0) throw rejectedContainer(
        'Encrypted ZIP entry.',
        'Planilha XLSX rejeitada. Planilhas protegidas por senha não são permitidas.',
      );
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw rejectedContainer('ZIP64 archives are not accepted for imports.');
    }

    const entryName = content.subarray(nameStart, nameEnd).toString('utf8').replace(/\\/g, '/');
    if (!entryName || entryName.startsWith('/') || entryName.split('/').includes('..')) {
      throw rejectedContainer(`Unsafe ZIP entry path: "${entryName}".`);
    }
    if (/vbaProject\.bin|(^|\/)macrosheets\/|(^|\/)externalLinks\//i.test(entryName)) {
      throw rejectedContainer(
        `Active content or external link entry: "${entryName}".`,
        'Planilha XLSX rejeitada. Macros e vínculos externos não são permitidos.',
      );
    }

    hasContentTypes ||= entryName === '[Content_Types].xml';
    hasWorkbook ||= entryName === 'xl/workbook.xml';
    totalCompressed += compressedSize;
    totalUncompressed += uncompressedSize;

    if (uncompressedSize > IMPORT_MAX_UNCOMPRESSED_BYTES) {
      throw rejectedContainer(`Uncompressed ZIP entry exceeds the limit: "${entryName}".`, OVERSIZED_CONTENT_MESSAGE);
    }
    if (
      compressedSize > 0 &&
      uncompressedSize / compressedSize > IMPORT_MAX_COMPRESSION_RATIO
    ) {
      throw rejectedContainer(`Suspicious compression ratio in entry "${entryName}".`, OVERSIZED_CONTENT_MESSAGE);
    }

    cursor = nameEnd + extraLength + commentLength;
  }

  if (!hasContentTypes || !hasWorkbook) {
    throw rejectedContainer('Minimum OpenXML structure missing ([Content_Types].xml / xl/workbook.xml).');
  }
  if (totalUncompressed > IMPORT_MAX_UNCOMPRESSED_BYTES) {
    throw rejectedContainer('Total uncompressed content exceeds the limit.', OVERSIZED_CONTENT_MESSAGE);
  }
  if (
    totalCompressed > 0 &&
    totalUncompressed / totalCompressed > IMPORT_MAX_COMPRESSION_RATIO
  ) {
    throw rejectedContainer('Suspicious total compression ratio.', OVERSIZED_CONTENT_MESSAGE);
  }
}

function assertNoFormulasOrMerges(sheet: XLSX.WorkSheet): void {
  const merges = sheet['!merges'] ?? [];
  if (merges.length > 0) {
    throw invalidWorkbook('Células mescladas não são permitidas.');
  }

  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!')) continue;
    const cell = sheet[address] as XLSX.CellObject | undefined;
    if (cell?.f) throw invalidWorkbook(`Fórmula não permitida na célula ${address}.`);
  }
}

function assertHeaders(headers: string[]): void {
  if (headers.length === 0) throw invalidWorkbook('Linha de cabeçalho ausente.');
  if (headers.length > IMPORT_MAX_COLUMNS) {
    throw invalidWorkbook(`Quantidade de colunas excede o limite de ${IMPORT_MAX_COLUMNS}.`);
  }

  const normalized = new Set<string>();
  for (let index = 0; index < headers.length; index += 1) {
    const header = headers[index];
    if (!header) throw invalidWorkbook(`Cabeçalho vazio na coluna ${index + 1}.`);
    if (!isWritableKey(header)) throw invalidWorkbook(`Cabeçalho inseguro: "${header}".`);
    const key = header.normalize('NFKC').toLocaleLowerCase('pt-BR');
    if (normalized.has(key)) throw invalidWorkbook(`Cabeçalho duplicado: "${header}".`);
    normalized.add(key);
  }
}

@Injectable()
export class ImportParserService {
  parse(filename: string, content: Buffer, expectedSheetName?: string): ParsedFile {
    formatFromName(filename);
    if (!content || content.length === 0) throw new BadRequestException('Arquivo vazio.');
    if (content.length > IMPORT_MAX_BYTES) {
      throw new BadRequestException(`Arquivo excede o limite de ${IMPORT_MAX_BYTES} bytes.`);
    }
    assertSafeZipContainer(content);

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(content, {
        type: 'buffer',
        sheetRows: IMPORT_MAX_ROWS + 2,
        cellDates: true,
        cellFormula: true,
        bookVBA: true,
      });
    } catch (error) {
      throw rejectedContainer(
        `OpenXML parse failure: ${error instanceof Error ? error.message : String(error)}.`,
      );
    }

    if ((workbook as XLSX.WorkBook & { vbaraw?: unknown }).vbaraw) {
      throw invalidWorkbook('Macros não são permitidas.');
    }
    if (workbook.SheetNames.length !== 1) {
      throw new BadRequestException({
        error: 'SINGLE_SHEET_REQUIRED',
        message: `O arquivo deve conter exatamente uma aba. Abas encontradas: ${workbook.SheetNames.length}.`,
      });
    }

    const sheetName = workbook.SheetNames[0]!;
    if (expectedSheetName && sheetName !== expectedSheetName.slice(0, 31)) {
      throw invalidWorkbook(
        `Nome da aba inválido. Esperado: "${expectedSheetName.slice(0, 31)}"; recebido: "${sheetName}".`,
      );
    }
    const sheetVisibility = workbook.Workbook?.Sheets?.[0]?.Hidden ?? 0;
    if (sheetVisibility !== 0) throw invalidWorkbook('A única aba da planilha deve estar visível.');

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) throw rejectedContainer('Declared sheet not found in the workbook.');
    assertNoFormulasOrMerges(sheet);

    const reference = sheet['!ref'];
    if (!reference) throw new BadRequestException('Planilha vazia.');
    const range = XLSX.utils.decode_range(reference);
    if (range.e.c + 1 > IMPORT_MAX_COLUMNS) {
      throw invalidWorkbook(`Quantidade de colunas excede o limite de ${IMPORT_MAX_COLUMNS}.`);
    }

    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
      blankrows: false,
    });
    if (matrix.length === 0) throw new BadRequestException('Planilha vazia.');

    const headers = (matrix[0] as unknown[]).map((header) => String(header ?? '').trim());
    assertHeaders(headers);

    const body = matrix.slice(1);
    if (body.length > IMPORT_MAX_ROWS) {
      throw new BadRequestException(`Arquivo excede o limite de ${IMPORT_MAX_ROWS} registros.`);
    }

    const rows = body.map((line) => {
      const record: Record<string, string> = Object.create(null);
      headers.forEach((header, index) => {
        record[header] = String((line as unknown[])[index] ?? '');
      });
      return record;
    });

    return { format: 'xlsx', headers, rows };
  }
}
