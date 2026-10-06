/**
 * The spreadsheet import writes with its own INSERT, so it cannot reach the module services. These are the catalog
 * invariants the services enforce, applied to an imported row before anything is written: a closed list of artist
 * specialties, a valid ISWC, a share that belongs to one structure and a percentage inside 0..100. Each violation is
 * a row-scoped message; the import rolls back as a whole when any row has one.
 */
import { ARTIST_SPECIALTIES } from '../../artists/artist-legacy-fields';
import { isValidIswc } from '../../registry/validators/registry-validators';
import { importArtistSpecialties } from './import-value-canonicalizers';

const present = (value: unknown): boolean => value !== null && value !== undefined && String(value).trim() !== '';

/** `values` holds the row by physical column name (cells as read from the spreadsheet). */
export function catalogImportViolations(table: string, values: Readonly<Record<string, unknown>>): string[] {
  const out: string[] = [];
  if (table === 'artists' && present(values['specialties'])) {
    const canonical = importArtistSpecialties(values['specialties']);
    const items = Array.isArray(canonical) ? canonical : [canonical];
    const invalid = items.filter((item) => typeof item !== 'string' || !(ARTIST_SPECIALTIES as readonly string[]).includes(item));
    if (invalid.length > 0) out.push(`especialidade inválida. Valores permitidos: ${ARTIST_SPECIALTIES.join(', ')}.`);
  }
  if (table === 'works' && present(values['iswc']) && !isValidIswc(String(values['iswc']))) {
    out.push('ISWC inválido. Formato esperado: T-DDD.DDD.DDD-C (T mais 10 dígitos, separadores opcionais).');
  }
  if (table === 'shares') {
    if (present(values['work_id']) && present(values['phonogram_id'])) {
      out.push('uma participação pertence a uma única estrutura: Obra ou Fonograma, não as duas.');
    }
    if (present(values['percentage'])) {
      const percentage = Number(String(values['percentage']).replace(',', '.'));
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        out.push('percentual inválido. Informe um valor entre 0 e 100.');
      }
    }
  }
  return out;
}
