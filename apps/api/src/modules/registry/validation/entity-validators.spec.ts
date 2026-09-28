import { WorkRegistryValidationService, RecordingRegistryValidationService } from './entity-validators';
import type { WorkEntity, PhonogramEntity, ShareEntity } from '../../../database/entities';

const work = new WorkRegistryValidationService();
const recording = new RecordingRegistryValidationService();

const asWork = (o: Partial<WorkEntity>): WorkEntity => o as unknown as WorkEntity;
const asRec = (o: Partial<PhonogramEntity>): PhonogramEntity => o as unknown as PhonogramEntity;
// share_type: null = eligible for registration (see share-eligibility.util.ts). Mocks that
// represent registration shares must declare this explicitly — without this
// property, share_type is `undefined` and the eligibility predicate would exclude them.
const share = (o: Partial<ShareEntity>): ShareEntity => ({ share_type: null, ...o } as unknown as ShareEntity);
const financialShare = (o: Partial<ShareEntity>): ShareEntity => ({ share_type: 'external_receivable', ...o } as unknown as ShareEntity);
const codes = (issues: { code: string }[]) => issues.map((i) => i.code);
const errors = (issues: { severity: string }[]) => issues.filter((i) => i.severity === 'ERROR');

describe('WorkRegistryValidationService', () => {
  it('passes a valid work (title + one author at 100%)', () => {
    const issues = work.validate(
      asWork({ title: 'Minha Obra', ai_used: false }),
      [share({ percentage: '100', party_role: 'author', holder_name: 'A', deleted_at: null })],
    );
    expect(errors(issues)).toHaveLength(0);
  });

  it('flags a work without any author', () => {
    const issues = work.validate(asWork({ title: 'X', ai_used: false }), []);
    expect(codes(issues)).toContain('work_no_author');
  });

  it('flags splits that do not sum to 100%', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: false }),
      [share({ percentage: '60', party_role: 'author', holder_name: 'A', deleted_at: null })],
    );
    expect(codes(issues)).toContain('work_split_not_100');
  });

  it('requires AI tools/prompts when ai_used is true', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: true, ai_tools: [], ai_prompts: [] }),
      [share({ percentage: '100', party_role: 'author', holder_name: 'A', deleted_at: null })],
    );
    expect(codes(issues)).toContain('work_ai_declaration_missing');
  });

  // ── Phase 5 / C6: registration eligibility (share_type IS NULL) ──────────────

  it('excludes financial/pendente shares from author count and percentage sum', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: false }),
      [financialShare({ percentage: '100', party_role: 'author', holder_name: 'Financeiro', deleted_at: null })],
    );
    expect(codes(issues)).toContain('work_no_author');
    expect(codes(issues)).not.toContain('work_split_not_100');
  });

  it('excludes soft-deleted shares even when share_type is null', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: false }),
      [share({ percentage: '100', party_role: 'author', holder_name: 'A', deleted_at: new Date() })],
    );
    expect(codes(issues)).toContain('work_no_author');
  });

  it('flags an eligible share with null holder_name instead of silently treating it as ""', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: false }),
      [share({ percentage: '100', party_role: 'author', holder_name: null, deleted_at: null })],
    );
    expect(codes(issues)).toContain('work_split_holder_name_missing');
  });

  it('flags an eligible share with null percentage instead of coercing it to 0 (and correctly reports the resulting sum mismatch)', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: false }),
      [share({ percentage: null, party_role: 'author', holder_name: 'A', deleted_at: null })],
    );
    expect(codes(issues)).toContain('work_split_percentage_missing');
    expect(codes(issues)).toContain('work_split_not_100');
  });

  it('sums percentage only across eligible shares (mixed financial + registry set)', () => {
    const issues = work.validate(
      asWork({ title: 'X', ai_used: false }),
      [
        share({ percentage: '100', party_role: 'author', holder_name: 'A', deleted_at: null }),
        financialShare({ percentage: '500', party_role: 'author', holder_name: 'Financeiro', deleted_at: null }),
      ],
    );
    expect(errors(issues)).toHaveLength(0);
  });
});

describe('RecordingRegistryValidationService', () => {
  const valid = (): Partial<PhonogramEntity> => ({
    title: 'Faixa',
    work_id: 'w1',
    duration_seconds: 180,
    artist_id: 'a1',
    phonographic_producer_id: 'p1',
    isrc: 'BRABC2600001',
  });

  it('passes a valid recording', () => {
    expect(errors(recording.validate(asRec(valid()), []))).toHaveLength(0);
  });

  it('requires a linked work', () => {
    expect(codes(recording.validate(asRec({ ...valid(), work_id: null }), []))).toContain('recording_work_required');
  });

  it('requires a phonographic producer', () => {
    const issues = recording.validate(asRec({ ...valid(), phonographic_producer_id: null }), []);
    expect(codes(issues)).toContain('recording_producer_required');
  });

  it('rejects an invalid ISRC', () => {
    expect(codes(recording.validate(asRec({ ...valid(), isrc: 'NOPE' }), []))).toContain('recording_isrc_invalid');
  });

  it('a financial share role does not satisfy interpreter/producer requirements', () => {
    const issues = recording.validate(
      asRec({ ...valid(), artist_id: null, phonographic_producer_id: null }),
      [financialShare({ party_role: 'producer', holder_name: 'Financeiro' })],
    );
    expect(codes(issues)).toContain('recording_producer_required');
  });

  it('an eligible share with the canonical performer role satisfies the interpreter requirement (CZ-037)', () => {
    const issues = recording.validate(
      asRec({ ...valid(), artist_id: null }),
      [share({ party_role: 'performer', holder_name: 'A' })],
    );
    expect(codes(issues)).not.toContain('recording_no_interpreter');
    expect(codes(issues)).not.toContain('recording_main_artist_required');
  });

  it('an eligible share with an author role does not satisfy the interpreter requirement', () => {
    const issues = recording.validate(
      asRec({ ...valid(), artist_id: null }),
      [share({ party_role: 'author', holder_name: 'A' })],
    );
    expect(codes(issues)).toContain('recording_no_interpreter');
  });
});
