import { afterEach, describe, expect, it, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { UserFacingError } from "@/shared/lib/errors";
import {
  SPREADSHEET_READ_TIMEOUT_MS,
  readSpreadsheetRows,
  spreadsheetWorkerFactory,
  type SpreadsheetReadReply,
} from "./xlsx-isolated";
import { readFirstSheet } from "./xlsx-read.worker";

class FakeWorker {
  onmessage: ((event: MessageEvent<SpreadsheetReadReply>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: { message: unknown; transfer: unknown }[] = [];
  terminate = vi.fn();
  postMessage(message: unknown, transfer?: unknown) {
    this.posted.push({ message, transfer });
  }
  reply(data: SpreadsheetReadReply) {
    this.onmessage?.({ data } as MessageEvent<SpreadsheetReadReply>);
  }
}

function withFakeWorker(): FakeWorker {
  const worker = new FakeWorker();
  vi.spyOn(spreadsheetWorkerFactory, "create").mockReturnValue(worker as unknown as Worker);
  return worker;
}

function workbookBytes(rows: unknown[][], sheetNames = ["Dados"]): ArrayBuffer {
  const workbook = XLSX.utils.book_new();
  for (const name of sheetNames) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("readSpreadsheetRows — SheetJS runs in a Web Worker (advisories 1108110 / 1108111)", () => {
  it("transfers the bytes to the worker, returns its plain rows and terminates it", async () => {
    const worker = withFakeWorker();
    const buffer = new ArrayBuffer(8);
    const pending = readSpreadsheetRows(buffer, { defval: "" });
    expect(worker.posted).toEqual([{ message: { buffer, options: { defval: "" } }, transfer: [buffer] }]);
    worker.reply({ ok: true, sheetNames: ["Dados"], rows: [{ Nome: "Ana" }] });
    await expect(pending).resolves.toEqual({ sheetNames: ["Dados"], rows: [{ Nome: "Ana" }] });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("turns a parse failure into PT-BR copy; the technical cause stays out of it", async () => {
    const worker = withFakeWorker();
    const pending = readSpreadsheetRows(new ArrayBuffer(8));
    worker.reply({ ok: false, detail: "Unsupported ZIP Compression method 99" });
    const error = await pending.then(() => null, (reason: unknown) => reason);
    expect(error).toBeInstanceOf(UserFacingError);
    expect((error as UserFacingError).userMessage).toBe("Não foi possível ler a planilha. Verifique se o arquivo é um XLSX válido.");
    expect((error as UserFacingError).userMessage).not.toContain("Compression");
    expect((error as UserFacingError).message).toContain("Unsupported ZIP Compression method 99");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("terminates a worker that does not answer by the deadline (runaway parse)", async () => {
    vi.useFakeTimers();
    const worker = withFakeWorker();
    const pending = readSpreadsheetRows(new ArrayBuffer(8));
    const outcome = pending.then(() => null, (reason: unknown) => reason);
    vi.advanceTimersByTime(SPREADSHEET_READ_TIMEOUT_MS);
    const error = await outcome;
    expect((error as UserFacingError).userMessage).toBe("Não foi possível ler a planilha: o processamento excedeu o tempo limite.");
    expect(worker.terminate).toHaveBeenCalledTimes(1);
    worker.reply({ ok: true, sheetNames: ["late"], rows: [] });
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects when the worker itself fails", async () => {
    const worker = withFakeWorker();
    const pending = readSpreadsheetRows(new ArrayBuffer(8));
    worker.onerror?.({ message: "script error", preventDefault: vi.fn() } as unknown as ErrorEvent);
    await expect(pending).rejects.toBeInstanceOf(UserFacingError);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});

describe("readFirstSheet — the worker body", () => {
  it("reads the first sheet with the requested sheet_to_json options", () => {
    const reply = readFirstSheet({ buffer: workbookBytes([["Nome", "Código"], ["Ana", "007"]]), options: { defval: "" } });
    expect(reply).toEqual({ ok: true, sheetNames: ["Dados"], rows: [{ Nome: "Ana", Código: "007" }] });
  });

  it("answers a failure (never throws) for bytes that are not a workbook", () => {
    const zipWithBadMethod = new Uint8Array(workbookBytes([["a"], ["1"]]));
    const view = new DataView(zipWithBadMethod.buffer);
    for (let offset = 0; offset <= zipWithBadMethod.length - 4; offset += 1) {
      const signature = view.getUint32(offset, true);
      if (signature === 0x04034b50) view.setUint16(offset + 8, 99, true);
      if (signature === 0x02014b50) view.setUint16(offset + 10, 99, true);
    }
    const reply = readFirstSheet({ buffer: zipWithBadMethod.buffer, options: {} });
    expect(reply.ok).toBe(false);
  });
});

describe("guard: no page code parses a workbook outside the worker", () => {
  const srcRoot = path.resolve(__dirname, "../..");
  const worker = path.join(srcRoot, "shared/lib/xlsx-read.worker.ts");

  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name) ? [full] : [];
    });
  }

  it("XLSX.read / XLSX.readFile appear only in xlsx-read.worker.ts", () => {
    const offenders = sourceFiles(srcRoot).filter(
      (file) => file !== worker && /\bXLSX\.(read|readFile)\s*\(/.test(fs.readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});
