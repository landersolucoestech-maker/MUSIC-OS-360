/**
 * One spreadsheet row of the contract-category import. The headers are the Portuguese column titles of the
 * downloadable template (user-facing file contract, spreadsheet input headers): `Nome` (name), `Slug`,
 * `Descrição` (description); lower-case and unaccented spellings are accepted because users edit the file by hand.
 */
export interface CategoryImportRow {
  label: string;
  rawSlug: string;
  description?: string;
}

const cell = (row: Record<string, unknown>, ...headers: string[]): string => {
  for (const h of headers) {
    const v = row[h];
    if (v !== undefined && v !== null) return String(v).trim();
  }
  return "";
};

export function parseCategoryImportRow(row: Record<string, unknown>): CategoryImportRow {
  return {
    label: cell(row, "Nome", "nome"),
    rawSlug: cell(row, "Slug", "slug"),
    description: cell(row, "Descrição", "Descricao", "descricao") || undefined,
  };
}
