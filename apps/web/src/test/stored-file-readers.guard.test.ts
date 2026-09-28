/**
 * stored-file-readers.guard.test.ts — find-df79ea88
 *
 * Stored documents (contracts, artist documents, HR documents, payment
 * proofs, lead/contact attachments, share agreements, ECAD originals) must be
 * opened through StoredFileLink / openStoredFile (tenant-checked signed
 * download), never by binding the persisted storage URL straight to an
 * href or window.open — that only works while the bucket is public.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");

// Persisted file-link fields produced by uploads of the documents/spreadsheets categories.
const DOC_FIELDS = [
  "file_url", "arquivo_url", "url_arquivo", "documentos_pessoais_url", "presskit_url",
  "url_pdf", "agreement_url", "attachmentsUrl", "comprovante_url",
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("stored document readers go through the tenant-checked download", () => {
  const files = walk(SRC_ROOT);
  const field = DOC_FIELDS.join("|");
  const rawHref = new RegExp(`href=\\{[^}]*\\b(${field})\\b`);
  const rawOpen = new RegExp(`window\\.open\\([^)]*\\b(${field})\\b`);

  it("no raw href={...<doc field>...}", () => {
    const offenders = files.filter((f) => rawHref.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(SRC_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("no window.open(...<doc field>...)", () => {
    const offenders = files.filter((f) => rawOpen.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(SRC_ROOT, f));
    expect(offenders).toEqual([]);
  });

  it("the known readers use StoredFileLink/openStoredFile", () => {
    const readers = [
      "modules/contracts/components/ContractViewModal.tsx",
      "modules/artist/components/ArtistVision360Modal.tsx",
      "modules/hr/pages/HR.tsx",
      "modules/accounting/components/TransactionViewModal.tsx",
      "modules/accounting/components/InvoiceViewModal.tsx",
      "modules/accounting/pages/Invoices.tsx",
      "modules/crm-relationships/modals/ContactViewModal.tsx",
      "modules/releases/components/ShareViewModal.tsx",
      "modules/monitoring/components/ECADViewModal.tsx",
      "shared/components/ChatAttachment.tsx",
    ];
    for (const r of readers) {
      const src = fs.readFileSync(path.join(SRC_ROOT, r), "utf8");
      expect(`${r}: ${/StoredFileLink|openStoredFile|fetchStoredFileBytes/.test(src)}`).toBe(`${r}: true`);
    }
  });
});
