/**
 * Reads an uploaded workbook with SheetJS inside a disposable worker thread
 * (core/security/disposable-worker.ts). SheetJS 0.18.5 carries advisories
 * 1108110 (prototype pollution while reading a crafted file) and 1108111
 * (ReDoS); the npm registry has no fixed release. In the worker a polluted
 * prototype stays in a realm that is discarded after the parse, and a runaway
 * parse is terminated at the deadline without blocking the API event loop.
 *
 * The worker only reports facts about the workbook and the first sheet as a
 * matrix of strings; every acceptance decision stays in ImportParserService.
 */
import { ConcurrencyLimiter } from '../../../core/security/concurrency-limiter';
import { runInDisposableWorker } from '../../../core/security/disposable-worker';
import {
  IMPORT_MAX_CONCURRENT_PARSES,
  IMPORT_MAX_PARSES_PER_TENANT,
  IMPORT_MAX_QUEUED_PARSES,
} from './import.types';

export interface IsolatedWorkbook {
  sheetNames: string[];
  /** `Hidden` flag of the first sheet (0 = visible). */
  firstSheetHidden: number;
  hasVba: boolean;
  firstSheetFound: boolean;
  mergeCount: number;
  /** Address of the first cell holding a formula, in SheetJS key order. */
  formulaCell: string | null;
  ref: string | null;
  /** Zero-based index of the last column of `ref`. */
  lastColumnIndex: number | null;
  /** Rows of the first sheet as strings; empty when `ref` is missing or too wide. */
  matrix: string[][];
}

export interface IsolatedReadLimits {
  sheetRows: number;
  maxColumns: number;
  timeoutMs: number;
}

/** SheetJS rejected the bytes; `message` is its technical diagnosis (never user copy). */
export class OpenXmlParseError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = 'OpenXmlParseError';
  }
}

type WorkerReply = { ok: true; workbook: IsolatedWorkbook } | { ok: false; detail: string };

// Plain CommonJS (not compiled or instrumented): it runs in the worker's own realm.
const XLSX_WORKER_SOURCE = String.raw`
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
const XLSX = require(workerData.xlsxPath);
try {
  const bytes = workerData.content;
  const workbook = XLSX.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), {
    type: 'buffer',
    sheetRows: workerData.sheetRows,
    cellDates: true,
    cellFormula: true,
    bookVBA: true,
  });
  const sheetNames = (workbook.SheetNames || []).map((name) => String(name));
  const sheet = sheetNames.length > 0 ? workbook.Sheets[sheetNames[0]] : undefined;
  const sheetsMeta = workbook.Workbook && workbook.Workbook.Sheets;
  const hidden = sheetsMeta && sheetsMeta[0] ? sheetsMeta[0].Hidden : 0;
  let formulaCell = null;
  let ref = null;
  let lastColumnIndex = null;
  let matrix = [];
  if (sheet) {
    for (const address of Object.keys(sheet)) {
      if (address.startsWith('!')) continue;
      const cell = sheet[address];
      if (cell && cell.f) {
        formulaCell = String(address);
        break;
      }
    }
    ref = typeof sheet['!ref'] === 'string' ? sheet['!ref'] : null;
    if (ref) {
      lastColumnIndex = XLSX.utils.decode_range(ref).e.c;
      if (lastColumnIndex + 1 <= workerData.maxColumns) {
        matrix = XLSX.utils
          .sheet_to_json(sheet, { header: 1, defval: '', raw: false, blankrows: false })
          .map((line) => Array.from(line, (value) => (value === undefined || value === null ? '' : String(value))));
      }
    }
  }
  parentPort.postMessage({
    ok: true,
    workbook: {
      sheetNames,
      firstSheetHidden: Number(hidden) || 0,
      hasVba: Boolean(workbook.vbaraw),
      firstSheetFound: Boolean(sheet),
      mergeCount: sheet && Array.isArray(sheet['!merges']) ? sheet['!merges'].length : 0,
      formulaCell,
      ref,
      lastColumnIndex,
      matrix,
    },
  });
} catch (error) {
  parentPort.postMessage({ ok: false, detail: error && error.message ? String(error.message) : String(error) });
}
`;

/** One per API process: parses beyond it are refused with ConcurrencyLimitError (see import.types.ts). */
const PARSE_SLOTS = new ConcurrencyLimiter({
  maxActive: IMPORT_MAX_CONCURRENT_PARSES,
  maxQueued: IMPORT_MAX_QUEUED_PARSES,
  maxPerKey: IMPORT_MAX_PARSES_PER_TENANT,
});

export async function readWorkbookIsolated(
  content: Buffer,
  limits: IsolatedReadLimits,
  tenantKey?: string,
): Promise<IsolatedWorkbook> {
  const parse = (): Promise<WorkerReply> =>
    runInDisposableWorker<WorkerReply>(
      XLSX_WORKER_SOURCE,
      {
        xlsxPath: require.resolve('xlsx'),
        content: new Uint8Array(content),
        sheetRows: limits.sheetRows,
        maxColumns: limits.maxColumns,
      },
      {
        timeoutMs: limits.timeoutMs,
        resourceLimits: { maxOldGenerationSizeMb: 256, maxYoungGenerationSizeMb: 32 },
      },
    );
  const reply = await PARSE_SLOTS.run(parse, tenantKey);
  if (!reply.ok) throw new OpenXmlParseError(reply.detail);
  return reply.workbook;
}
