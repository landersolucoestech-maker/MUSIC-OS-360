// Reads an untrusted workbook with SheetJS inside a Web Worker. SheetJS 0.18.5 carries
// advisories 1108110 (prototype pollution when reading a crafted file) and 1108111
// (ReDoS); npm has no fixed release. The worker has its own realm, so a prototype polluted
// while parsing never reaches the page, and it is terminated at a deadline, so a runaway
// parse never freezes the UI. Only plain data comes back (structured clone).
import { UserFacingError } from "@/shared/lib/errors";

export interface SpreadsheetReadOptions {
  defval?: string;
  raw?: boolean;
}

export interface SpreadsheetReadRequest {
  buffer: ArrayBuffer;
  options: SpreadsheetReadOptions;
}

export type SpreadsheetReadReply =
  | { ok: true; sheetNames: string[]; rows: Record<string, unknown>[] }
  | { ok: false; detail: string };

export interface SpreadsheetRows {
  sheetNames: string[];
  rows: Record<string, unknown>[];
}

export const SPREADSHEET_READ_TIMEOUT_MS = 15_000;

const UNREADABLE_MESSAGE = "Não foi possível ler a planilha. Verifique se o arquivo é um XLSX válido.";
const TIMEOUT_MESSAGE = "Não foi possível ler a planilha: o processamento excedeu o tempo limite.";

/** Test seam: the default spawns the bundled module worker. */
export const spreadsheetWorkerFactory = {
  create: (): Worker => new Worker(new URL("./xlsx-read.worker.ts", import.meta.url), { type: "module" }),
};

/**
 * First sheet of `buffer` as row objects (SheetJS `sheet_to_json` with `options`).
 * `buffer` is transferred to the worker and is detached afterwards.
 */
export function readSpreadsheetRows(
  buffer: ArrayBuffer,
  options: SpreadsheetReadOptions = {},
): Promise<SpreadsheetRows> {
  return new Promise((resolve, reject) => {
    const worker = spreadsheetWorkerFactory.create();
    let settled = false;
    const deadline = setTimeout(
      () => finish(() => reject(new UserFacingError("Spreadsheet parse exceeded the time limit", TIMEOUT_MESSAGE))),
      SPREADSHEET_READ_TIMEOUT_MS,
    );
    function finish(settle: () => void) {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      worker.terminate();
      settle();
    }
    worker.onmessage = (event: MessageEvent<SpreadsheetReadReply>) => {
      const reply = event.data;
      finish(() =>
        reply.ok
          ? resolve({ sheetNames: reply.sheetNames, rows: reply.rows })
          : reject(new UserFacingError(`Spreadsheet parse failed: ${reply.detail}`, UNREADABLE_MESSAGE)),
      );
    };
    worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      finish(() => reject(new UserFacingError(`Spreadsheet worker failed: ${event.message}`, UNREADABLE_MESSAGE)));
    };
    const request: SpreadsheetReadRequest = { buffer, options };
    worker.postMessage(request, [buffer]);
  });
}
