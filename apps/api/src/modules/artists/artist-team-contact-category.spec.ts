import { ARTIST_TEAM_CONTACT_CATEGORIES, LEGACY_TEAM_CONTACT_CATEGORIES } from '@music-os-360/types';
import {
  ARTIST_TEAM_CONTACT_CATEGORY_VALUES, canonicalArtistTeamContactCategory,
  canonicalArtistNestedColumn, canonicalizeArtistInput,
} from './artist-legacy-fields';

describe('artist team contact category', () => {
  it('exports the shared tuple', () => {
    expect(ARTIST_TEAM_CONTACT_CATEGORY_VALUES).toBe(ARTIST_TEAM_CONTACT_CATEGORIES);
  });
  it('shared legacy map equals the literal table (single definition used by API and web)', () => {
    expect(LEGACY_TEAM_CONTACT_CATEGORIES).toEqual({
      empresario: 'agent', gravadora: 'record_label', editora: 'publisher', juridico: 'legal',
      financeiro: 'finance', contador: 'accountant', assessoria: 'press_office', editora_musical: 'publisher',
      gestor: 'agent', // quirk kept: labelled "Empresario" in the UI
    });
  });
  it('maps every legacy value to a canonical category', () => {
    expect(LEGACY_TEAM_CONTACT_CATEGORIES).toMatchObject({
      editora_musical: 'publisher', gestor: 'agent', assessoria: 'press_office', juridico: 'legal',
      financeiro: 'finance', contador: 'accountant',
    });
    for (const canonical of Object.values(LEGACY_TEAM_CONTACT_CATEGORIES)) {
      expect(ARTIST_TEAM_CONTACT_CATEGORIES as readonly string[]).toContain(canonical);
    }
    expect(canonicalArtistTeamContactCategory('Gestor')).toBe('agent');
    expect(canonicalArtistTeamContactCategory('editora_musical')).toBe('publisher');
  });
  it('preserves canonical, unknown and non-string values', () => {
    expect(canonicalArtistTeamContactCategory('roadie')).toBe('roadie');
    expect(canonicalArtistTeamContactCategory('Fotógrafo')).toBe('Fotógrafo');
    expect(canonicalArtistTeamContactCategory(null)).toBeNull();
    expect(canonicalArtistTeamContactCategory(undefined)).toBeUndefined();
  });
  it('is own-property safe for prototype keys', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(canonicalArtistTeamContactCategory(key)).toBe(key);
    }
  });
  it('canonicalizes team_contacts[].category (also from deprecated keys) and leaves other columns alone', () => {
    const out = canonicalizeArtistInput({
      contatos_equipe: [{ nome: 'A', categoria: 'gestor' }, { nome: 'B', categoria: 'Fotógrafo' }, { nome: 'C' }],
    }) as Record<string, any>;
    expect(out.team_contacts).toEqual([
      { name: 'A', category: 'agent' }, { name: 'B', category: 'Fotógrafo' }, { name: 'C' },
    ]);
    expect(canonicalArtistNestedColumn('linked_contacts', [{ category: 'gestor' }])).toEqual([{ category: 'gestor' }]);
  });
});
