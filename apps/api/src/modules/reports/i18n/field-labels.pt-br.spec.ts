import {
  FIELD_LABELS_PT_BR, FIELD_KEYS_BY_LABEL_PT_BR,
  normalizeFieldKey, getFieldLabelPtBr, fieldKeyForLabelPtBr,
} from './field-labels.pt-br';

/** PHASE 2 — ensures no visible label is derived from an English technical key. */

const FORBIDDEN_ENGLISH = [
  'Name', 'Phone', 'Email', 'Website', 'Address', 'Country', 'State', 'Notes',
  'Priority', 'Timeline', 'Attachments', 'Tags', 'Manager', 'Company',
  'Contact Type', 'Signing Platform', 'Soundcloud Url', 'Apple Music Url', 'Url',
];

describe('field-labels.pt-br — central label layer', () => {
  const entries = Object.entries(FIELD_LABELS_PT_BR);

  // ── Test 1: coverage — every label exists and is non-empty ───────────────────
  it('every field in the dictionary has a non-empty pt-BR label', () => {
    for (const [key, label] of entries) {
      expect(typeof label).toBe('string');
      expect(label.trim().length).toBeGreaterThan(0);
      expect(key.trim().length).toBeGreaterThan(0);
    }
  });

  // ── Test 2: no label exposes the raw technical key ───────────────────────────
  // (case-sensitive: pt-BR capitalization/accentuation of a pt key is valid —
  //  e.g.: "vencimento" → "Vencimento"; raw English is blocked in Test 3.)
  it('no label is exactly the raw technical key', () => {
    for (const [key, label] of entries) {
      expect(label).not.toBe(key);
    }
  });

  // ── Test 3: no forbidden English term ───────────────────────────────────────
  it('no label contains a forbidden English term', () => {
    const offenders: string[] = [];
    for (const [key, label] of entries) {
      for (const term of FORBIDDEN_ENGLISH) {
        if (new RegExp(`\\b${term.replace(/ /g, '\\s')}\\b`, 'i').test(label)) {
          offenders.push(`${key}="${label}" (contém "${term}")`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  // ── Test 4: round-trip label ↔ key ──────────────────────────────────────────
  it('round-trip: technical key → pt-BR label → canonical key', () => {
    const cases: Array<[string, string, string]> = [
      ['manager_name', 'Nome do empresário', 'managerName'],
      ['company_name', 'Empresa', 'companyName'],
      ['signing_platform', 'Plataforma de assinatura', 'signingPlatform'],
      ['spotify_url', 'Link do Spotify', 'spotifyUrl'],
      ['youtube_url', 'Link do YouTube', 'youtubeUrl'],
    ];
    for (const [techKey, expectedLabel, canonical] of cases) {
      expect(getFieldLabelPtBr(techKey)).toBe(expectedLabel);
      expect(fieldKeyForLabelPtBr(expectedLabel)).toBe(canonical);
      expect(normalizeFieldKey(techKey)).toBe(canonical);
    }
  });

  // ── Test 5: missing label throws (no visual fallback) ──────────────────────
  it('getFieldLabelPtBr throws when the label does not exist', () => {
    expect(() => getFieldLabelPtBr('unknownField')).toThrow(/Missing pt-BR label/);
    expect(() => getFieldLabelPtBr('shippingMethod')).toThrow();
  });

  it('normalizeFieldKey recognizes snake/camel/Pascal/kebab', () => {
    expect(normalizeFieldKey('manager_name')).toBe('managerName');
    expect(normalizeFieldKey('managerName')).toBe('managerName');
    expect(normalizeFieldKey('ManagerName')).toBe('managerName');
    expect(normalizeFieldKey('manager-name')).toBe('managerName');
    expect(normalizeFieldKey('spotify_url')).toBe('spotifyUrl');
  });

  it('reverse map has no ambiguity in critical labels', () => {
    expect(FIELD_KEYS_BY_LABEL_PT_BR['link do spotify']).toBe('spotifyUrl');
    expect(FIELD_KEYS_BY_LABEL_PT_BR['nome do empresário']).toBe('managerName');
  });
});
