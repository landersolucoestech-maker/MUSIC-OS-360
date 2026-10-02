import { WorkRegistryValidationService, RecordingRegistryValidationService } from './entity-validators';
import type { WorkEntity, PhonogramEntity, ShareEntity } from '../../../database/entities';

const work = new WorkRegistryValidationService();
const recording = new RecordingRegistryValidationService();
const share = (o: Partial<ShareEntity>): ShareEntity => ({ share_type: null, deleted_at: null, holder_name: 'H', ...o } as unknown as ShareEntity);
const codes = (issues: { code: string }[]) => issues.map((i) => i.code);
const rec = (o: Partial<PhonogramEntity> = {}) =>
  ({ work_id: 'w', title: 'T', duration_seconds: 180, ...o } as unknown as PhonogramEntity);

// Free-text role spellings still found on shares outside the migrated vocabulary are
// read as the canonical publisher / performer / producer roles.
describe('registry role legacy spellings (legacy in, canonical out)', () => {
  it.each([['editora'], ['Editora Musical'], ['editor']])('work: role "%s" is a publisher, not an author', (role) => {
    const issues = work.validate(
      { title: 'X', ai_used: false } as unknown as WorkEntity,
      [share({ percentage: '100', party_role: role })],
    );
    expect(codes(issues)).toContain('work_no_author');
  });

  it('work: canonical "publisher" behaves identically and "author" still counts', () => {
    const w = { title: 'X', ai_used: false } as unknown as WorkEntity;
    expect(codes(work.validate(w, [share({ percentage: '100', party_role: 'publisher' })]))).toContain('work_no_author');
    expect(codes(work.validate(w, [share({ percentage: '100', party_role: 'author' })]))).not.toContain('work_no_author');
  });

  it.each([['cantor'], ['Cantor Principal'], ['performer']])('recording: role "%s" satisfies the interpreter/main artist rules', (role) => {
    const issues = recording.validate(rec(), [share({ percentage: '50', party_role: role })]);
    expect(codes(issues)).not.toContain('recording_main_artist_required');
    expect(codes(issues)).not.toContain('recording_no_interpreter');
  });

  it.each([['produtor'], ['Produtor Fonografico'], ['producer']])('recording: role "%s" satisfies the producer rule', (role) => {
    expect(codes(recording.validate(rec(), [share({ percentage: '50', party_role: role })]))).not.toContain('recording_producer_required');
  });

  it('recording: an unrelated role satisfies none of them', () => {
    const c = codes(recording.validate(rec(), [share({ percentage: '50', party_role: 'author' })]));
    expect(c).toEqual(expect.arrayContaining(['recording_main_artist_required', 'recording_producer_required']));
  });
});
