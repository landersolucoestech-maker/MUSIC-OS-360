// Canonical client-side OpenXML workbook helper.
// The platform accepts only .xlsx files.
import * as XLSX from "xlsx";
import { toast } from "sonner";

import { UserFacingError, toUserMessage } from "@/shared/lib/errors";
import { readSpreadsheetRows } from "@/shared/lib/xlsx-isolated";
export interface XlsxColumn {
  key: string;
  label: string;
  transform?: (row: Record<string, any>) => string;
}

// Formula injection in spreadsheets (OWASP): cells starting with =, @, tab/CR
// are reinterpreted as a formula by Excel/LibreOffice on open. `+`/`-` are
// also the first character of legitimate, common data (phone "+55...",
// negative amounts) — only neutralised when the rest of the cell isn't a
// plausible phone/number pattern, avoiding a false positive on real data.
const ALWAYS_DANGEROUS_PREFIXES = ["=", "@", "\t", "\r"];
const PLAUSIBLE_PHONE = /^\+[\d\s()-]+$/;
const PLAUSIBLE_NEGATIVE_NUMBER = /^-[\d.,]+$/;

function neutralizeFormulaInjection(text: string): string {
  if (text.length === 0) return text;
  const first = text[0];
  if (ALWAYS_DANGEROUS_PREFIXES.includes(first)) return `'${text}`;
  if (first === "+" && !PLAUSIBLE_PHONE.test(text)) return `'${text}`;
  if (first === "-" && !PLAUSIBLE_NEGATIVE_NUMBER.test(text)) return `'${text}`;
  return text;
}

// Export data to XLSX
export function exportToXlsx<T extends Record<string, any>>(
  data: T[],
  columns: XlsxColumn[],
  filename: string
): void {
  if (data.length === 0) {
    toast.error("Nenhum dado para exportar");
    return;
  }

  // Build a 2-D array: first row = labels, subsequent rows = values
  const header = columns.map(col => col.label);

  const rows = data.map(item =>
    columns.map(col => {
      const value = col.transform ? col.transform(item) : item[col.key];
      if (value === null || value === undefined) return "";
      const text = Array.isArray(value) ? value.join(", ") : String(value);
      return neutralizeFormulaInjection(text);
    })
  );

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);

  toast.success(`${data.length} registro(s) exportado(s) com sucesso!`);
}

// Parse an XLSX file into an array of row objects keyed by header label
export function parseXlsx(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        // SheetJS native object mode, in an isolated worker: first row becomes property keys.
        // raw:false converts every cell to a string; defval:"" fills empty cells.
        const { sheetNames, rows: rawRows } = await readSpreadsheetRows(buffer, { defval: "", raw: false });

        if (sheetNames.length === 0) {
          reject(new UserFacingError("Workbook has no sheets", "O arquivo não contém planilhas."));
          return;
        }

        if (rawRows.length === 0) {
          reject(new UserFacingError("Sheet needs a header row and at least one data row", "O arquivo deve ter pelo menos um cabeçalho e uma linha de dados."));
          return;
        }

        // Normalise keys and values to trimmed strings
        const data: Record<string, string>[] = rawRows
          .map(row => {
            const obj: Record<string, string> = {};
            for (const [k, v] of Object.entries(row)) {
              obj[k.trim()] = String(v).trim();
            }
            return obj;
          })
          .filter(row => Object.values(row).some(v => v !== ""));

        resolve(data);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new UserFacingError("Workbook read failed", "Não foi possível ler o arquivo."));
    reader.readAsArrayBuffer(file);
  });
}

// Import XLSX with file picker
export function importXlsx(
  onImport: (data: Record<string, string>[]) => void | Promise<void>,
  acceptedHeaders?: string[]
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx";

  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    try {
      const data = await parseXlsx(file);

      if (data.length === 0) {
        toast.error("Arquivo está vazio");
        return;
      }

      if (acceptedHeaders && acceptedHeaders.length > 0) {
        const fileHeaders = Object.keys(data[0]);
        const missingHeaders = acceptedHeaders.filter(h => !fileHeaders.includes(h));
        if (missingHeaders.length > 0) {
          toast.warning(`Colunas faltando: ${missingHeaders.join(", ")}`);
        }
      }

      await onImport(data);
    } catch (error) {
      toast.error(toUserMessage(error, "Erro ao importar arquivo"));
    }
  };

  input.click();
}
