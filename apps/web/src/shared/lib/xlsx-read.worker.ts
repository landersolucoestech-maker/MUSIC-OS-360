// Web Worker: the only place the web app lets SheetJS read a workbook (see xlsx-isolated.ts).
import * as XLSX from "xlsx";
import type { SpreadsheetReadReply, SpreadsheetReadRequest } from "./xlsx-isolated";

/** First sheet of the workbook as row objects; pure, exported for tests. */
export function readFirstSheet(request: SpreadsheetReadRequest): SpreadsheetReadReply {
  try {
    const workbook = XLSX.read(new Uint8Array(request.buffer), { type: "array" });
    const sheetNames = workbook.SheetNames.map(String);
    const sheet = sheetNames.length > 0 ? workbook.Sheets[sheetNames[0]] : undefined;
    const rows = sheet ? XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, request.options) : [];
    return { ok: true, sheetNames, rows };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  }
}

type WorkerScope = {
  onmessage: ((event: MessageEvent<SpreadsheetReadRequest>) => void) | null;
  postMessage(message: SpreadsheetReadReply): void;
};

// Only inside a dedicated worker: importing this module from a page or a test attaches nothing.
if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== "undefined") {
  const scope = globalThis as unknown as WorkerScope;
  scope.onmessage = (event) => scope.postMessage(readFirstSheet(event.data));
}
