import { TRIAGE_PRIORITIES } from '@music-os-360/types';
import { canonicalTakedownType, ACCEPTED_TAKEDOWN_PRIORITIES, TAKEDOWN_PRIORITIES, canonicalTakedownPriority } from './takedown-legacy-fields';

describe('takedown priority vocabulary (shared TriagePriority)', () => {
  it('derives from the shared tuple with the persisted values unchanged', () => {
    expect(TAKEDOWN_PRIORITIES).toBe(TRIAGE_PRIORITIES);
    expect([...TAKEDOWN_PRIORITIES]).toEqual(['high', 'medium', 'low']);
  });
  it('accepts exactly canonical + deprecated values', () => {
    expect(ACCEPTED_TAKEDOWN_PRIORITIES).toEqual(['high', 'medium', 'low', 'alta', 'media', 'baixa']);
  });
  it('maps legacy aliases and is safe for prototype keys', () => {
    expect(canonicalTakedownPriority('alta')).toBe('high');
    expect(canonicalTakedownPriority('media')).toBe('medium');
    expect(canonicalTakedownPriority('baixa')).toBe('low');
    expect(canonicalTakedownPriority('constructor')).toBe('constructor');
    expect(canonicalTakedownPriority('__proto__')).toBe('__proto__');
    expect(canonicalTakedownType('constructor')).toBe('constructor');
  });
});
