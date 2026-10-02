import {
  composeIsrc,
  deriveIsrcParts,
  formatDurationText,
  parseDurationTextToSeconds,
  resolvePhonogramDerivedFields,
} from './registry-fields.util';
import { parseDurationTextToSeconds as worksParse } from '../../modules/works/work-registry-fields.util';

describe('registry-fields.util', () => {
  it('keeps the works import working (same function)', () => {
    expect(worksParse).toBe(parseDurationTextToSeconds);
  });

  it('parses MM:SS and HH:MM:SS, rejects garbage', () => {
    expect(parseDurationTextToSeconds('03:25')).toBe(205);
    expect(parseDurationTextToSeconds('1:02:03')).toBe(3723);
    expect(parseDurationTextToSeconds('abc')).toBeNull();
    expect(parseDurationTextToSeconds('')).toBeNull();
    expect(parseDurationTextToSeconds('12')).toBeNull();
  });

  it('formats seconds as MM:SS with minutes above 59', () => {
    expect(formatDurationText(205)).toBe('03:25');
    expect(formatDurationText(0)).toBe('00:00');
    expect(formatDurationText(3723)).toBe('62:03');
    expect(formatDurationText(-1)).toBeNull();
    expect(formatDurationText(1.5)).toBeNull();
  });

  it('derives and composes ISRC parts (2/3/2/5)', () => {
    const parts = deriveIsrcParts('br-abc-26-00001');
    expect(parts).toEqual({ isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '26', isrc_designation_code: '00001' });
    expect(composeIsrc(parts!)).toBe('BRABC2600001');
    expect(deriveIsrcParts('nope')).toBeNull();
    expect(composeIsrc({ isrc_country_code: 'BR' })).toBeNull();
  });

  describe('resolvePhonogramDerivedFields', () => {
    it('duration_text alone is parsed and rewritten', () => {
      expect(resolvePhonogramDerivedFields({ duration_text: '3:25' }, null).values).toEqual({ duration_seconds: 205, duration_text: '03:25' });
    });
    it('unparseable duration_text -> PHONOGRAM_DURATION_TEXT_INVALID', () => {
      expect(resolvePhonogramDerivedFields({ duration_text: 'x' }, null).issue?.code).toBe('PHONOGRAM_DURATION_TEXT_INVALID');
    });
    it('disagreeing duration pair -> PHONOGRAM_DURATION_MISMATCH', () => {
      expect(resolvePhonogramDerivedFields({ duration_text: '03:25', duration_seconds: 200 }, null).issue?.code).toBe('PHONOGRAM_DURATION_MISMATCH');
    });
    it('duration_seconds wins and rewrites the text', () => {
      expect(resolvePhonogramDerivedFields({ duration_seconds: 65, duration_text: '01:05' }, null).values).toMatchObject({ duration_seconds: 65, duration_text: '01:05' });
      expect(resolvePhonogramDerivedFields({ duration_seconds: 65 }, null).values).toMatchObject({ duration_text: '01:05' });
    });
    it('isrc normalised and parts rewritten; invalid and mismatching rejected', () => {
      expect(resolvePhonogramDerivedFields({ isrc: 'br-abc-26-00001' }, null).values).toMatchObject({ isrc: 'BRABC2600001', isrc_year: '26' });
      expect(resolvePhonogramDerivedFields({ isrc: 'bad' }, null).issue?.code).toBe('PHONOGRAM_ISRC_INVALID');
      expect(resolvePhonogramDerivedFields({ isrc: 'BRABC2600001', isrc_year: '27' }, null).issue?.code).toBe('PHONOGRAM_ISRC_MISMATCH');
    });
    it('a changed isrc rewrites the parts stored for the old isrc (not a conflict)', () => {
      const current = { isrc: 'BRABC2600001', isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '26', isrc_designation_code: '00001' };
      const { values, issue } = resolvePhonogramDerivedFields({ isrc: 'USXYZ2400009' }, current);
      expect(issue).toBeUndefined();
      expect(values).toMatchObject({ isrc: 'USXYZ2400009', isrc_country_code: 'US', isrc_designation_code: '00009' });
    });
    it('partial PATCH merges parts over the stored ones and composes the isrc', () => {
      const current = { isrc_country_code: 'BR', isrc_registrant_code: 'ABC', isrc_year: '26', isrc_designation_code: '00001' };
      expect(resolvePhonogramDerivedFields({ isrc_year: '27' }, current).values).toMatchObject({ isrc: 'BRABC2700001', isrc_year: '27' });
    });
    it('incomplete parts do not compose; null/blank never write', () => {
      expect(resolvePhonogramDerivedFields({ isrc_year: '27' }, null).values).toEqual({});
      expect(resolvePhonogramDerivedFields({ isrc: null, duration_text: '', duration_seconds: undefined }, null).values).toEqual({});
    });
  });
});
